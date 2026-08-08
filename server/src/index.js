import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { QueueEvents } from 'bullmq';
import { taskQueue, connection } from './queue.js';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import User from './models/User.js';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is not defined.");
  process.exit(1);
}

// Rate Limiter for job submission (e.g. max 10 requests per minute per IP)
const taskSubmitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'Too many tasks submitted from this IP, please try again after a minute' },
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexus-flow';
mongoose.connect(MONGO_URI).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
});

// Zod schema for job input validation
const taskSchema = z.object({
  title: z.string().min(1).max(100),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']),
});

// Registration route
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long' });

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const user = new User({ username, password });
    
    const accessToken = jwt.sign({ userId: username }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: username }, JWT_SECRET, { expiresIn: '7d' });
    
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({ token: accessToken, userId: username });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign({ userId: username }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: username }, JWT_SECRET, { expiresIn: '7d' });

    user.refreshTokens.push(refreshToken);
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ token: accessToken, userId: username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token route
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = await User.findOne({ username: decoded.userId });
    
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const newAccessToken = jwt.sign({ userId: user.username }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: user.username }, JWT_SECRET, { expiresIn: '7d' });

    user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ token: newAccessToken, userId: user.username });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// Logout route
app.post('/api/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET, { ignoreExpiration: true });
    const user = await User.findOne({ username: decoded.userId });
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
      await user.save();
    }
    res.clearCookie('refreshToken');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authentication middleware for Express API routes
const authenticateAPI = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "DELETE"]
  }
});

// WebSocket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

const broadcastTasksToUser = async (userId) => {
  try {
    if (connection.status !== 'ready') throw new Error('Redis is not connected');
    const jobs = await taskQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 99, false);
    
    // Filter jobs for this user
    const userJobs = jobs.filter(job => job.data.userId === userId);
    
    const taskList = userJobs.map(job => ({
      id: job.id,
      title: job.data.title,
      status: job.failedReason ? 'Failed' : (job.finishedOn ? 'Completed' : 'Processing'),
      priority: job.data.priority,
      timestamp: job.timestamp
    })).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    
    io.to(userId).emit('task_update', taskList);
  } catch (err) {
    console.error('Socket broadcast failed:', err.message);
    io.to(userId).emit('redis_error', { message: 'Redis is currently unavailable' });
  }
};

// Listen for global queue events and broadcast changes
const queueEvents = new QueueEvents('nexus-tasks', { connection });
queueEvents.on('error', (err) => {
  console.error('QueueEvents error:', err.message);
});

// To broadcast on event, we need the job to know the user
const handleQueueEvent = async ({ jobId }) => {
  try {
    if (connection.status !== 'ready') return;
    const job = await taskQueue.getJob(jobId);
    if (job && job.data.userId) {
      broadcastTasksToUser(job.data.userId);
    }
  } catch(err) {
    console.error('Failed to handle queue event:', err.message);
  }
};

queueEvents.on('added', handleQueueEvent);
queueEvents.on('active', handleQueueEvent);
queueEvents.on('completed', handleQueueEvent);
queueEvents.on('failed', handleQueueEvent);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id} (User: ${socket.user.userId})`);
  // Join user to their own room
  socket.join(socket.user.userId);
  // Immediately send current state for this user
  broadcastTasksToUser(socket.user.userId);
});

app.post('/api/tasks', authenticateAPI, taskSubmitLimiter, async (req, res) => {
  try {
    // Validate request body
    const { title, priority } = taskSchema.parse(req.body);
    const userId = req.user.userId;

    if (connection.status !== 'ready') throw new Error('Redis is not connected');
    
    const job = await taskQueue.add('new-task', 
      { title, priority, userId }, 
      {
        attempts: 3, 
        backoff: {
          type: 'exponential',
          delay: 5000, 
        },
      }
    );

    res.status(202).json({ success: true, jobId: job.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    console.error('Failed to queue task:', error.message);
    res.status(503).json({ error: 'Redis is currently unavailable or internal error' });
  }
});

app.get('/api/tasks', authenticateAPI, async (req, res) => {
  try {
    if (connection.status !== 'ready') throw new Error('Redis is not connected');
    const jobs = await taskQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 99, false);
    const userId = req.user.userId;
    const userJobs = jobs.filter(job => job.data.userId === userId);
    
    const taskList = userJobs.map(job => ({
      id: job.id,
      title: job.data.title,
      status: job.failedReason ? 'Failed' : (job.finishedOn ? 'Completed' : 'Processing'),
      priority: job.data.priority,
      timestamp: job.timestamp
    })).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5); 

    res.json(taskList);
  } catch (error) {
    console.error('Failed to fetch tasks:', error.message);
    res.status(503).json({ error: 'Redis is currently unavailable' });
  }
});

app.delete('/api/tasks', authenticateAPI, async (req, res) => {
  try {
    if (connection.status !== 'ready') throw new Error('Redis is not connected');
    
    await taskQueue.obliterate({ force: true });
    
    broadcastTasksToUser(req.user.userId); 
    res.json({ success: true, message: 'Queue cleared completely.' });
  } catch (error) {
    console.error('Failed to clear queue:', error.message);
    res.status(503).json({ error: 'Redis is currently unavailable' });
  }
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export { app, httpServer };