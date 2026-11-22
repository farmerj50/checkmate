import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { birthDateError, isSignupEmail, validateOnboarding } from '../../src/utils/onboarding';

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
vi.mock('../src/lib/geocoding', () => ({ geocodeLocation: vi.fn().mockResolvedValue(null) }));
import authRouter from '../src/routes/auth';

const app = express().use(express.json()).use('/api/auth', authRouter);
const profile = {
  email: 'registration@example.com', firstName: 'Signup', lastName: 'Test',
  dateOfBirth: '1995-06-15', gender: 'OTHER', location: 'New York',
  interests: ['Music', 'Travel', 'Tech'], lookingFor: 'NETWORKING',
  profilePictures: [], ageRangeMin: 18, ageRangeMax: 99, maxDistance: 50,
};
function register(overrides: Record<string, unknown> = {}) {
  return request(app).post('/api/auth/register').set('Authorization', 'Bearer demo_registration_test')
    .send({ userData: { ...profile, ...overrides } });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue(null);
  db.user.create.mockImplementation(async ({ data }) => ({ id: 'registration-fixture', ...data }));
});
afterEach(() => vi.useRealTimers());

describe('Onboarding and registration validation agree', () => {
  it.each([
    ['1995-06-15', true], ['2008-11-22', true], ['2008-11-23', false],
    ['1906-11-22', true], ['1905-11-22', false], ['0001-06-15', false],
    ['2004-02-29', true], ['2003-02-29', false], ['2026-01-01', false],
    ['1995-13-01', false], ['06/15/1995', false], ['', false],
  ])('validates birth date %s consistently (accepted: %s)', async (dateOfBirth, accepted) => {
    const res = await register({ dateOfBirth });
    expect(res.status).toBe(accepted ? 200 : 400);
    expect(birthDateError(dateOfBirth) === null).toBe(accepted);
    if (!accepted) {
      expect(res.body.error).toBe(birthDateError(dateOfBirth));
      expect(res.body.fieldErrors.dateOfBirth).toContain(res.body.error);
      expect(validateOnboarding({ ...profile, dateOfBirth })?.step).toBe(2);
      expect(db.user.create).not.toHaveBeenCalled();
    }
  });

  it.each(['test@example.com', ' test+signup@example.com ', 'demo', 'test@localhost', 'a..b@example.com', '.test@example.com'])
  ('validates signup email consistently: %s', async email => {
    const res = await register({ email });
    expect(res.status).toBe(isSignupEmail(email) ? 200 : 400);
    if (res.status === 400) expect(res.body.fieldErrors.email).toEqual(['Enter a valid email address']);
  });

  it.each([
    ['firstName', '', 0], ['lastName', '   ', 1], ['gender', '', 3], ['location', '', 4],
    ['lookingFor', '', 8],
  ])('identifies a skipped %s field before saving', async (field, value, step) => {
    const res = await register({ [field]: value });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors[field]).toHaveLength(1);
    expect(res.body.error).not.toBe('Invalid request');
    expect(validateOnboarding({ ...profile, [field]: value })?.step).toBe(step);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it.each(['RELATIONSHIP', 'CASUAL', 'FRIENDSHIP', 'NETWORKING'])('registers a valid %s profile', async lookingFor => {
    const res = await register({ lookingFor, firstName: ' Signup ', location: ' New York ' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ lookingFor, firstName: 'Signup', location: 'New York' });
  });

  it('reports every rejected field without returning submitted personal values', async () => {
    const res = await register({ email: 'private-invalid-email', dateOfBirth: 'bad-private-date', gender: '' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fieldErrors)).toEqual(['email', 'dateOfBirth', 'gender']);
    expect(JSON.stringify(res.body)).not.toContain('private-invalid-email');
    expect(JSON.stringify(res.body)).not.toContain('bad-private-date');
  });
});
