/**
 * Mirrors Codex's finalized Post contract (frozen, per the integration brief).
 * This file is still the seam between screens and the backend — screens
 * import these types from `./index`, never straight from a raw fetch — but
 * the shape itself is no longer a guess: it matches what ApiSocialService
 * actually sends/receives. See ApiSocialService.ts for the endpoints and the
 * envelope-shape assumptions that weren't explicitly specified alongside it.
 */
export interface SocialPost {
  id: string;
  authorId: string;
  author: {
    id: string;
    firstName: string;
    profilePictures: string[];
    isVerified: boolean;
    profileVideo?: string | null;
  };
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  reactionCount: number;
  /** Aggregate emoji -> count across all viewers. */
  reactions: Record<string, number>;
  /** Emojis *this* viewer has reacted with — multi-select, not single-choice. */
  viewerReactions: string[];
  saveCount: number;
  isSaved: boolean;
  replyCount: number;
  parentPostId: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CreatePostInput {
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  parentPostId?: string | null;
}

export interface CreateReplyInput {
  videoUrl: string;
  thumbnailUrl?: string;
}

export interface ReportInput {
  reportedId: string;
  reason: 'INAPPROPRIATE_CONTENT' | 'HARASSMENT' | 'FAKE_PROFILE' | 'SPAM' | 'UNDERAGE' | 'OTHER';
  description?: string;
}
