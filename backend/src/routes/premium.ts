import express from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Stripe initializes lazily so missing key doesn't crash the server on boot
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_your')) return null;
  return new Stripe(key, { apiVersion: '2024-04-10' as any });
}

const FREE_DAILY_LIKES = 20;
const BOOST_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ── GET /api/premium/status ───────────────────────────────────────────────────
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { isPremium: true, boostedUntil: true, subscriptionId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });

    const likesToday = dbUser
      ? await prisma.like.count({
          where: { senderId: dbUser.id, isSuper: false, createdAt: { gte: startOfDay } },
        })
      : 0;

    res.json({
      isPremium: user.isPremium,
      isBoosted: !!user.boostedUntil && user.boostedUntil > new Date(),
      boostedUntil: user.boostedUntil,
      hasSubscription: !!user.subscriptionId,
      likesToday,
      likesRemaining: user.isPremium ? Infinity : Math.max(0, FREE_DAILY_LIKES - likesToday),
      stripeEnabled: !!getStripe(),
    });
  } catch (error) {
    console.error('Premium status error:', error);
    res.status(500).json({ error: 'Failed to get premium status' });
  }
});

// ── POST /api/premium/checkout ────────────────────────────────────────────────
router.post('/checkout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to backend/.env.dev.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, email: true, stripeCustomerId: true, isPremium: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.isPremium) {
      return res.status(400).json({ error: 'Already a premium member' });
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId || priceId.startsWith('price_your')) {
      return res.status(503).json({ error: 'STRIPE_PRICE_ID not configured.' });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: process.env.STRIPE_SUCCESS_URL ?? 'http://localhost:5173/premium?success=true',
      cancel_url: process.env.STRIPE_CANCEL_URL ?? 'http://localhost:5173/premium?canceled=true',
      metadata: { userId: user.id },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message ?? 'Failed to create checkout session' });
  }
});

// ── POST /api/premium/webhook (raw body — registered before express.json in server.ts) ──
export async function handleStripeWebhook(req: express.Request, res: express.Response) {
  const stripe = getStripe();
  if (!stripe) return res.status(200).json({ received: true }); // graceful no-op

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              isPremium: true,
              subscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
            },
          });
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { subscriptionId: sub.id },
          data: { isPremium: false, subscriptionId: null },
        });
        break;
      }
      case 'customer.subscription.resumed':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const active = sub.status === 'active' || sub.status === 'trialing';
        await prisma.user.updateMany({
          where: { subscriptionId: sub.id },
          data: { isPremium: active },
        });
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
}

// ── POST /api/premium/cancel ──────────────────────────────────────────────────
router.post('/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { subscriptionId: true },
    });
    if (!user?.subscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    // Cancel at period end (user keeps premium until billing cycle ends)
    await stripe.subscriptions.update(user.subscriptionId, { cancel_at_period_end: true });
    res.json({ success: true, message: 'Subscription will cancel at end of billing period' });
  } catch (error: any) {
    console.error('Cancel error:', error);
    res.status(500).json({ error: error.message ?? 'Failed to cancel subscription' });
  }
});

// ── POST /api/premium/boost ───────────────────────────────────────────────────
router.post('/boost', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, isPremium: true, boostedUntil: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isPremium) return res.status(403).json({ error: 'Premium required to boost' });

    // Check if already boosted
    if (user.boostedUntil && user.boostedUntil > new Date()) {
      return res.status(400).json({ error: 'Already boosted', boostedUntil: user.boostedUntil });
    }

    const boostedUntil = new Date(Date.now() + BOOST_DURATION_MS);
    await prisma.user.update({ where: { id: user.id }, data: { boostedUntil } });
    res.json({ boostedUntil });
  } catch (error) {
    console.error('Boost error:', error);
    res.status(500).json({ error: 'Failed to activate boost' });
  }
});

// ── GET /api/premium/likes-received ──────────────────────────────────────────
router.get('/likes-received', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, isPremium: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get users who liked me but I haven't liked back yet
    const myLikes = await prisma.like.findMany({
      where: { senderId: user.id },
      select: { receiverId: true },
    });
    const myLikedIds = new Set(myLikes.map((l) => l.receiverId));

    const incomingLikes = await prisma.like.findMany({
      where: { receiverId: user.id, senderId: { notIn: [...myLikedIds] } },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            profilePictures: true,
            occupation: true,
            dateOfBirth: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (user.isPremium) {
      // Full profiles
      res.json({ likes: incomingLikes, isPremium: true });
    } else {
      // Return count + blurred (empty pictures) for free users
      const blurred = incomingLikes.map((l) => ({
        ...l,
        sender: { ...l.sender, firstName: '???', profilePictures: [], occupation: null },
      }));
      res.json({ likes: blurred, isPremium: false, count: incomingLikes.length });
    }
  } catch (error) {
    console.error('Likes received error:', error);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

export default router;
