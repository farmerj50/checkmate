import { differenceInYears, parseISO } from 'date-fns';

export const calculateAge = (dateOfBirth: string): number => {
  return differenceInYears(new Date(), parseISO(dateOfBirth));
};

export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return 'Less than 1km away';
  }
  return `${distance}km away`;
};

export const getCompatibilityScore = (
  user1Interests: string[],
  user2Interests: string[],
  _user1Preferences?: any,
  _user2Preferences?: any
): number => {
  // Calculate interest overlap
  const commonInterests = user1Interests.filter(interest => 
    user2Interests.includes(interest)
  );
  
  const interestScore = (commonInterests.length / Math.max(user1Interests.length, user2Interests.length)) * 100;
  
  // Add other factors like age compatibility, location, etc.
  // This is a simplified version
  
  return Math.min(Math.round(interestScore), 100);
};

export const getCommonInterests = (
  user1Interests: string[],
  user2Interests: string[]
): string[] => {
  return user1Interests.filter(interest => user2Interests.includes(interest));
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateAge = (dateOfBirth: string): boolean => {
  const age = calculateAge(dateOfBirth);
  return age >= 18 && age <= 100;
};

export const formatLastActive = (lastActive: string): string => {
  const now = new Date();
  const lastActiveDate = parseISO(lastActive);
  const diffInMinutes = Math.floor((now.getTime() - lastActiveDate.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Active now';
  if (diffInMinutes < 60) return `Active ${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Active ${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `Active ${diffInDays}d ago`;
  
  return 'Active over a week ago';
};

export const normalizeAssetUrl = (url?: string): string | undefined => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/uploads/')) {
      return parsed.pathname + parsed.search;
    }
  } catch {
    // If it's already relative or invalid, just return it as-is.
  }
  return url;
};