import { generateKeyPairSync } from 'node:crypto';
import express from 'express';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), updateMany: vi.fn() } }));
const verifyToken = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: verifyToken }) }));

describe('Firebase Admin modular API migration', () => {
  let app: express.Express;

  beforeAll(async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    // Ephemeral fixture credentials, never a real Firebase project or account.
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'unit-auth-project', client_email: 'unit@unit-auth-project.iam.gserviceaccount.com',
      private_key: privateKey,
    });
    const { authenticateToken } = await import('../src/middleware/auth');
    app = express().get('/protected', authenticateToken, (req, res) => {
      res.json({ uid: (req as import('../src/middleware/auth').AuthenticatedRequest).user?.uid });
    });
    verifyToken.mockResolvedValue({ uid: 'verified-user' });
    await request(app).get('/protected').set('Authorization', 'Bearer fixture-token');
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '';
    await deleteApp(getApp());
  });

  it('verifies tokens when credentials use the service account JSON format', async () => {
    expect(getApp().options.projectId).toBe('unit-auth-project');
    verifyToken.mockResolvedValue({ uid: 'verified-user' });
    const res = await request(app).get('/protected').set('Authorization', 'Bearer fixture-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uid: 'verified-user' });
    expect(verifyToken).toHaveBeenCalledWith('fixture-token', true);
  });

  it('rejects a failed token verification without falling back to demo auth', async () => {
    verifyToken.mockRejectedValue(new Error('Invalid fixture token'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app).get('/protected').set('Authorization', 'Bearer invalid');
      expect(res.status).toBe(403);
    } finally {
      log.mockRestore();
    }
  });

  it('sends push notifications through the modular messaging client', async () => {
    db.user.findUnique.mockResolvedValue({ fcmToken: 'fixture-device-token' });
    const send = vi.spyOn(getMessaging(), 'send').mockResolvedValue('fixture-message-id');
    const { sendPushToUser } = await import('../src/lib/notifications');
    await sendPushToUser('fixture-user', { title: 'Hello', body: 'Message' });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      token: 'fixture-device-token', notification: { title: 'Hello', body: 'Message' },
    }));
  });
});
