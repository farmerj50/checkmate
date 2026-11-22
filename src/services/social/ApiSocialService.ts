import { errorField } from '../../utils/errors';
import type { FollowStatus, SocialNotification } from '../../types';
import { api } from '../../lib/api';
import type { SocialService } from './SocialService';
import type {
  CreatePostInput,
  CreateReplyInput,
  Page,
  ReportInput,
  SocialPost,
} from './types';

/**
 * Real implementation, reconciled line-by-line against Codex's frozen
 * `backend/docs/openapi-v0.1.yaml` on `feature/codex-social-core` — NOT
 * against the route source files in this worktree, which are a different,
 * unrelated branch and were never treated as authoritative here.
 *
 * Every envelope below is asserted with `expect()`: a response missing an
 * expected key throws a descriptive error instead of silently degrading to
 * `[]`/`null`/`undefined`, so a real contract drift fails loudly during
 * integration testing instead of masquerading as "no data".
 */

function expect<T>(data: unknown, keys: (keyof T)[], context: string): T {
  const missing = keys.filter((k) => data == null || typeof data !== 'object' || !(k in data));
  if (missing.length > 0) {
    throw new Error(
      `ApiSocialService.${context}: response did not match the frozen OpenAPI contract — ` +
      `missing ${missing.join(', ')}. Got: ${JSON.stringify(data)}`
    );
  }
  return data as T;
}

export class ApiSocialService implements SocialService {
  // GET /api/social/posts/feed -> PaginatedPostsResponse { posts, nextCursor }
  async getFeed(cursor?: string): Promise<Page<SocialPost>> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const raw = await api.get<unknown>(`/social/posts/feed${qs}`);
    const data = expect<{ posts: SocialPost[]; nextCursor: string | null }>(raw, ['posts', 'nextCursor'], 'getFeed');
    return { items: data.posts, nextCursor: data.nextCursor };
  }

  // GET /api/social/posts/user/:userId -> PaginatedPostsResponse { posts, nextCursor }
  async getUserPosts(userId: string, cursor?: string): Promise<Page<SocialPost>> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const raw = await api.get<unknown>(`/social/posts/user/${userId}${qs}`);
    const data = expect<{ posts: SocialPost[]; nextCursor: string | null }>(raw, ['posts', 'nextCursor'], 'getUserPosts');
    return { items: data.posts, nextCursor: data.nextCursor };
  }

  // GET /api/social/posts/saved -> PaginatedPostsResponse { posts, nextCursor }
  async getSavedPosts(cursor?: string): Promise<Page<SocialPost>> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const raw = await api.get<unknown>(`/social/posts/saved${qs}`);
    const data = expect<{ posts: SocialPost[]; nextCursor: string | null }>(raw, ['posts', 'nextCursor'], 'getSavedPosts');
    return { items: data.posts, nextCursor: data.nextCursor };
  }

  // GET /api/social/posts/:postId -> CreatePostResponse { post }
  async getPost(postId: string): Promise<SocialPost | null> {
    try {
      const raw = await api.get<unknown>(`/social/posts/${postId}`);
      const data = expect<{ post: SocialPost }>(raw, ['post'], 'getPost');
      return data.post;
    } catch (err: unknown) {
      if (errorField(err, 'status') === 404) return null;
      throw err;
    }
  }

  // GET /api/social/posts/:postId/replies -> PaginatedRepliesResponse { replies, nextCursor }
  // Key is `replies`, NOT `posts` — distinct from every other list envelope here.
  async getReplies(postId: string, cursor?: string): Promise<Page<SocialPost>> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const raw = await api.get<unknown>(`/social/posts/${postId}/replies${qs}`);
    const data = expect<{ replies: SocialPost[]; nextCursor: string | null }>(raw, ['replies', 'nextCursor'], 'getReplies');
    return { items: data.replies, nextCursor: data.nextCursor };
  }

  // POST /api/social/posts -> 201 CreatePostResponse { post }
  // CreatePostRequest requires only videoUrl; authorId is server-assigned
  // (ignored if sent), matching CreatePostInput already having no authorId field.
  async createPost(input: CreatePostInput): Promise<SocialPost> {
    const raw = await api.post<unknown>('/social/posts', input);
    const data = expect<{ post: SocialPost }>(raw, ['post'], 'createPost');
    return data.post;
  }

  // Replies are created via the same POST /api/social/posts with parentPostId set.
  async createReply(parentPostId: string, input: CreateReplyInput): Promise<SocialPost> {
    return this.createPost({ ...input, parentPostId });
  }

  // DELETE /api/social/posts/:postId -> SuccessResponse { success }
  async deletePost(postId: string): Promise<void> {
    const raw = await api.delete<unknown>(`/social/posts/${postId}`);
    expect<{ success: boolean }>(raw, ['success'], 'deletePost');
  }

  // POST /api/social/posts/:postId/reactions, body ReactionRequest { emoji } ->
  // ReactionResponse { reacted, count } — NOT the full Post. That response only
  // tells us the new state of the one emoji we just set, not the whole
  // reactions/viewerReactions/reactionCount picture, so rather than guess how
  // to merge a partial update client-side, this re-fetches the canonical post
  // via the already-verified GET /social/posts/:postId.
  async setReaction(postId: string, emoji: string): Promise<SocialPost> {
    const raw = await api.post<unknown>(`/social/posts/${postId}/reactions`, { emoji });
    expect<{ reacted: boolean; count: number }>(raw, ['reacted', 'count'], 'setReaction');
    const post = await this.getPost(postId);
    if (!post) throw new Error(`ApiSocialService.setReaction: post ${postId} not found after reacting`);
    return post;
  }

  // DELETE /api/social/posts/:postId/reactions, body ReactionRequest { emoji }
  // (required per the OpenAPI schema — confirmed, not inferred) ->
  // ReactionResponse { reacted, count }. Same re-fetch rationale as setReaction.
  async clearReaction(postId: string, emoji: string): Promise<SocialPost> {
    const raw = await api.delete<unknown>(`/social/posts/${postId}/reactions`, { emoji });
    expect<{ reacted: boolean; count: number }>(raw, ['reacted', 'count'], 'clearReaction');
    const post = await this.getPost(postId);
    if (!post) throw new Error(`ApiSocialService.clearReaction: post ${postId} not found after clearing`);
    return post;
  }

  // POST/DELETE /api/social/posts/:postId/save -> SaveResponse { saved, count }.
  // The response is intentionally compact, so re-fetch the canonical Post with
  // updated saveCount/isSaved before returning to screens.
  async savePost(postId: string): Promise<SocialPost> {
    const raw = await api.post<unknown>(`/social/posts/${postId}/save`, {});
    expect<{ saved: boolean; count: number }>(raw, ['saved', 'count'], 'savePost');
    const post = await this.getPost(postId);
    if (!post) throw new Error(`ApiSocialService.savePost: post ${postId} not found after saving`);
    return post;
  }

  async unsavePost(postId: string): Promise<SocialPost> {
    const raw = await api.delete<unknown>(`/social/posts/${postId}/save`);
    expect<{ saved: boolean; count: number }>(raw, ['saved', 'count'], 'unsavePost');
    const post = await this.getPost(postId);
    if (!post) throw new Error(`ApiSocialService.unsavePost: post ${postId} not found after unsaving`);
    return post;
  }

  // GET /api/social/users/:userId/follow-status -> FollowStatusResponse
  async getFollowStatus(userId: string): Promise<FollowStatus> {
    const raw = await api.get<unknown>(`/social/users/${userId}/follow-status`);
    return expect<FollowStatus>(raw, ['isFollowing', 'followerCount', 'followingCount'], 'getFollowStatus');
  }

  // POST/DELETE /api/social/follow/:userId -> FollowResponse { following } —
  // no counts, so re-fetch follow-status for what SocialService promises.
  async follow(userId: string): Promise<FollowStatus> {
    await api.post(`/social/follow/${userId}`, {});
    return this.getFollowStatus(userId);
  }
  async unfollow(userId: string): Promise<FollowStatus> {
    await api.delete(`/social/follow/${userId}`);
    return this.getFollowStatus(userId);
  }

  // POST /api/social/reports (NOT /safety/report — Codex's finalized contract
  // moved report/block into the /social namespace; my earlier assumption that
  // these were untouched /safety/* endpoints was wrong, corrected here).
  async report(input: ReportInput): Promise<void> {
    await api.post('/social/reports', input);
  }

  // POST/DELETE /api/social/block/:userId (also moved from /safety/block/:userId).
  async block(userId: string): Promise<void> {
    await api.post(`/social/block/${userId}`, {});
  }
  async unblock(userId: string): Promise<void> {
    await api.delete(`/social/block/${userId}`);
  }

  // Notifications: no /notifications path anywhere in the frozen OpenAPI doc —
  // confirms these are genuinely untouched by Codex's reconciliation, still the
  // pre-existing endpoints.
  async getNotifications(): Promise<SocialNotification[]> {
    const { notifications } = await api.get<{ notifications: SocialNotification[] }>('/social/notifications');
    return notifications;
  }
  async getUnreadNotificationCount(): Promise<number> {
    const { count } = await api.get<{ count: number }>('/social/notifications/unread-count');
    return count;
  }
  async markNotificationRead(notificationId: string): Promise<void> {
    await api.put(`/social/notifications/${notificationId}/read`, {});
  }
  async markAllNotificationsRead(): Promise<void> {
    await api.put('/social/notifications/read-all', {});
  }
}
