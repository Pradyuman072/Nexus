import { Worker } from 'bullmq';
import { connection } from './queue.js';
// server/src/worker.ts

const worker = new Worker('nexus-tasks', async (job) => {
  console.log(`👷 Processing task: ${job.data.title}`);

  if (job.data.title.toLowerCase().includes('fail')) {
    console.log(`⚠️ Intentional Failure! (Attempt: ${job.attemptsMade + 1})`);
    
    // Succeed only on the 3rd attempt (attemptsMade will be 2)
    if (job.attemptsMade < 2) {
      throw new Error('Database Connection Timeout');
    }
    console.log('🛠️ Self-healing successful! Completing task...');
  }

  await new Promise(res => setTimeout(res, 3000));
  console.log(`✅ Task ${job.id} completed!`);
}, { connection }); 
