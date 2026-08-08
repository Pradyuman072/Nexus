import { jest } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;
let app;

const mockAdd = jest.fn();
const mockGetJobs = jest.fn();

jest.unstable_mockModule('../src/queue.js', () => ({
  taskQueue: {
    add: mockAdd,
    getJobs: mockGetJobs
  },
  connection: { status: 'ready' }
}));

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.NODE_ENV = 'test';
  
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();

  const index = await import('../src/index.js');
  app = index.app;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Job Dispatch Endpoints', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'jobuser', password: 'password123' });
    token = res.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Task', priority: 'Low' });
    expect(res.status).toBe(401);
  });

  it('should create a job with valid data', async () => {
    mockAdd.mockResolvedValue({ id: 'job-1' });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Important Task', priority: 'High' });
    
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe('job-1');
    expect(mockAdd).toHaveBeenCalledWith(
      'new-task',
      expect.objectContaining({ title: 'Important Task', priority: 'High', userId: 'jobuser' }),
      expect.any(Object)
    );
  });

  it('should reject invalid job priority', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Important Task', priority: 'UnknownPriority' });
    
    expect(res.status).toBe(400);
  });

  it('should fetch jobs', async () => {
    mockGetJobs.mockResolvedValue([
      { id: '1', data: { title: 'T1', priority: 'High', userId: 'jobuser' }, timestamp: 100, failedReason: null, finishedOn: null },
      { id: '2', data: { title: 'T2', priority: 'Low', userId: 'otheruser' }, timestamp: 200, failedReason: null, finishedOn: null }
    ]);

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    // Should filter for jobuser only
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('T1');
  });
});
