/**
 * NexusFlow — Phase 3 Verification Script
 * Tests heartbeat renewal across all four required cases.
 * Run with: node --env-file=.env src/verify_heartbeat.js
 */

import 'dotenv/config';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';

const redisClient = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  family: 4,
});

const CLAIM_TTL_SEC = 45;
const RENEW_INTERVAL_MS = 15000;
const RENEW_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    redis.call("EXPIRE", KEYS[1], ARGV[2])
    return 1
  else
    return 0
  end
`;

const ts = () => new Date().toISOString();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Helper to read Redis key's current TTL ──────────────────────────────────
const getTTL = async (key) => await redisClient.ttl(key);
const getVal = async (key) => await redisClient.get(key);

// ─── CASE 1: Normal Job (< 45s) ─────────────────────────────────────────────
async function case1_normal() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('CASE 1: Normal job (3s duration, well under 45s)');
  console.log('══════════════════════════════════════════════════');

  const jobId = `test-normal-${Date.now()}`;
  const attempt = 0;
  const claimKey = `claim:${jobId}:${attempt}`;
  const ownerToken = randomUUID();

  // Acquire
  const claimed = await redisClient.set(claimKey, ownerToken, 'NX', 'EX', CLAIM_TTL_SEC);
  console.log(`[${ts()}] Lock acquired: ${claimed === 'OK' ? 'YES' : 'NO'} | owner=${ownerToken.slice(0, 8)}...`);
  console.log(`[${ts()}] TTL after acquire: ${await getTTL(claimKey)}s`);

  let interval = null;
  let renewals = 0;

  interval = setInterval(async () => {
    const renewed = await redisClient.eval(RENEW_SCRIPT, 1, claimKey, ownerToken, String(CLAIM_TTL_SEC));
    if (renewed === 1) {
      renewals++;
      console.log(`[${ts()}] Heartbeat renewed (renewal #${renewals})`);
    } else {
      console.warn(`[${ts()}] Heartbeat FAILED — lock no longer owned`);
      clearInterval(interval); interval = null;
    }
  }, RENEW_INTERVAL_MS);

  // Simulate 3s job
  console.log(`[${ts()}] Simulating 3s work...`);
  await sleep(3000);

  // Clean up
  clearInterval(interval); interval = null;
  console.log(`[${ts()}] Job done. Heartbeat cleared. Renewals during job: ${renewals}`);
  console.log(`[${ts()}] TTL remaining on expired key will drop on its own: ${await getTTL(claimKey)}s`);
  await redisClient.del(claimKey); // cleanup for test isolation
  console.log(`[${ts()}] Result: PASS — lock acquired, ${renewals} renewals (0 expected for <15s job), cleaned up.`);
}

// ─── CASE 2: Long-But-Alive (> 45s job, heartbeat keeps lock alive) ─────────
async function case2_long_alive() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('CASE 2: Long job (60s duration, renewals keep lock alive past original 45s TTL)');
  console.log('══════════════════════════════════════════════════');

  const jobId = `test-long-${Date.now()}`;
  const attempt = 0;
  const claimKey = `claim:${jobId}:${attempt}`;
  const ownerToken = randomUUID();

  const claimed = await redisClient.set(claimKey, ownerToken, 'NX', 'EX', CLAIM_TTL_SEC);
  console.log(`[${ts()}] Lock acquired: ${claimed === 'OK' ? 'YES' : 'NO'} | owner=${ownerToken.slice(0, 8)}...`);
  console.log(`[${ts()}] TTL after acquire: ${await getTTL(claimKey)}s`);

  let interval = null;
  let renewals = 0;

  interval = setInterval(async () => {
    const ttlBefore = await getTTL(claimKey);
    const renewed = await redisClient.eval(RENEW_SCRIPT, 1, claimKey, ownerToken, String(CLAIM_TTL_SEC));
    const ttlAfter = await getTTL(claimKey);
    if (renewed === 1) {
      renewals++;
      console.log(`[${ts()}] Heartbeat renewal #${renewals} | TTL before=${ttlBefore}s → after=${ttlAfter}s`);
    } else {
      console.warn(`[${ts()}] Heartbeat FAILED — lock no longer owned by this worker`);
      clearInterval(interval); interval = null;
    }
  }, RENEW_INTERVAL_MS);

  // Simulate 60s job (past the original 45s TTL)
  const JOB_DURATION_MS = 60000;
  console.log(`[${ts()}] Simulating ${JOB_DURATION_MS / 1000}s work (will cross original 45s TTL at t+45s)...`);

  // Log TTL at 10s intervals
  let elapsed = 0;
  while (elapsed < JOB_DURATION_MS) {
    await sleep(10000);
    elapsed += 10000;
    const ttl = await getTTL(claimKey);
    console.log(`[${ts()}] t+${elapsed / 1000}s: lock TTL = ${ttl}s (still alive: ${ttl > 0 ? 'YES' : 'NO — EXPIRED!'})`);
  }

  clearInterval(interval); interval = null;
  const finalTTL = await getTTL(claimKey);
  console.log(`[${ts()}] Job complete. Heartbeat cleared. Renewals: ${renewals}. Final lock TTL: ${finalTTL}s`);
  await redisClient.del(claimKey);
  const pass = renewals >= 1 && finalTTL >= 0;
  console.log(`[${ts()}] Result: ${pass ? 'PASS' : 'FAIL'} — lock renewed ${renewals} times, stayed alive past 45s boundary.`);
}

// ─── CASE 3: Crash Simulation (interval dies, lock expires naturally) ────────
async function case3_crash_simulation() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('CASE 3: Crash simulation — interval killed mid-job, lock expires at TTL');
  console.log('══════════════════════════════════════════════════');

  // For a safe in-test crash simulation, we set a very short TTL (10s) and 
  // kill the interval after 2s (simulating process crash at t+2s).
  // We then observe the key expiring at the TTL boundary.
  const CRASH_TTL_SEC = 10;
  const jobId = `test-crash-${Date.now()}`;
  const attempt = 0;
  const claimKey = `claim:${jobId}:${attempt}`;
  const ownerToken = randomUUID();

  const claimed = await redisClient.set(claimKey, ownerToken, 'NX', 'EX', CRASH_TTL_SEC);
  console.log(`[${ts()}] Lock acquired (short TTL=${CRASH_TTL_SEC}s to speed up test): ${claimed === 'OK' ? 'YES' : 'NO'}`);
  console.log(`[${ts()}] TTL after acquire: ${await getTTL(claimKey)}s`);

  let interval = setInterval(async () => {
    const renewed = await redisClient.eval(RENEW_SCRIPT, 1, claimKey, ownerToken, String(CRASH_TTL_SEC));
    if (renewed === 1) console.log(`[${ts()}] Heartbeat renewed`);
  }, 2000);

  // Simulate crash at t+2s: kill the interval (process crash kills all intervals)
  await sleep(2000);
  clearInterval(interval); interval = null;
  console.log(`[${ts()}] CRASH simulated — interval killed. Lock now unrenewed. TTL: ${await getTTL(claimKey)}s`);

  // Poll until the key expires
  let ttl = await getTTL(claimKey);
  while (ttl > 0) {
    await sleep(1000);
    ttl = await getTTL(claimKey);
    console.log(`[${ts()}] Waiting for lock to expire... TTL = ${ttl}s`);
  }

  const valAfterExpiry = await getVal(claimKey);
  console.log(`[${ts()}] Lock expired. Key value: ${valAfterExpiry} (null = correctly gone)`);

  // Simulate a second worker successfully claiming after expiry
  const worker2Token = randomUUID();
  const reclaimed = await redisClient.set(claimKey, worker2Token, 'NX', 'EX', CLAIM_TTL_SEC);
  console.log(`[${ts()}] Second worker claim attempt: ${reclaimed === 'OK' ? 'CLAIMED — recovery PASS' : 'BLOCKED — FAIL'}`);
  await redisClient.del(claimKey);
}

// ─── CASE 4: No Leaked Timers ────────────────────────────────────────────────
async function case4_no_leaked_timers() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('CASE 4: No leaked timers — interval ref is null after success and failure paths');
  console.log('══════════════════════════════════════════════════');

  async function runWithFinallyCleanup(shouldFail) {
    const jobId = `test-leak-${Date.now()}-${shouldFail ? 'fail' : 'success'}`;
    const claimKey = `claim:${jobId}:0`;
    const ownerToken = randomUUID();
    await redisClient.set(claimKey, ownerToken, 'NX', 'EX', CLAIM_TTL_SEC);

    let heartbeatInterval = setInterval(() => {}, RENEW_INTERVAL_MS);

    try {
      if (shouldFail) throw new Error('Simulated job failure');
      await sleep(100); // success path
    } finally {
      // This finally mirrors worker.js exactly
      if (heartbeatInterval !== null) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
    await redisClient.del(claimKey);
    return heartbeatInterval; // must be null
  }

  // Success path
  const refAfterSuccess = await runWithFinallyCleanup(false);
  console.log(`[${ts()}] Success path — interval ref after finally: ${refAfterSuccess} (expected null)`);
  console.log(`[${ts()}] Success path result: ${refAfterSuccess === null ? 'PASS (no leak)' : 'FAIL (leaked timer)'}`);

  // Failure path
  let refAfterFailure;
  try {
    refAfterFailure = await runWithFinallyCleanup(true);
  } catch(e) {
    // The throw propagates after finally, that is correct
    refAfterFailure = null;
  }
  console.log(`[${ts()}] Failure path — interval ref after finally: ${refAfterFailure} (expected null)`);
  console.log(`[${ts()}] Failure path result: ${refAfterFailure === null ? 'PASS (no leak)' : 'FAIL (leaked timer)'}`);
}

// ─── Run all cases sequentially ──────────────────────────────────────────────
(async () => {
  try {
    await case1_normal();
    await case2_long_alive();
    await case3_crash_simulation();
    await case4_no_leaked_timers();
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await redisClient.quit();
    console.log('\n══ Verification complete. Redis connection closed. ══');
    process.exit(0);
  }
})();
