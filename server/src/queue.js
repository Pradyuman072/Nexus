import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  family: 4, // Force IPv4 to avoid Node 17+ DNS resolution issues
});

console.log(`Attempting to connect to Redis at ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}...`);

connection.on('connect', () => {
  console.log('Successfully connected to Cloud Redis!');
});

connection.on('error', (err) => {
  console.error('Redis connection error:', err.message);
  if (err.message.includes('ENOTFOUND')) {
    console.error('DNS resolution failed. Check your REDIS_HOST spelling or your internet connection.');
  }
});

// Configure queue to handle stalled jobs properly
export const taskQueue = new Queue('nexus-tasks', { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
  }
});