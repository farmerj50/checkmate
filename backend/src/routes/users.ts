import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { geocodeLocation } from '../lib/geocoding';
import { haversineKm, scoreCandidate, passesFilters } from '../lib/matching';

const router = express.Router();

const UpdateProfileSchema = z.object({
  userData: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    bio: z.string().max(500).optional(),
    occupation: z.string().max(100).optional(),
    education: z.string().max(100).optional(),
    height: z.number().int().min(100).max(250).optional(),
    profilePictures: z.array(z.string()).optional(),
    profileVideos: z.array(z.string()).optional(),
    profileVideo: z.string().nullable().optional(),
    interests: z.array(z.string()).optional(),
    lookingFor: z.enum(['RELATIONSHIP', 'CASUAL', 'FRIENDSHIP', 'NETWORKING']).optional(),
    ageRangeMin: z.number().int().min(18).max(99).optional(),
    ageRangeMax: z.number().int().min(18).max(99).optional(),
    maxDistance: z.number().int().min(1).max(500).optional(),
    location: z.string().optional(),
  }),
});

const UpdatePreferencesSchema = z.object({
  dealBreakers: z.array(z.string()).optional(),
  mustHaves: z.array(z.string()).optional(),
  lifestylePreferences: z.record(z.unknown()).optional(),
  showAge: z.boolean().optional(),
  showDistance: z.boolean().optional(),
  showLastActive: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  matchNotifications: z.boolean().optional(),
  messageNotifications: z.boolean().optional(),
});

// ── GET /users/profile ────────────────────────────────────────────────────────
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      include: { preferences: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ── PUT /users/profile ────────────────────────────────────────────────────────
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { userData } = parsed.data;

    // Geocode if location changed
    let geoUpdate: { lat?: number; lng?: number } = {};
    if (userData.location) {
      const coords = await geocodeLocation(userData.location);
      if (coords) geoUpdate = coords;
    }

    const user = await prisma.user.update({
      where: { firebaseUid: req.user!.uid },
      data: { ...userData, ...geoUpdate, updatedAt: new Date() },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── GET /users/preferences ────────────────────────────────────────────────────
router.get('/preferences', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const preferences = await prisma.userPreference.findUnique({
      where: { userId: user.id },
    });
    res.json({ preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// ── PUT /users/preferences ────────────────────────────────────────────────────
router.put('/preferences', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = UpdatePreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const preferences = await prisma.userPreference.upsert({
      where: { userId: dbUser.id },
      update: parsed.data,
      create: { userId: dbUser.id, ...parsed.data },
    });
    res.json({ preferences });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ── GET /users/discover ───────────────────────────────────────────────────────
router.get('/discover', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Exclude self + already-interacted + blocked/blocking users
    const [interacted, blocks, blockedBy] = await Promise.all([
      prisma.like.findMany({ where: { senderId: currentUser.id }, select: { receiverId: true } }),
      prisma.block.findMany({ where: { blockerId: currentUser.id }, select: { blockedId: true } }),
      prisma.block.findMany({ where: { blockedId: currentUser.id }, select: { blockerId: true } }),
    ]);
    const excludeIds = [
      currentUser.id,
      ...interacted.map((l) => l.receiverId),
      ...blocks.map((b) => b.blockedId),
      ...blockedBy.map((b) => b.blockerId),
    ];

    // Fetch candidates — broad DB filter first, then precise filter in JS
    // DB-side pre-filter: active users not already seen
    // We fetch up to 200 and then rank in memory (fine for small-medium scale)
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: excludeIds },
        isActive: true,
      },
      orderBy: { lastActive: 'desc' },
      take: 200,
    });

    // Score + filter candidates
    const scored = candidates
      .map((candidate) => {
        // Compute distance
        let distanceKm: number;
        if (
          currentUser.lat != null &&
          currentUser.lng != null &&
          candidate.lat != null &&
          candidate.lng != null
        ) {
          distanceKm = haversineKm(
            currentUser.lat,
            currentUser.lng,
            candidate.lat,
            candidate.lng
          );
        } else {
          // No geocoords yet — use maxDistance as the assumed distance so the
          // user still sees profiles, but flag with -1 so the UI shows "nearby"
          distanceKm = currentUser.maxDistance * 0.5;
        }

        return { candidate, distanceKm };
      })
      .filter(({ candidate, distanceKm }) =>
        passesFilters(currentUser, candidate, distanceKm)
      )
      .map(({ candidate, distanceKm }) =>
        scoreCandidate(currentUser, candidate, distanceKm)
      )
      // Sort by compatibility score descending
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Boosted profiles bubble to the top
    const now = new Date();
    const boosted = scored.filter((s) => s.user.boostedUntil && new Date(s.user.boostedUntil) > now);
    const regular = scored.filter((s) => !s.user.boostedUntil || new Date(s.user.boostedUntil) <= now);
    const final = [...boosted, ...regular].slice(0, 10);

    res.json({ matches: final });
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// ── GET /users/super-likes/remaining ─────────────────────────────────────────
router.get('/super-likes/remaining', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, isPremium: true },
    });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    if (currentUser.isPremium) {
      return res.json({ remaining: Infinity, isPremium: true });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const usedToday = await prisma.like.count({
      where: {
        senderId: currentUser.id,
        isSuper: true,
        createdAt: { gte: startOfDay },
      },
    });

    const FREE_DAILY_LIMIT = 3;
    res.json({ remaining: Math.max(0, FREE_DAILY_LIMIT - usedToday), isPremium: false });
  } catch (error) {
    console.error('Super likes error:', error);
    res.status(500).json({ error: 'Failed to get super likes remaining' });
  }
});

export default router;
