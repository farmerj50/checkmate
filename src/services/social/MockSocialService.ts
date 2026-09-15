import type { FollowStatus, SocialNotification } from '../../types';
import { MOCK_FEED_POSTS } from '../../mocks/social/feed';
import { MOCK_NOTIFICATIONS } from '../../mocks/social/notifications';
import { MOCK_PROFILES } from '../../mocks/social/profiles';
import { MOCK_REPLIES } from '../../mocks/social/replies';
import type { SocialService } from './SocialService';
import type {
  CreatePostInput,
  CreateReplyInput,
  Page,
  ReportInput,
  SocialPost,
} from './types';

const PAGE_SIZE = 20;
const NETWORK_DELAY_MS = 300;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** "Me" for the purposes of this mock session — arbitrary, just needs to be stable. */
const MOCK_ME_ID = 'me';

/**
 * In-memory implementation of SocialService. State is seeded from
 * src/mocks/social/** and mutated locally so interactions (reacting,
 * replying, following, deleting) persist for the life of the page —
 * enough to build and demo the real UI flows without a backend.
 */
export class MockSocialService implements SocialService {
  private posts: SocialPost[] = clone(MOCK_FEED_POSTS);
  private replies: Record<string, SocialPost[]> = clone(MOCK_REPLIES);
  private follows: Record<string, FollowStatus> = clone(
    Object.fromEntries(Object.entries(MOCK_PROFILES).map(([id, p]) => [id, p.followStatus]))
  );
  private notifications: SocialNotification[] = clone(MOCK_NOTIFICATIONS);

  private allPosts(): SocialPost[] {
    return [...this.posts, ...Object.values(this.replies).flat()];
  }

  async getFeed(cursor?: string): Promise<Page<SocialPost>> {
    const sorted = [...this.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(paginate(sorted, cursor));
  }

  async getUserPosts(userId: string, cursor?: string): Promise<Page<SocialPost>> {
    const sorted = this.posts
      .filter((p) => p.authorId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(paginate(sorted, cursor));
  }

  async getPost(postId: string): Promise<SocialPost | null> {
    return delay(this.allPosts().find((p) => p.id === postId) ?? null);
  }

  async getReplies(postId: string, cursor?: string): Promise<Page<SocialPost>> {
    const list = [...(this.replies[postId] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return delay(paginate(list, cursor));
  }

  async createPost(input: CreatePostInput): Promise<SocialPost> {
    const post: SocialPost = {
      id: `post-${Date.now()}`,
      authorId: MOCK_ME_ID,
      author: { id: MOCK_ME_ID, firstName: 'You', profilePictures: [], isVerified: false },
      videoUrl: input.videoUrl,
      thumbnailUrl: input.thumbnailUrl,
      caption: input.caption,
      parentPostId: input.parentPostId ?? null,
      replyCount: 0,
      reactionCount: 0,
      reactions: {},
      viewerReactions: [],
      createdAt: new Date().toISOString(),
    };
    if (post.parentPostId) {
      this.replies[post.parentPostId] = [...(this.replies[post.parentPostId] ?? []), post];
      const parent = this.posts.find((p) => p.id === post.parentPostId);
      if (parent) parent.replyCount += 1;
    } else {
      this.posts = [post, ...this.posts];
    }
    return delay(post);
  }

  async createReply(parentPostId: string, input: CreateReplyInput): Promise<SocialPost> {
    return this.createPost({ ...input, parentPostId });
  }

  async deletePost(postId: string): Promise<void> {
    this.posts = this.posts.filter((p) => p.id !== postId);
    delete this.replies[postId];
    for (const list of Object.values(this.replies)) {
      const idx = list.findIndex((r) => r.id === postId);
      if (idx !== -1) list.splice(idx, 1);
    }
    return delay(undefined);
  }

  async setReaction(postId: string, emoji: string): Promise<SocialPost> {
    const post = this.findMutablePost(postId);
    if (!post.viewerReactions.includes(emoji)) {
      post.viewerReactions = [...post.viewerReactions, emoji];
      post.reactions[emoji] = (post.reactions[emoji] ?? 0) + 1;
      post.reactionCount += 1;
    }
    return delay(post);
  }

  async clearReaction(postId: string, emoji: string): Promise<SocialPost> {
    const post = this.findMutablePost(postId);
    if (post.viewerReactions.includes(emoji)) {
      post.viewerReactions = post.viewerReactions.filter((e) => e !== emoji);
      post.reactions[emoji] = Math.max(0, (post.reactions[emoji] ?? 0) - 1);
      post.reactionCount = Math.max(0, post.reactionCount - 1);
    }
    return delay(post);
  }

  async getFollowStatus(userId: string): Promise<FollowStatus> {
    return delay(this.follows[userId] ?? { isFollowing: false, followerCount: 0, followingCount: 0 });
  }

  async follow(userId: string): Promise<FollowStatus> {
    const current = this.follows[userId] ?? { isFollowing: false, followerCount: 0, followingCount: 0 };
    const next = { ...current, isFollowing: true, followerCount: current.followerCount + (current.isFollowing ? 0 : 1) };
    this.follows[userId] = next;
    return delay(next);
  }

  async unfollow(userId: string): Promise<FollowStatus> {
    const current = this.follows[userId] ?? { isFollowing: false, followerCount: 0, followingCount: 0 };
    const next = { ...current, isFollowing: false, followerCount: Math.max(0, current.followerCount - (current.isFollowing ? 1 : 0)) };
    this.follows[userId] = next;
    return delay(next);
  }

  async report(_input: ReportInput): Promise<void> {
    return delay(undefined);
  }

  async block(_userId: string): Promise<void> {
    return delay(undefined);
  }

  async unblock(_userId: string): Promise<void> {
    return delay(undefined);
  }

  async getNotifications(): Promise<SocialNotification[]> {
    return delay([...this.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getUnreadNotificationCount(): Promise<number> {
    return delay(this.notifications.filter((n) => !n.isRead).length);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    this.notifications = this.notifications.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n));
    return delay(undefined);
  }

  async markAllNotificationsRead(): Promise<void> {
    this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
    return delay(undefined);
  }

  private findMutablePost(postId: string): SocialPost {
    const post = this.allPosts().find((p) => p.id === postId);
    if (!post) throw new Error(`Mock post not found: ${postId}`);
    return post;
  }
}

function paginate<T extends { id: string }>(items: T[], cursor?: string): Page<T> {
  const startIndex = cursor ? items.findIndex((i) => i.id === cursor) + 1 : 0;
  const page = items.slice(startIndex, startIndex + PAGE_SIZE);
  const nextCursor = items.length > startIndex + PAGE_SIZE ? page[page.length - 1]?.id ?? null : null;
  return { items: page, nextCursor };
}
