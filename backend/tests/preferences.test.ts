import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, userPreference: { upsert: vi.fn() },
}));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
import router from '../src/routes/users';

describe('Preferences with Zod 4', () => {
  const app = express().use(express.json()).use('/users', router);
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ id: 'fixture-user' });
    db.userPreference.upsert.mockResolvedValue({});
  });

  it('accepts JSON object preferences with nested values', async () => {
    const lifestylePreferences = { smoking: false, travel: ['local'], work: { flexible: true }, optional: null };
    const res = await request(app).put('/users/preferences')
      .set('Authorization', 'Bearer demo_preferences').send({ lifestylePreferences });
    expect(res.status).toBe(200);
    expect(db.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'fixture-user' }, update: { lifestylePreferences },
      create: { userId: 'fixture-user', lifestylePreferences },
    });
  });

  it.each([null, [], 'invalid'])('rejects preferences that are not an object: %j', async lifestylePreferences => {
    const res = await request(app).put('/users/preferences')
      .set('Authorization', 'Bearer demo_preferences').send({ lifestylePreferences });
    expect(res.status).toBe(400);
    expect(db.userPreference.upsert).not.toHaveBeenCalled();
  });
});
