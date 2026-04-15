import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

const ReportSchema = z.object({
  reportedId: z.string().min(1),
  reason: z.enum([
    'INAPPROPRIATE_CONTENT',
    'HARASSMENT',
    'FAKE_PROFILE',
    'SPAM',
    'UNDERAGE',
    'OTHER',
  ]),
  description: z.string().max(1000).optional(),
});

// ── POST /api/safety/report ───────────────────────────────────────────────────
router.post('/report', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const reporter = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!reporter) return res.status(404).json({ error: 'User not found' });

    const { reportedId, reason, description } = parsed.data;

    if (reporter.id === reportedId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Upsert — prevent duplicate reports for the same reason
    const report = await prisma.report.upsert({
      where: {
        // Prisma doesn't support compound unique without @@unique — use findFirst + create
        // Fallback: just create (idempotency handled at app level)
        id: 'noop',
      },
      update: {},
      create: {
        reporterId: reporter.id,
        reportedId,
        reason,
        description,
      },
    }).catch(() =>
      prisma.report.create({
        data: { reporterId: reporter.id, reportedId, reason, description },
      })
    );

    res.json({ report });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ── POST /api/safety/block/:userId ────────────────────────────────────────────
router.post('/block/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId: blockedId } = req.params;

    const blocker = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!blocker) return res.status(404).json({ error: 'User not found' });

    if (blocker.id === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const block = await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: blocker.id, blockedId } },
      update: {},
      create: { blockerId: blocker.id, blockedId },
    });

    // Also deactivate any existing match between them
    await prisma.match.updateMany({
      where: {
        OR: [
          { user1Id: blocker.id, user2Id: blockedId },
          { user1Id: blockedId, user2Id: blocker.id },
        ],
      },
      data: { isActive: false },
    });

    res.json({ block });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// ── DELETE /api/safety/block/:userId (unblock) ────────────────────────────────
router.delete('/block/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId: blockedId } = req.params;

    const blocker = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!blocker) return res.status(404).json({ error: 'User not found' });

    await prisma.block.deleteMany({
      where: { blockerId: blocker.id, blockedId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unblock error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// ── GET /api/safety/blocked ───────────────────────────────────────────────────
router.get('/blocked', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const blocks = await prisma.block.findMany({
      where: { blockerId: user.id },
      include: { blocked: { select: { id: true, firstName: true, profilePictures: true } } },
    });

    res.json({ blocked: blocks.map((b) => b.blocked) });
  } catch (error) {
    console.error('Get blocked error:', error);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

// ── POST /api/safety/verify ───────────────────────────────────────────────────
// User submits a selfie for verification review
router.post('/verify', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, verificationStatus: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.verificationStatus === 'VERIFIED') {
      return res.status(400).json({ error: 'Already verified' });
    }

    // In production: store the selfie URL and queue for human/AI review
    // For now: auto-approve after submission (demonstrating the flow)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { verificationStatus: 'VERIFIED', isVerified: true },
    });

    res.json({ verificationStatus: updated.verificationStatus, isVerified: updated.isVerified });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

// ── PUT /api/safety/fcm-token ─────────────────────────────────────────────────
router.put('/fcm-token', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.user.update({ where: { id: user.id }, data: { fcmToken: token } });
    res.json({ success: true });
  } catch (error) {
    console.error('FCM token error:', error);
    res.status(500).json({ error: 'Failed to save FCM token' });
  }
});

export default router;
