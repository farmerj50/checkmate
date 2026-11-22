import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest, demoAuthEnabled } from '../middleware/auth';
import { ageInYears } from '../lib/profiles';
import { geocodeLocation } from '../lib/geocoding';

const router = express.Router();

const RegisterSchema = z.object({
  userData: z.object({
    email: z.string({ error: 'Enter a valid email address' }).trim().email('Enter a valid email address'),
    firstName: z.string({ error: 'Enter your first name' }).trim().min(1, 'Enter your first name'),
    lastName: z.string({ error: 'Enter your last name' }).trim().min(1, 'Enter your last name'),
    dateOfBirth: z.string({ error: 'Enter your date of birth' }).superRefine((value, ctx) => {
      const date = new Date(value);
      let message: string | undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== value) {
        message = 'Enter a valid date of birth, including the four-digit year';
      } else if (ageInYears(date) < 18) {
        message = 'You must be 18 or older to join';
      } else if (ageInYears(date) > 120) {
        message = 'Check your birth year; your age must be between 18 and 120';
      }
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
    gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'], { error: 'Select how you identify' }),
    location: z.string({ error: 'Enter your city or location' }).trim().min(1, 'Enter your city or location'),
    bio: z.string().optional(),
    occupation: z.string().optional(),
    education: z.string().optional(),
    height: z.number().int().optional(),
    profilePictures: z.array(z.string()).max(0).optional(),
    interests: z.array(z.string()).optional(),
    lookingFor: z.enum(['RELATIONSHIP', 'CASUAL', 'FRIENDSHIP', 'NETWORKING'], { error: 'Select what you are looking for' }),
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
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.slice(1).join('.') || 'userData';
        (fieldErrors[field] ??= []).push(issue.message);
      }
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Check your profile details',
        fieldErrors,
        details: parsed.error.flatten(),
      });
    }

    const { userData } = parsed.data;
    const firebaseUid = req.user!.uid;
    const email = req.user!.email ?? (demoAuthEnabled() ? userData.email : undefined);
    if (!email || email.toLowerCase() !== userData.email.toLowerCase()) {
      return res.status(400).json({ error: 'Use the email address from your authenticated account' });
    }

    let user = await prisma.user.findUnique({ where: { firebaseUid } });

    if (!user) {
      // Geocode location on registration
      const coords = await geocodeLocation(userData.location);

      user = await prisma.user.create({
        data: {
          firebaseUid,
          email,
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
    });
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
