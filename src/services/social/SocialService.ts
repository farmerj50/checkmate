import type { FollowStatus, SocialNotification } from '../../types';
import type {
  CreatePostInput,
  CreateReplyInput,
  Page,
  ReportInput,
  SocialPost,
} from './types';

/**
 * The service boundary the UI depends on. Screens/components should import
 * `socialService` from `./index`, never `MockSocialService` or
 * `ApiSocialService` directly, so swapping the implementation later is a
 * one-line change in `index.ts`.
 */
export interface SocialService {
  getFeed(cursor?: string): Promise<Page<SocialPost>>;
  /** Paginated, matching the real GET /social/posts/user/:userId contract (posts + nextCursor). */
  getUserPosts(userId: string, cursor?: string): Promise<Page<SocialPost>>;
  getSavedPosts(cursor?: string): Promise<Page<SocialPost>>;
  getPost(postId: string): Promise<SocialPost | null>;
  getReplies(postId: string, cursor?: string): Promise<Page<SocialPost>>;

  createPost(input: CreatePostInput): Promise<SocialPost>;
  createReply(parentPostId: string, input: CreateReplyInput): Promise<SocialPost>;
  deletePost(postId: string): Promise<void>;

  /** Adds `emoji` to the viewer's reactions on this post (viewerReactions is multi-select, not single-choice). */
  setReaction(postId: string, emoji: string): Promise<SocialPost>;
  /** Removes `emoji` from the viewer's reactions on this post. */
  clearReaction(postId: string, emoji: string): Promise<SocialPost>;

  savePost(postId: string): Promise<SocialPost>;
  unsavePost(postId: string): Promise<SocialPost>;

  getFollowStatus(userId: string): Promise<FollowStatus>;
  follow(userId: string): Promise<FollowStatus>;
  unfollow(userId: string): Promise<FollowStatus>;

  report(input: ReportInput): Promise<void>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;

  // Notifications — an existing, stable Vipi contract (GET
  // /social/notifications, GET /social/notifications/unread-count, PUT
  // /social/notifications/:id/read, PUT /social/notifications/read-all).
  // Not part of what Codex reconciled for posts/replies/reactions.
  getNotifications(): Promise<SocialNotification[]>;
  getUnreadNotificationCount(): Promise<number>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
}
