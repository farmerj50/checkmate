import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateToken } from '../src/middleware/auth';

const app = express().get('/protected', authenticateToken, (_req, res) => res.json({ ok: true }));
afterEach(() => vi.unstubAllEnvs());

describe('Authentication failure policy', () => {
  it('never accepts demo credentials in production, even with the demo flag enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_AUTH_ENABLED', 'true');
    expect((await request(app).get('/protected').set('Authorization', 'Bearer demo_user')).status).toBe(503);
  });
  it('requires explicit demo opt-in outside production', async () => {
    vi.stubEnv('DEMO_AUTH_ENABLED', 'false');
    expect((await request(app).get('/protected').set('Authorization', 'Bearer demo_user')).status).toBe(503);
  });
  it('accepts only the demo token namespace when explicitly enabled for tests', async () => {
    expect((await request(app).get('/protected').set('Authorization', 'Bearer demo_user')).status).toBe(200);
    expect((await request(app).get('/protected').set('Authorization', 'Bearer anything')).status).not.toBe(200);
  });
  it('does not fall back to demo after invalid Firebase configuration', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', '{invalid');
    expect((await request(app).get('/protected').set('Authorization', 'Bearer demo_user')).status).toBe(503);
  });
  it.each(['Basic demo_user', 'Bearer one two', ''])('rejects malformed authorization: %s', async header => {
    expect((await request(app).get('/protected').set('Authorization', header)).status).toBe(401);
  });
});
