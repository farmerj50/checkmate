import { Prisma, User, UserPreference } from '@prisma/client';

export function ageInYears(dateOfBirth: Date, now = new Date()): number {
  const beforeBirthday = now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate());
  return now.getUTCFullYear() - dateOfBirth.getUTCFullYear() - Number(beforeBirthday);
}

export const publicProfileSelect = {
  id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true,
  location: true, bio: true, occupation: true, education: true, height: true,
  profilePictures: true, profileVideos: true, profileVideo: true, interests: true,
  lookingFor: true, isVerified: true, lastActive: true,
  preferences: { select: { showAge: true, showDistance: true, showLastActive: true } },
} satisfies Prisma.UserSelect;

type ProfileSource = Pick<User,
  'id' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'location' | 'bio' |
  'occupation' | 'education' | 'height' | 'profilePictures' | 'profileVideos' |
  'profileVideo' | 'interests' | 'lookingFor' | 'isVerified' | 'lastActive'> & {
    preferences?: Pick<UserPreference, 'showAge' | 'showDistance' | 'showLastActive'> | null;
  };

// An explicit allowlist keeps database-only fields out of other users' responses.
export function publicProfile(user: ProfileSource) {
  return {
    id: user.id, firstName: user.firstName, lastName: user.lastName,
    age: user.preferences?.showAge === false ? null : ageInYears(user.dateOfBirth),
    gender: user.gender, location: user.preferences?.showDistance === false ? null : user.location,
    bio: user.bio, occupation: user.occupation, education: user.education, height: user.height,
    profilePictures: user.profilePictures, profileVideos: user.profileVideos,
    profileVideo: user.profileVideo, interests: user.interests, lookingFor: user.lookingFor,
    isVerified: user.isVerified,
    lastActive: user.preferences?.showLastActive === false ? null : user.lastActive,
  };
}

export const messageSenderSelect = {
  id: true, firstName: true, profilePictures: true, isVerified: true,
} satisfies Prisma.UserSelect;
