import type { FollowStatus, User } from '../../types';

export interface MockProfile {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'profilePictures' | 'isVerified' | 'bio'>;
  followStatus: FollowStatus;
}

export const MOCK_PROFILES: Record<string, MockProfile> = {
  'user-ava': {
    user: {
      id: 'user-ava', firstName: 'Ava', lastName: 'Chen',
      profilePictures: ['https://i.pravatar.cc/300?img=32'], isVerified: true,
      bio: 'Runner. Coffee snob.',
    },
    followStatus: { isFollowing: false, followerCount: 128, followingCount: 54 },
  },
  'user-jordan': {
    user: {
      id: 'user-jordan', firstName: 'Jordan', lastName: 'Reyes',
      profilePictures: ['https://i.pravatar.cc/300?img=12'], isVerified: false,
      bio: 'Home studio, always tweaking something.',
    },
    followStatus: { isFollowing: true, followerCount: 43, followingCount: 61 },
  },
  'user-mila': {
    user: {
      id: 'user-mila', firstName: 'Mila', lastName: 'Torres',
      profilePictures: ['https://i.pravatar.cc/300?img=47'], isVerified: false,
      bio: undefined,
    },
    followStatus: { isFollowing: false, followerCount: 9, followingCount: 15 },
  },
  'user-devon': {
    user: {
      id: 'user-devon', firstName: 'Devon', lastName: 'Blake',
      profilePictures: ['https://i.pravatar.cc/300?img=5'], isVerified: true,
      bio: 'Cooking one video at a time.',
    },
    followStatus: { isFollowing: false, followerCount: 512, followingCount: 88 },
  },
  'user-priya': {
    user: {
      id: 'user-priya', firstName: 'Priya', lastName: 'Nair',
      profilePictures: ['https://i.pravatar.cc/300?img=25'], isVerified: false,
      bio: 'New here 👋',
    },
    followStatus: { isFollowing: false, followerCount: 2, followingCount: 8 },
  },
};
