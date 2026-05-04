import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Configuration using the details from your screenshot
export const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Critical for BullMQ compatibility
  
});
// Add this below your 'connection' definition in queue.ts
connection.on('connect', () => {
  console.log('✅ Successfully connected to Cloud Redis!');
});

connection.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});
// This creates the 'nexus-tasks' queue on your Cloud Redis instance
export const taskQueue = new Queue('nexus-tasks', { connection });