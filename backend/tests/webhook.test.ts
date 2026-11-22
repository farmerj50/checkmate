import express from 'express';
import { createStripeClient } from '../src/lib/stripe';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ user: { update: vi.fn(), updateMany: vi.fn() } }));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
import { handleStripeWebhook } from '../src/routes/premium';

describe('Stripe webhook verification and persistence', () => {
  const secret = 'whsec_local_test_fixture_only';
  const app = express().post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
  const stripe = createStripeClient('sk_test_local_fixture_only');
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_local_fixture_only';
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    vi.clearAllMocks(); db.user.update.mockResolvedValue({}); db.user.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => { process.env.STRIPE_SECRET_KEY = ''; process.env.STRIPE_WEBHOOK_SECRET = ''; vi.restoreAllMocks(); });
  function send(type: string, object: object, signature = true) {
    const payload = JSON.stringify({ id: 'evt_local_fixture', type, data: { object } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return request(app).post('/webhook').set('Content-Type', 'application/json')
      .set('stripe-signature', signature ? header : 'invalid').send(payload);
  }
  it('rejects invalid signatures before touching the database', async () => {
    expect((await send('checkout.session.completed', {}, false)).status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled(); expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it('returns a retryable failure when the payment event cannot be persisted', async () => {
    db.user.update.mockRejectedValueOnce(new Error('Fixture persistence failure'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await send('checkout.session.completed', { metadata: { userId: 'user' }, subscription: 'sub_fixture', customer: 'cus_fixture' })).status).toBe(500);
  });
  it('keeps the subscription identity on pause so a resume can restore access', async () => {
    expect((await send('customer.subscription.paused', { id: 'sub_fixture' })).status).toBe(200);
    expect(db.user.updateMany).toHaveBeenLastCalledWith({ where: { subscriptionId: 'sub_fixture' }, data: { isPremium: false } });
    expect((await send('customer.subscription.resumed', { id: 'sub_fixture', status: 'active' })).status).toBe(200);
    expect(db.user.updateMany).toHaveBeenLastCalledWith({ where: { subscriptionId: 'sub_fixture' }, data: { isPremium: true } });
  });
  it('does not acknowledge events when webhook configuration is missing', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = '';
    expect((await send('checkout.session.completed', {})).status).toBe(503);
  });
});
