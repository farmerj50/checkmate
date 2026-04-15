import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { notifyNewMatch } from '../lib/notifications';

const router = express.Router();

const LikeSchema = z.object({
  receiverId: z.string().min(1),
  isSuper: z.boolean().optional().default(false),
});

// Like a user
router.post('/like', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = LikeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { receiverId, isSuper } = parsed.data;

    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (currentUser.id === receiverId) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }

    // Enforce daily like limit for free users (super likes have their own limit)
    if (!currentUser.isPremium && !isSuper) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const likesToday = await prisma.like.count({
        where: { senderId: currentUser.id, isSuper: false, createdAt: { gte: startOfDay } },
      });
      const FREE_DAILY_LIKES = 20;
      if (likesToday >= FREE_DAILY_LIKES) {
        return res.status(429).json({ error: 'Daily like limit reached', limitReached: true, limit: FREE_DAILY_LIKES });
      }
    }

    // Upsert like (handles duplicate swipes gracefully)
    const like = await prisma.like.upsert({
      where: { senderId_receiverId: { senderId: currentUser.id, receiverId } },
      update: { isSuper },
      create: { senderId: currentUser.id, receiverId, isSuper },
    });

    // Check for mutual like
    const mutualLike = await prisma.like.findUnique({
      where: {
        senderId_receiverId: { senderId: receiverId, receiverId: currentUser.id },
      },
    });

    let match = null;
    if (mutualLike) {
      const [u1, u2] = [currentUser.id, receiverId].sort();
      match = await prisma.match.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        update: { isActive: true },
        create: { user1Id: u1, user2Id: u2 },
        include: { user1: true, user2: true },
      });

      // Fire-and-forget push notifications to both users
      notifyNewMatch(receiverId, currentUser.firstName).catch(() => {});
      notifyNewMatch(currentUser.id, match.user1Id === currentUser.id ? match.user2.firstName : match.user1.firstName).catch(() => {});
    }

    res.json({ like, match, isMatch: !!match });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like user' });
  }
});

// Pass (skip) a user — creates a like record with isPass=true equivalent via a sentinel
// For now we just treat pass the same as a non-super like so they don't show again
router.post('/pass', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { receiverId } = z.object({ receiverId: z.string().min(1) }).parse(req.body);

    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    await prisma.like.upsert({
      where: { senderId_receiverId: { senderId: currentUser.id, receiverId } },
      update: {},
      create: { senderId: currentUser.id, receiverId, isSuper: false },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Pass error:', error);
    res.status(500).json({ error: 'Failed to pass user' });
  }
});

// Get user's matches
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: currentUser.id }, { user2Id: currentUser.id }],
        isActive: true,
      },
      include: {
        user1: true,
        user2: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedMatches = matches.map((match) => ({
      ...match,
      otherUser: match.user1Id === currentUser.id ? match.user2 : match.user1,
      lastMessage: match.messages[0] ?? null,
    }));

    res.json({ matches: formattedMatches });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// Get the other user's profile (videos + preferences) for a given match
router.get('/:matchId/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;

    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ user1Id: currentUser.id }, { user2Id: currentUser.id }],
        isActive: true,
      },
      include: { user1: true, user2: true },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const other = match.user1Id === currentUser.id ? match.user2 : match.user1;

    res.json({
      matchId,
      user: {
        id: other.id,
        firstName: other.firstName,
        lastName: other.lastName,
        dateOfBirth: other.dateOfBirth,
        gender: other.gender,
        location: other.location,
        bio: other.bio,
        occupation: other.occupation,
        education: other.education,
        height: other.height,
        interests: other.interests,
        lookingFor: other.lookingFor,
        ageRangeMin: other.ageRangeMin,
        ageRangeMax: other.ageRangeMax,
        maxDistance: other.maxDistance,
        profileVideos: other.profileVideos,
        profileVideo: other.profileVideo,
        isVerified: other.isVerified,
        lastActive: other.lastActive,
      },
    });
  } catch (error) {
    console.error('Match profile error:', error);
    res.status(500).json({ error: 'Failed to get match profile' });
  }
});

export default router;
