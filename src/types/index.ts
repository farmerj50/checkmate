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