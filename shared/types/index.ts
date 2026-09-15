// Shared TypeScript interfaces for Codex OpenAPI v0.1
export interface User {
  id: string;
  username: string;
  displayName?: string;
  isAdult: boolean;
  createdAt: string; // ISO
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
  authorId: string;
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

export interface UploadSignedRequest {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface UploadSignedResponse {
  uploadUrl: string;
  token: string;
  expiresIn: number;
}

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
