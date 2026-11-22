import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } }));
const identity = vi.hoisted(() => ({ uid: 'firebase-google-user', email: 'Member@Example.com', emailVerified: true }));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
vi.mock('../src/middleware/auth', () => ({
  demoAuthEnabled: () => false,
  authenticateToken: (req: express.Request & { user?: typeof identity }, _res: express.Response, next: express.NextFunction) => {
    req.user = identity;
    next();
  },
}));
import authRouter from '../src/routes/auth';
const app = express().use(express.json()).use('/api/auth', authRouter);

beforeEach(() => {
  vi.resetAllMocks();
  identity.email = 'Member@Example.com';
  db.user.findUnique.mockResolvedValue(null);
  db.user.findFirst.mockResolvedValue(null);
});

describe('Profile lookup before onboarding', () => {
  it('returns the existing profile for the authenticated identity without an email fallback', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'own-profile', firebaseUid: identity.uid });
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe('own-profile');
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it('allows onboarding only when neither the identity nor its email has a profile', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: null });
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: identity.email, mode: 'insensitive' } }, select: { id: true },
    });
  });

  it('returns a conflict instead of new-user status for an email on another identity', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'private-existing-profile' });
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('auth/profile-conflict');
    expect(response.body).not.toHaveProperty('user');
    expect(JSON.stringify(response.body)).not.toContain('private-existing-profile');
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('uses only the token email, ignoring a supplied email or Firebase ID', async () => {
    await request(app).get('/api/auth/me?email=target@example.com&firebaseUid=other-user');
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { firebaseUid: identity.uid } });
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: identity.email, mode: 'insensitive' } }, select: { id: true },
    });
  });

  it('recognizes the same identity if registration finishes during the lookup', async () => {
    db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'own-profile', firebaseUid: identity.uid });
    db.user.findFirst.mockResolvedValue({ id: 'own-profile' });
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe('own-profile');
    expect(db.user.findUnique).toHaveBeenLastCalledWith({ where: { firebaseUid: identity.uid } });
  });

  it('does not treat a failed email lookup as a new profile', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      db.user.findFirst.mockRejectedValue(new Error('Database unavailable'));
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(500);
      expect(response.body).not.toHaveProperty('user');
    } finally { log.mockRestore(); }
  });
});
