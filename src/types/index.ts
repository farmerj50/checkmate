export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER';
  location: string;
  bio?: string;
  occupation?: string;
  education?: string;
  height?: number;
  profilePictures: string[];
  profileVideos: string[];
  profileVideo?: string;
  interests: string[];
  lookingFor: 'RELATIONSHIP' | 'CASUAL' | 'FRIENDSHIP' | 'NETWORKING';
  ageRangeMin: number;
  ageRangeMax: number;
  maxDistance: number;
  isVerified: boolean;
  isActive: boolean;
  isPremium: boolean;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  dealBreakers: string[];
  mustHaves: string[];
  lifestylePreferences?: any;
  showAge: boolean;
  showDistance: boolean;
  showLastActive: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  matchNotifications: boolean;
  messageNotifications: boolean;
}

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
  isActive: boolean;
  user1: User;
  user2: User;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'GIF' | 'EMOJI' | 'VIDEO';
  isRead: boolean;
  createdAt: string;
  sender: User;
}

export interface Like {
  id: string;
  senderId: string;
  receiverId: string;
  isSuper: boolean;
  createdAt: string;
  sender: User;
  receiver: User;
}

export type SignalType = 'INTRIGUED' | 'STIMULATING' | 'HIGH_VALUE' | 'ALIGNED';

export interface UserPrompt { question: string; answer: string; }
export interface DailyPrompt { id: string; question: string; category: string; responseCount?: number; }

export interface SwipeCard {
  user: User;
  distance: number;
  compatibilityScore: number;
  commonInterests: string[];
  scoreBreakdown?: {
    interest: number;
    age: number;
    activity: number;
  };
  reason?: string;
  prompt?: UserPrompt | null;
}

// ── Social ────────────────────────────────────────────────────────────────────

export interface Post {
  id: string;
  authorId: string;
  author: Pick<User, 'id' | 'firstName' | 'profilePictures' | 'isVerified'>;
  mediaUrl: string;
  mediaType: 'VIDEO' | 'IMAGE';
  caption?: string;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  createdAt: string;
}

export interface SocialComment {
  id: string;
  postId: string;
  authorId: string;
  author: Pick<User, 'id' | 'firstName' | 'profilePictures'>;
  content: string;
  createdAt: string;
}

export interface SocialNotification {
  id: string;
  type: 'NEW_FOLLOWER' | 'POST_LIKED' | 'POST_COMMENTED' | 'NEW_MATCH';
  actor?: Pick<User, 'id' | 'firstName' | 'profilePictures'>;
  postId?: string;
  matchId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface FollowStatus {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export interface MatchingAlgorithmResult {
  potentialMatches: SwipeCard[];
  totalScore: number;
  factors: {
    locationScore: number;
    interestScore: number;
    ageScore: number;
    lifestyleScore: number;
    preferenceScore: number;
  };
}