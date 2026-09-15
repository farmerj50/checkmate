import request from 'supertest';
import app from '../src/server';
import { describe, it, expect } from 'vitest';

describe('Social auth', () => {
  it('rejects unauthenticated post creation', async () => {
    const res = await request(app).post('/api/social/posts').send({});
    expect(res.status).toBe(401);
  });

  it('requires body for post creation even with demo token', async () => {
    const res = await request(app).post('/api/social/posts').set('Authorization', 'Bearer demo_user').send({});
    expect(res.status).toBe(400);
  });
});
