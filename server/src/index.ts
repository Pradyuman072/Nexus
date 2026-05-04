import express from 'express';
import cors from 'cors';
import { taskQueue } from './queue.js'; // Note the .js extension for ESM

const app = express();
app.use(cors());
app.use(express.json());

// server/src/index.ts

app.post('/api/tasks', async (req, res) => {
  const { title, priority } = req.body;

  const job = await taskQueue.add('new-task', 
    { title, priority }, 
    {
      attempts: 3, // The task will retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 5000, // Wait 5s, then 10s, then 20s
      },
    }
  );

  res.status(202).json({ success: true, jobId: job.id });
});
// server/src/index.ts (Add this new route)

app.get('/api/tasks', async (req, res) => {
  // Fetch the last 10 jobs from the queue
  const jobs = await taskQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
  
  const taskList = jobs.map(job => ({
    id: job.id,
    title: job.data.title,
    status: job.finishedOn ? 'Completed' : 'Processing',
    priority: job.data.priority,
    timestamp: job.timestamp
  })).reverse().slice(0, 5); 

  res.json(taskList);
});
const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));