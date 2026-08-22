import { Worker } from 'bullmq';
import { connection } from './queue.js';

// We use Redis + TTL for idempotency instead of an in-memory Set or MongoDB because:
// 1. Fast in-memory lookup (Redis is much faster than querying MongoDB).
// 2. Survives server restarts (unlike an in-memory Set).
// 3. Avoids unbounded memory growth (TTL ensures old keys auto-expire).
const worker = new Worker('nexus-tasks', async (job) => {
  console.log(`Processing task: ${job.data.title}`);

  // 1. Idempotency Check using Redis
  const idempotencyKey = `processed:${job.id}`;
  const alreadyProcessed = await connection.get(idempotencyKey);
  
  if (alreadyProcessed) {
    console.log(`Job ${job.id} was already processed. Skipping to avoid duplicate side effects.`);
    return;
  }

  // Simulate a crashing task
  if (job.data.title.toLowerCase().includes('fail')) {
    console.log(`Intentional Failure! (Attempt: ${job.attemptsMade + 1})`);
    
    // Succeed only on the 3rd attempt
    if (job.attemptsMade < 2) {
      throw new Error('Database Connection Timeout');
    }
    console.log('Self-healing successful! Completing task...');
  }

  // Simulate some async work
  await new Promise(res => setTimeout(res, 3000));
  
  // Mark as processed in Redis with a 24-hour TTL (86400 seconds)
  await connection.set(idempotencyKey, '1', 'EX', 86400);
  console.log(`Task ${job.id} completed!`);

}, { 
  connection,
  // 2. Stalled job detection configuration
  lockDuration: 30000, // Lock a job for 30 seconds
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
  maxStalledCount: 2, // If a job stalls 2 times, move it to failed to prevent infinite loops
}); 

worker.on('error', err => {
  console.error('Worker error:', err);
});

worker.on('failed', (job, err) => {
  if (job) {
    console.error(`Job ${job.id} failed with error ${err.message}`);
  }
});
