import { Worker } from 'bullmq';
import { connection } from './queue.js';

// The store for processed jobs to ensure idempotency. In a real app this would be in DB/Redis.
const processedJobs = new Set();

const worker = new Worker('nexus-tasks', async (job) => {
  console.log(`Processing task: ${job.data.title}`);

  // 1. Idempotency Check
  if (processedJobs.has(job.id)) {
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
  
  // Mark as processed
  processedJobs.add(job.id);
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
