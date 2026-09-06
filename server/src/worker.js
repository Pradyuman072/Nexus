import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { connection } from './queue.js';

// Create a separate Redis client for ad-hoc commands to avoid interfering with BullMQ's managed connection
const redisClient = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  family: 4,
});

// ─── Heartbeat Renewal Constants ────────────────────────────────────────────
// CLAIM_TTL_SEC: how long the claim lock lives before it expires on its own.
// A dead worker's process death kills the renewal loop, so the lock auto-expires
// here — that is the desired failure mode (expired = safe for another worker to claim).
const CLAIM_TTL_SEC = 45;

// RENEW_INTERVAL_MS: how often we renew. Set to 1/3 of TTL so we have 2 full
// renewal cycles of headroom before the lock expires even under network hiccups.
// 45s / 3 = 15s. If renewal fails once at t=15s, we still have 30s of TTL left
// for the next attempt at t=30s before expiry at t=45s.
const RENEW_INTERVAL_MS = 15000;

// ─── Atomic Renewal Script ───────────────────────────────────────────────────
// We use a Lua script for atomic owner-check + TTL extension.
// Plain GET+EXPIRE is NOT atomic: between the GET and the EXPIRE, another
// worker could claim the key, and we'd accidentally extend their lock.
// KEYS[1] = claimKey, ARGV[1] = ownerToken, ARGV[2] = ttlSeconds
const RENEW_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    redis.call("EXPIRE", KEYS[1], ARGV[2])
    return 1
  else
    return 0
  end
`;

// We use Redis + TTL for idempotency instead of an in-memory Set or MongoDB because:
// 1. Fast in-memory lookup (Redis is much faster than querying MongoDB).
// 2. Survives server restarts (unlike an in-memory Set).
// 3. Avoids unbounded memory growth (TTL ensures old keys auto-expire).
const worker = new Worker('nexus-tasks', async (job) => {
  console.log(`[${new Date().toISOString()}] Processing task: ${job.data.title} (job=${job.id}, attempt=${job.attemptsMade})`);

  // 1. Completion Marker (Idempotency Check)
  // Protects against BullMQ retrying a job that already fully succeeded
  const idempotencyKey = `processed:${job.id}`;
  try {
    const alreadyProcessed = await redisClient.get(idempotencyKey);
    if (alreadyProcessed) {
      console.log(`[${new Date().toISOString()}] Job ${job.id} was already processed. Skipping to avoid duplicate side effects.`);
      return;
    }
  } catch (err) {
    console.error(`Failed to read completion marker for job ${job.id}. Failing closed to prevent accidental duplicates.`, err);
    throw new Error('Redis unavailability preventing idempotency check.');
  }

  // 2. Claim Lock (Concurrency Check)
  // Protects against two workers processing the same attempt concurrently due to a stall/reassignment.
  // We store a unique ownerToken as the lock VALUE (not just '1') so that the
  // renewal Lua script can verify we still own the lock before extending its TTL.
  const claimKey = `claim:${job.id}:${job.attemptsMade}`;
  const ownerToken = randomUUID();
  try {
    // SET NX so only the first worker to arrive wins. EX sets the initial TTL.
    const claimed = await redisClient.set(claimKey, ownerToken, 'NX', 'EX', CLAIM_TTL_SEC);
    if (!claimed) {
      console.log(`[${new Date().toISOString()}] Job ${job.id} attempt ${job.attemptsMade} already claimed by another worker. Skipping.`);
      return;
    }
    console.log(`[${new Date().toISOString()}] Job ${job.id} claim lock acquired (owner=${ownerToken.slice(0, 8)}..., TTL=${CLAIM_TTL_SEC}s)`);
  } catch (err) {
    console.error(`Failed to acquire claim lock for job ${job.id}. Failing closed.`, err);
    throw new Error('Redis unavailability preventing claim lock.');
  }

  // 3. Start Heartbeat Renewal Loop
  // Renews every RENEW_INTERVAL_MS (15s) using atomic Lua owner-check.
  // If this process crashes, the interval dies with it — lock expires naturally at
  // the next TTL boundary. This is the CORRECT failure mode: a dead worker's
  // lock must expire so other workers can claim.
  let lockLost = false;
  let heartbeatInterval = setInterval(async () => {
    try {
      const renewed = await redisClient.eval(
        RENEW_SCRIPT, 1, claimKey, ownerToken, String(CLAIM_TTL_SEC)
      );
      if (renewed === 1) {
        console.log(`[${new Date().toISOString()}] Job ${job.id} claim lock renewed (owner=${ownerToken.slice(0, 8)}..., TTL reset to ${CLAIM_TTL_SEC}s)`);
      } else {
        // Lock value didn't match our ownerToken — we lost the lock.
        // Log and stop renewing. Do not attempt to steal it back.
        console.warn(`[${new Date().toISOString()}] Job ${job.id} claim lock renewal FAILED — lock no longer owned by this worker. Setting abort flag.`);
        lockLost = true;
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    } catch (err) {
      // Network hiccup — log but do not clear the interval; we will retry next tick.
      console.error(`[${new Date().toISOString()}] Job ${job.id} heartbeat renewal error (will retry):`, err.message);
    }
  }, RENEW_INTERVAL_MS);

  try {
    // Simulate a crashing task
    if (job.data.title.toLowerCase().includes('fail')) {
      console.log(`[${new Date().toISOString()}] Intentional Failure! (Attempt: ${job.attemptsMade + 1})`);
      
      // Succeed only on the 3rd attempt
      if (job.attemptsMade < 2) {
        throw new Error('Database Connection Timeout');
      }
      console.log(`[${new Date().toISOString()}] Self-healing successful! Completing task...`);
    }

    if (lockLost) {
      console.warn(`[${new Date().toISOString()}] Job ${job.id} — aborting after detecting lock was stolen. Discarding result.`);
      return; 
    }

    // Simulate some async work
    const isDemo = job.data.isDemo === true;
    if (isDemo) {
      const priorityDelays = { 1: 2000, 2: 5000, 3: 10000, 4: 15000 };
      // Fallback to 10s if priority is somehow missing
      const delayMs = priorityDelays[job.opts.priority] || 10000;
      console.log(`[${new Date().toISOString()}] DEMO_MODE: Artificial delay of ${delayMs}ms for priority ${job.opts.priority}`);
      await new Promise(res => setTimeout(res, delayMs));
    } else {
      await new Promise(res => setTimeout(res, 3000));
    }

    // CRITICAL: Check flag again after any await
    if (lockLost) {
      console.warn(`[${new Date().toISOString()}] Job ${job.id} — aborting after simulated work because lock was stolen. Discarding result.`);
      return; // Do NOT write the idempotency marker. Do NOT complete normally.
    }

    // 4. Mark as processed in Redis with a 24-hour TTL (86400 seconds)
    try {
      await redisClient.set(idempotencyKey, '1', 'EX', 86400);
    } catch (err) {
      // We choose to 'fail-open' here. The job's side-effects have already been executed.
      // If we threw an error here, BullMQ would mark the job as failed and automatically retry it,
      // guaranteeing a duplicate side-effect. By catching and logging, the job completes successfully
      // in BullMQ, preventing an automatic retry (though we lose the completion marker for future accidental retries).
      console.error(`Warning: Failed to set completion marker for job ${job.id} after successful processing!`, err);
    }

    console.log(`[${new Date().toISOString()}] Task ${job.id} completed! Clearing heartbeat.`);
  } finally {
    // ─── Clean up heartbeat on EVERY exit path ───────────────────────────────
    // This finally block runs whether the job succeeded, threw (fail/retry), or
    // hit an unexpected error. No dangling intervals.
    if (heartbeatInterval !== null) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      console.log(`[${new Date().toISOString()}] Job ${job.id} heartbeat interval cleared.`);
    }
  }

}, { 
  connection,
  // Stalled job detection configuration
  lockDuration: 30000,   // Lock a job for 30 seconds
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
  maxStalledCount: 2,     // If a job stalls 2 times, move it to failed to prevent infinite loops
}); 

worker.on('error', err => {
  console.error('Worker error:', err);
});

worker.on('failed', (job, err) => {
  if (job) {
    console.error(`[${new Date().toISOString()}] Job ${job.id} failed with error ${err.message}`);
  }
});
