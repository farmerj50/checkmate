import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { geocodeLocation } from '../lib/geocoding';

const router = express.Router();

const RegisterSchema = z.object({
  userData: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: z.string(),
    gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER']),
    location: z.string().min(1),
    bio: z.string().optional(),
    occupation: z.string().optional(),
    education: z.string().optional(),
    height: z.number().int().optional(),
    profilePictures: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    lookingFor: z.enum(['RELATIONSHIP', 'CASUAL', 'FRIENDSHIP', 'NETWORKING']),
    ageRangeMin: z.number().int().min(18).optional(),
    ageRangeMax: z.number().int().max(99).optional(),
    maxDistance: z.number().int().positive().optional(),
  }),
});

// Register / sync user after Firebase sign-in
router.post('/register', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { userData } = parsed.data;
    const firebaseUid = req.user!.uid;

    let user = await prisma.user.findUnique({ where: { firebaseUid } });

    if (!user) {
      // Geocode location on registration
      const coords = await geocodeLocation(userData.location);

      user = await prisma.user.create({
        data: {
          firebaseUid,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          dateOfBirth: new Date(userData.dateOfBirth),
          gender: userData.gender,
          location: userData.location,
          ...(coords ?? {}),
          bio: userData.bio,
          occupation: userData.occupation,
          education: userData.education,
          height: userData.height,
          profilePictures: userData.profilePictures ?? [],
          interests: userData.interests ?? [],
          lookingFor: userData.lookingFor,
          ageRangeMin: userData.ageRangeMin ?? 18,
          ageRangeMax: userData.ageRangeMax ?? 99,
          maxDistance: userData.maxDistance ?? 50,
        },
      });
    } else {
      // Update lastActive on login
      user = await prisma.user.update({
        where: { firebaseUid },
        data: { lastActive: new Date() },
      });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Check if a user profile exists for the authenticated firebase uid
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      include: { preferences: true },
    });
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
