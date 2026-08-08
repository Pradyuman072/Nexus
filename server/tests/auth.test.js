import { jest } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;
let app;

// Mock queue before importing index
jest.unstable_mockModule('../src/queue.js', () => ({
  taskQueue: {},
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

describe('Auth Endpoints', () => {
  let refreshToken;

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'testuser', password: 'password123' });
    
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should login an existing user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'testuser', password: 'password123' });
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    refreshToken = res.body.refreshToken;
  });

  it('should refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    refreshToken = res.body.refreshToken; // update for logout
  });

  it('should reject invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid' });
    
    expect(res.status).toBe(403);
  });

  it('should logout and invalidate refresh token', async () => {
    const res = await request(app)
      .post('/api/logout')
      .send({ refreshToken });
    
    expect(res.status).toBe(200);

    // Try refreshing again with same token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    
    expect(refreshRes.status).toBe(403);
  });
});
