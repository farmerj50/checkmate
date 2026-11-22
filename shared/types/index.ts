// Finalized v0.1 social integration contract for Claude.

export interface AuthorSummary {
  id: string;
  firstName: string;
  profilePictures: string[];
  isVerified: boolean;
  profileVideo?: string | null;
}

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
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
  author: AuthorSummary;
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  reactionCount: number;
  reactions: Record<string, number>;
  viewerReactions: string[];
  saveCount: number;
  isSaved: boolean;
  replyCount: number;
  parentPostId: string | null;
  createdAt: string;
}

export interface CreatePostRequest {
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  parentPostId?: string | null;
}

export interface CreatePostResponse {
  post: Post;
}

export interface PaginatedPostsResponse {
  posts: Post[];
  nextCursor: string | null;
}

export interface PaginatedRepliesResponse {
  replies: Post[];
  nextCursor: string | null;
}

export interface ReactionRequest {
  emoji: string;
}

export interface ReactionResponse {
  reacted: boolean;
  count: number;
}

export interface SaveResponse {
  saved: boolean;
  count: number;
}

export interface FollowResponse {
  following: boolean;
}

export interface BlockResponse {
  blocked: boolean;
}

export interface FollowStatusResponse {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export type ReportReason =
  | 'INAPPROPRIATE_CONTENT'
  | 'HARASSMENT'
  | 'FAKE_PROFILE'
  | 'SPAM'
  | 'UNDERAGE'
  | 'OTHER';

export interface ReportRequest {
  reportedId: string;
  reason: ReportReason;
  description?: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: ReportReason;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportResponse {
  report: Report;
}

export interface UploadPostMediaResponse {
  url: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface ErrorResponse {
  error: string;
}
