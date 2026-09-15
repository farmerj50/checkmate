// Shared TypeScript interfaces for Codex OpenAPI v0.1
export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  displayName?: string;
  dateOfBirth?: string;
  gender?: string;
  location?: string;
  bio?: string | null;
  profilePictures?: string[];
  profileVideos?: string[];
  profileVideo?: string | null;
  interests?: string[];
  isVerified?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Post {
  id: string;
  authorId: string;
  videoUrl: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: string;
  parentPostId?: string | null;
  replyCount: number;
  reactions: Reaction[];
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
}

export interface CreatePostRequest {
  videoUrl: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  parentPostId?: string | null;
}

export interface Reaction {
  emoji: string;
  userId: string;
  createdAt: string;
}

// Note: v0.1 uses the existing multer upload endpoints; signed-upload types omitted

export interface ErrorResponse {
  code: string;
  message: string;
}

export interface ReportRequest {
  postId: string;
  reason: string;
}

export interface FollowRequest {
  action: 'follow' | 'unfollow';
}
