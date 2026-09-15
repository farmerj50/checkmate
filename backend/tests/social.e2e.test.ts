import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { resetDb, createUser, authHeader, A, B, C, request, app } from './test.helpers';
import { prisma } from '../src/lib/prisma';

describe('Social E2E', () => {
  beforeEach(async () => {
    await resetDb();
    await createUser(A, 'Alice');
    await createUser(B, 'Bob');
    await createUser(C, 'Charlie');
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('follow idempotency and unfollow', async () => {
    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    const alice = await prisma.user.findUnique({ where: { firebaseUid: A } });
    const res1 = await request(app).post(`/api/social/follow/${bob!.id}`).set(authHeader(A)).send();
    expect(res1.status).toBe(200);
    expect(res1.body.following).toBe(true);

    const res2 = await request(app).post(`/api/social/follow/${bob!.id}`).set(authHeader(A)).send();
    expect(res2.status).toBe(200);
    expect(res2.body.following).toBe(true);

    const self = await request(app).post(`/api/social/follow/${alice!.id}`).set(authHeader(A)).send();
    expect(self.status).toBeGreaterThanOrEqual(400);

    const unf = await request(app).delete(`/api/social/follow/${bob!.id}`).set(authHeader(A)).send();
    expect(unf.status).toBe(200);
    expect(unf.body.following).toBe(false);

    const unf2 = await request(app).delete(`/api/social/follow/${bob!.id}`).set(authHeader(A)).send();
    expect(unf2.status).toBe(200);
    expect(unf2.body.following).toBe(false);
  });

  it('reactions: create, idempotent, different emoji, clear, cannot react to deleted', async () => {
    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    const resPost = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/video.mp4' });
    expect(resPost.status).toBe(201);
    const postId = resPost.body.post.id;

    let res = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    expect(res.status).toBe(200);
    expect(res.body.reacted).toBe(true);
    const count1 = res.body.count;

    res = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    expect(res.status).toBe(200);
    expect(res.body.reacted).toBe(true);
    expect(res.body.count).toBe(count1);

    res = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '❤️' });
    expect(res.status).toBe(200);

    res = await request(app).delete(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    expect(res.status).toBe(200);
    expect(res.body.reacted).toBe(false);

    res = await request(app).delete(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    expect(res.status).toBe(200);

    // Soft-delete post and then reacting should fail
    const del = await request(app).delete(`/api/social/posts/${postId}`).set(authHeader(B)).send();
    expect(del.status).toBe(200);
    const r2 = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    expect(r2.status).toBeGreaterThanOrEqual(400);
  });

  it('post responses include aggregate reactions and viewer reactions', async () => {
    const fire = '\u{1F525}';
    const laugh = '\u{1F602}';
    const heart = '\u2764\uFE0F';

    const created = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/reactions.mp4' });
    expect(created.status).toBe(201);
    expect(created.body.post.reactionCount).toBe(0);
    expect(created.body.post.reactions).toEqual({});
    expect(created.body.post.viewerReactions).toEqual([]);
    const postId = created.body.post.id;

    await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: fire }).expect(200);
    await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(B)).send({ emoji: fire }).expect(200);
    await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: laugh }).expect(200);
    await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(C)).send({ emoji: heart }).expect(200);

    const directAsAlice = await request(app).get(`/api/social/posts/${postId}`).set(authHeader(A));
    expect(directAsAlice.status).toBe(200);
    expect(directAsAlice.body.post.reactionCount).toBe(4);
    expect(directAsAlice.body.post.reactions).toEqual({ [fire]: 2, [laugh]: 1, [heart]: 1 });
    expect(directAsAlice.body.post.viewerReactions.sort()).toEqual([fire, laugh].sort());

    const directAsBob = await request(app).get(`/api/social/posts/${postId}`).set(authHeader(B));
    expect(directAsBob.status).toBe(200);
    expect(directAsBob.body.post.viewerReactions).toEqual([fire]);

    const clearFire = await request(app).delete(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: fire });
    expect(clearFire.status).toBe(200);
    expect(clearFire.body.count).toBe(3);

    const afterClearAsAlice = await request(app).get(`/api/social/posts/${postId}`).set(authHeader(A));
    expect(afterClearAsAlice.status).toBe(200);
    expect(afterClearAsAlice.body.post.reactionCount).toBe(3);
    expect(afterClearAsAlice.body.post.reactions).toEqual({ [fire]: 1, [laugh]: 1, [heart]: 1 });
    expect(afterClearAsAlice.body.post.viewerReactions).toEqual([laugh]);

    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    const profile = await request(app).get(`/api/social/posts/user/${bob!.id}`).set(authHeader(A));
    expect(profile.status).toBe(200);
    const profilePost = profile.body.posts.find((post: any) => post.id === postId);
    expect(profilePost.reactions).toEqual({ [fire]: 1, [laugh]: 1, [heart]: 1 });
    expect(profilePost.viewerReactions).toEqual([laugh]);

    const feed = await request(app).get('/api/social/posts/feed').set(authHeader(A));
    expect(feed.status).toBe(200);
    const feedPost = feed.body.posts.find((post: any) => post.id === postId);
    expect(feedPost.reactions).toEqual({ [fire]: 1, [laugh]: 1, [heart]: 1 });
    expect(feedPost.viewerReactions).toEqual([laugh]);

    const reply = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/reply-reactions.mp4', parentPostId: postId });
    expect(reply.status).toBe(201);
    expect(reply.body.post.reactions).toEqual({});
    expect(reply.body.post.viewerReactions).toEqual([]);
    await request(app).post(`/api/social/posts/${reply.body.post.id}/reactions`).set(authHeader(B)).send({ emoji: heart }).expect(200);

    const replies = await request(app).get(`/api/social/posts/${postId}/replies`).set(authHeader(B));
    expect(replies.status).toBe(200);
    const replyFromList = replies.body.replies.find((post: any) => post.id === reply.body.post.id);
    expect(replyFromList.reactions).toEqual({ [heart]: 1 });
    expect(replyFromList.viewerReactions).toEqual([heart]);
  });

  it('block removes follow, idempotent block/unblock, self-block rejected', async () => {
    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    await request(app).post(`/api/social/follow/${bob!.id}`).set(authHeader(A)).send();
    const blk = await request(app).post(`/api/social/block/${bob!.id}`).set(authHeader(A)).send();
    expect(blk.status).toBe(200);
    expect(blk.body.blocked).toBe(true);

    const status = await request(app).get(`/api/social/users/${bob!.id}/follow-status`).set(authHeader(A)).send();
    expect(status.status).toBe(200);
    expect(status.body.isFollowing).toBeFalsy();

    const blk2 = await request(app).post(`/api/social/block/${bob!.id}`).set(authHeader(A)).send();
    expect(blk2.status).toBe(200);

    const alice = await prisma.user.findUnique({ where: { firebaseUid: A } });
    const self = await request(app).post(`/api/social/block/${alice!.id}`).set(authHeader(A)).send();
    expect(self.status).toBeGreaterThanOrEqual(400);

    const unblk = await request(app).delete(`/api/social/block/${bob!.id}`).set(authHeader(A)).send();
    expect(unblk.status).toBe(200);
    expect(unblk.body.blocked).toBe(false);
  });

  it('reports: create and self-report rejected', async () => {
    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    const r = await request(app).post('/api/social/reports').set(authHeader(A)).send({ reportedId: bob!.id, reason: 'SPAM' });
    expect(r.status).toBe(201);

    const alice = await prisma.user.findUnique({ where: { firebaseUid: A } });
    const s = await request(app).post('/api/social/reports').set(authHeader(A)).send({ reportedId: alice!.id, reason: 'SPAM' });
    expect(s.status).toBeGreaterThanOrEqual(400);
  });

  it('replies: invalid parent rejected, reply increments replyCount, reply to deleted parent rejected', async () => {
    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    const parent = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/video2.mp4' });
    expect(parent.status).toBe(201);
    const parentId = parent.body.post.id;

    const invalid = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/r.mp4', parentPostId: 'nope' });
    expect(invalid.status).toBeGreaterThanOrEqual(400);

    const reply = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/r.mp4', parentPostId: parentId });
    expect(reply.status).toBe(201);

    const got = await request(app).get(`/api/social/posts/${parentId}`).set(authHeader(B)).send();
    expect(got.status).toBe(200);
    expect(got.body.post.replyCount).toBeGreaterThanOrEqual(1);

    // soft-delete parent
    const del = await request(app).delete(`/api/social/posts/${parentId}`).set(authHeader(B)).send();
    expect(del.status).toBe(200);
    const r2 = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/r2.mp4', parentPostId: parentId });
    expect(r2.status).toBeGreaterThanOrEqual(400);
  });

  it('soft-deleted posts hidden from profile and pagination works', async () => {
    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    const p = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/v3.mp4' });
    expect(p.status).toBe(201);
    const p3 = p.body.post.id;
    await request(app).delete(`/api/social/posts/${p3}`).set(authHeader(B)).send();

    const profile = await request(app).get(`/api/social/posts/user/${bob!.id}`).set(authHeader(A)).send();
    expect(profile.status).toBe(200);
    expect(profile.body.posts.find((x: any) => x.id === p3)).toBeUndefined();

    // pagination: create multiple posts for C
    const uc = await prisma.user.findUnique({ where: { firebaseUid: C } });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/social/posts').set(authHeader(C)).send({ videoUrl: `http://example.test/c${i}.mp4` });
      ids.push(r.body.post.id);
    }
    const p1 = await request(app).get(`/api/social/posts/user/${uc!.id}?limit=2`).set(authHeader(A)).send();
    expect(p1.status).toBe(200);
    const cursor = p1.body.nextCursor;
    if (cursor) {
      const p2 = await request(app).get(`/api/social/posts/user/${uc!.id}?cursor=${cursor}&limit=2`).set(authHeader(A)).send();
      expect(p2.status).toBe(200);
    }
  });

  it('cannot impersonate by providing authorId', async () => {
    const bob = await prisma.user.findUnique({ where: { firebaseUid: B } });
    const res = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/h.mp4', authorId: bob!.id });
    expect(res.status).toBe(201);
    const createdBy = res.body.post.authorId;
    const me = await prisma.user.findUnique({ where: { firebaseUid: A } });
    expect(createdBy).toBe(me!.id);
  });
});

describe('Profile feed (GET /posts/user/:userId) — root-only + limit+1 cursor semantics', () => {
  beforeEach(async () => {
    await resetDb();
    await createUser(A, 'Alice');
    await createUser(C, 'Charlie');
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('replies never appear in the profile feed', async () => {
    const charlie = await prisma.user.findUnique({ where: { firebaseUid: C } });
    const parent = await request(app).post('/api/social/posts').set(authHeader(C)).send({ videoUrl: 'http://example.test/parent.mp4' });
    expect(parent.status).toBe(201);
    const parentId = parent.body.post.id;

    const reply = await request(app).post('/api/social/posts').set(authHeader(C)).send({ videoUrl: 'http://example.test/reply.mp4', parentPostId: parentId });
    expect(reply.status).toBe(201);

    const profile = await request(app).get(`/api/social/posts/user/${charlie!.id}`).set(authHeader(A));
    expect(profile.status).toBe(200);
    const ids = profile.body.posts.map((p: any) => p.id);
    expect(ids).toContain(parentId);
    expect(ids).not.toContain(reply.body.post.id);
  });

  it('3 posts with limit 20 => nextCursor null', async () => {
    const charlie = await prisma.user.findUnique({ where: { firebaseUid: C } });
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/social/posts').set(authHeader(C)).send({ videoUrl: `http://example.test/c${i}.mp4` });
    }
    const res = await request(app).get(`/api/social/posts/user/${charlie!.id}?limit=20`).set(authHeader(A));
    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBe(3);
    expect(res.body.nextCursor).toBeNull();
  });

  it('exactly 20 posts and no 21st => nextCursor null', async () => {
    const charlie = await prisma.user.findUnique({ where: { firebaseUid: C } });
    for (let i = 0; i < 20; i++) {
      await request(app).post('/api/social/posts').set(authHeader(C)).send({ videoUrl: `http://example.test/c${i}.mp4` });
    }
    const res = await request(app).get(`/api/social/posts/user/${charlie!.id}?limit=20`).set(authHeader(A));
    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBe(20);
    expect(res.body.nextCursor).toBeNull();
  });

  it('21 posts => first page returns 20 with a cursor, second page returns the final post with null cursor', async () => {
    const charlie = await prisma.user.findUnique({ where: { firebaseUid: C } });
    for (let i = 0; i < 21; i++) {
      await request(app).post('/api/social/posts').set(authHeader(C)).send({ videoUrl: `http://example.test/c${i}.mp4` });
    }
    const page1 = await request(app).get(`/api/social/posts/user/${charlie!.id}?limit=20`).set(authHeader(A));
    expect(page1.status).toBe(200);
    expect(page1.body.posts.length).toBe(20);
    expect(page1.body.nextCursor).not.toBeNull();

    const page2 = await request(app)
      .get(`/api/social/posts/user/${charlie!.id}?limit=20&cursor=${page1.body.nextCursor}`)
      .set(authHeader(A));
    expect(page2.status).toBe(200);
    expect(page2.body.posts.length).toBe(1);
    expect(page2.body.nextCursor).toBeNull();
  });
});
