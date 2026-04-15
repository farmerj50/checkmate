import { User } from '@prisma/client';

/**
 * Haversine formula — returns distance in km between two lat/lng points.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|, scaled 0-100.
 */
function interestScore(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 50;
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

/**
 * Age score: how well the candidate's age sits within the current user's preferred range.
 * Returns 100 if squarely in range, drops off outside it.
 */
function ageScore(candidateDob: Date, preferredMin: number, preferredMax: number): number {
  const age = Math.floor(
    (Date.now() - candidateDob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  if (age >= preferredMin && age <= preferredMax) return 100;
  const overshoot = age < preferredMin ? preferredMin - age : age - preferredMax;
  return Math.max(0, 100 - overshoot * 10);
}

/**
 * Activity score: recently active users rank higher.
 */
function activityScore(lastActive: Date): number {
  const hoursAgo = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 1) return 100;
  if (hoursAgo < 24) return 80;
  if (hoursAgo < 72) return 60;
  if (hoursAgo < 168) return 40;
  return 20;
}

export interface ScoredMatch {
  user: User;
  distance: number; // km, or -1 if unknown
  compatibilityScore: number; // 0-100
  commonInterests: string[];
  scoreBreakdown: {
    interest: number;
    age: number;
    activity: number;
  };
}

/**
 * Score a single candidate against the current user.
 */
export function scoreCandidate(
  currentUser: User,
  candidate: User,
  distanceKm: number
): ScoredMatch {
  const common = candidate.interests.filter((i) =>
    currentUser.interests.map((x) => x.toLowerCase()).includes(i.toLowerCase())
  );

  const iScore = interestScore(currentUser.interests, candidate.interests);
  const aScore = ageScore(
    candidate.dateOfBirth,
    currentUser.ageRangeMin,
    currentUser.ageRangeMax
  );
  const actScore = activityScore(candidate.lastActive);

  // Weighted composite: interests 40%, age fit 35%, activity 25%
  const composite = Math.round(iScore * 0.4 + aScore * 0.35 + actScore * 0.25);

  return {
    user: candidate,
    distance: Math.round(distanceKm),
    compatibilityScore: Math.max(1, Math.min(100, composite)),
    commonInterests: common,
    scoreBreakdown: { interest: iScore, age: aScore, activity: actScore },
  };
}

/**
 * Determine the age of a user from their dateOfBirth.
 */
export function getAge(dob: Date): number {
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Returns true if the candidate passes the current user's discovery filters.
 */
export function passesFilters(currentUser: User, candidate: User, distanceKm: number): boolean {
  const age = getAge(candidate.dateOfBirth);

  // Age range
  if (age < currentUser.ageRangeMin || age > currentUser.ageRangeMax) return false;

  // Distance
  if (distanceKm > currentUser.maxDistance) return false;

  // Gender filter (only for RELATIONSHIP intent)
  if (currentUser.lookingFor === 'RELATIONSHIP') {
    if (currentUser.gender === 'MALE' && candidate.gender !== 'FEMALE') return false;
    if (currentUser.gender === 'FEMALE' && candidate.gender !== 'MALE') return false;
    // NON_BINARY / OTHER: no gender filter applied
  }

  return true;
}
