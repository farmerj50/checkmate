import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { resetDb, createUser, authHeader, A, B, C, request, app } from './test.helpers';

describe('Security and behavior with PostgreSQL', () => {
  let alice: Awaited<ReturnType<typeof createUser>>;
  let bob: Awaited<ReturnType<typeof createUser>>;
  let charlie: Awaited<ReturnType<typeof createUser>>;
  beforeEach(async () => {
    await resetDb();
    alice = await createUser(A, 'Alice'); bob = await createUser(B, 'Bob'); charlie = await createUser(C, 'Charlie');
  });

  async function match() {
    return prisma.match.create({ data: { user1Id: alice!.id, user2Id: bob!.id } });
  }
  async function post(authorId = bob!.id) {
    return prisma.post.create({ data: { authorId, videoUrl: 'https://example.test/video.mp4' } });
  }

  it('keeps a pass from creating a mutual match', async () => {
    expect((await request(app).post('/api/matches/pass').set(authHeader(A)).send({ receiverId: bob!.id })).status).toBe(200);
    const liked = await request(app).post('/api/matches/like').set(authHeader(B)).send({ receiverId: alice!.id });
    expect(liked.status).toBe(200); expect(liked.body.isMatch).toBe(false);
    expect(await prisma.match.count()).toBe(0);
  });

  it.each(['/api/social/block/', '/api/safety/block/'])('blocks all chat and matching through %s', async endpoint => {
    const m = await match();
    await prisma.follow.create({ data: { followerId: alice!.id, followingId: bob!.id } });
    expect((await request(app).post(endpoint + bob!.id).set(authHeader(A))).status).toBe(200);
    expect((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).isActive).toBe(false);
    expect(await prisma.follow.count()).toBe(0);
    expect((await request(app).post('/api/messages').set(authHeader(B)).send({ matchId: m.id, content: 'hello' })).status).toBe(403);
    expect((await request(app).get('/api/messages/' + m.id).set(authHeader(B))).status).toBe(403);
    expect((await request(app).post('/api/matches/like').set(authHeader(B)).send({ receiverId: alice!.id })).status).toBe(404);
    expect((await request(app).get('/api/users/' + alice!.id).set(authHeader(B))).status).toBe(404);
  });

  it('never returns private account fields or a birth date in public profiles or match messages', async () => {
    const m = await match();
    await prisma.user.update({ where: { id: bob!.id }, data: { fcmToken: 'private-device-token', stripeCustomerId: 'private-customer' } });
    await prisma.userPreference.create({ data: { userId: bob!.id, dealBreakers: [], mustHaves: [], showAge: false, showDistance: false, showLastActive: false } });
    const publicResult = await request(app).get('/api/users/' + bob!.id).set(authHeader(A));
    expect(publicResult.status).toBe(200);
    expect(publicResult.body.user).toMatchObject({ age: null, location: null, lastActive: null });
    const matches = await request(app).get('/api/matches').set(authHeader(A));
    const sent = await request(app).post('/api/messages').set(authHeader(B)).send({ matchId: m.id, content: 'hello' });
    expect(sent.status).toBe(200);
    for (const result of [publicResult, matches, sent]) {
      const json = JSON.stringify(result.body);
      for (const field of ['firebaseUid', 'email', 'dateOfBirth', 'fcmToken', 'stripeCustomerId', 'subscriptionId', '"lat"', '"lng"']) expect(json).not.toContain(field);
    }
  });

  it('prevents outsiders reading messages and rejects invalid message pagination', async () => {
    const m = await match();
    expect((await request(app).get('/api/messages/' + m.id).set(authHeader(C))).status).toBe(403);
    expect((await request(app).get('/api/messages/' + m.id + '?limit=-1').set(authHeader(A))).status).toBe(400);
    expect((await request(app).post('/api/messages').set(authHeader(A)).send({ matchId: m.id, content: ' '.repeat(4) })).status).toBe(400);
  });

  it('cannot start mediation without both approvals or bypass its pause through REST', async () => {
    const m = await match();
    await prisma.user.update({ where: { id: alice!.id }, data: { isPremium: true } });
    expect((await request(app).post(`/api/matches/${m.id}/judge/request`).set(authHeader(A))).status).toBe(200);
    expect((await request(app).post(`/api/matches/${m.id}/judge/continue`).set(authHeader(A))).status).toBe(409);
    expect((await request(app).post(`/api/matches/${m.id}/judge/approve`).set(authHeader(B))).status).toBe(200);
    await prisma.judgeSession.update({ where: { matchId: m.id }, data: { status: 'COOLDOWN', cooldownEndsAt: new Date(Date.now() + 60_000) } });
    expect((await request(app).post('/api/messages').set(authHeader(A)).send({ matchId: m.id, content: 'hello' })).status).toBe(409);
    expect((await request(app).post(`/api/matches/${m.id}/judge/decline`).set(authHeader(A))).status).toBe(409);
    expect((await request(app).post(`/api/matches/${m.id}/judge/approve`).set(authHeader(A))).status).toBe(409);
    expect((await request(app).post(`/api/matches/${m.id}/judge/request`).set(authHeader(A))).status).toBe(409);
    expect((await request(app).post(`/api/matches/${m.id}/judge/continue`).set(authHeader(A))).status).toBe(409);
    await prisma.judgeSession.update({ where: { matchId: m.id }, data: { cooldownEndsAt: new Date(0) } });
    const expired = await request(app).get(`/api/matches/${m.id}/judge`).set(authHeader(A));
    expect(expired.body.session.status).toBe('PAUSED');
    const first = await request(app).post(`/api/matches/${m.id}/judge/continue`).set(authHeader(A));
    expect(first.body.session.status).toBe('PAUSED');
    const second = await request(app).post(`/api/matches/${m.id}/judge/continue`).set(authHeader(B));
    expect(second.body.session.status).toBe('ACTIVE');
  });

  it('does not expose private or rejected posts in feeds, profiles, replies, or reactions', async () => {
    const p = await post();
    await prisma.post.update({ where: { id: p.id }, data: { visibility: 'PRIVATE' } });
    expect((await request(app).get('/api/social/posts/' + p.id).set(authHeader(A))).status).toBe(404);
    expect((await request(app).get(`/api/social/posts/${p.id}/replies`).set(authHeader(A))).status).toBe(404);
    expect((await request(app).post(`/api/social/posts/${p.id}/reactions`).set(authHeader(A)).send({ emoji: 'x' })).status).toBe(404);
    const feed = await request(app).get('/api/social/posts/feed').set(authHeader(A));
    expect(feed.body.posts.some((item: { id: string }) => item.id === p.id)).toBe(false);
    const profile = await request(app).get('/api/social/posts/user/' + bob!.id).set(authHeader(A));
    expect(profile.body.posts.some((item: { id: string }) => item.id === p.id)).toBe(false);
    await prisma.post.update({ where: { id: p.id }, data: { visibility: 'PUBLIC', moderationStatus: 'REJECTED' } });
    expect((await request(app).get('/api/social/posts/' + p.id).set(authHeader(A))).status).toBe(404);
  });

  it('prevents profile updates from claiming someone else\'s uploaded files', async () => {
    const result = await request(app).put('/api/users/profile').set(authHeader(A)).send({ userData: { profilePictures: ['https://app.test/uploads/demo_bob_123.jpg'] } });
    expect(result.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice!.id } })).profilePictures).toEqual([]);
  });

  it('does not self-approve identity verification', async () => {
    expect((await request(app).post('/api/safety/verify').set(authHeader(A))).status).toBe(503);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice!.id } })).isVerified).toBe(false);
  });

  it('only allows the recipient to mark a notification as read', async () => {
    const notification = await prisma.notification.create({ data: { userId: bob!.id, actorId: alice!.id, type: 'NEW_FOLLOWER' } });
    expect((await request(app).put(`/api/social/notifications/${notification.id}/read`).set(authHeader(A))).status).toBe(404);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } })).isRead).toBe(false);
    expect((await request(app).put(`/api/social/notifications/${notification.id}/read`).set(authHeader(B))).status).toBe(200);
  });

  it('paginates equal-timestamp posts and saves without omissions, duplicates, or endless cursors', async () => {
    const sameTime = new Date('2026-01-01');
    const parent = await post();
    for (let i = 0; i < 5; i++) {
      const root = await prisma.post.create({ data: { authorId: bob!.id, videoUrl: 'https://example.test/a.mp4', createdAt: sameTime } });
      await prisma.savedPost.create({ data: { userId: alice!.id, postId: root.id, createdAt: sameTime } });
      await prisma.post.create({ data: { authorId: bob!.id, parentPostId: parent.id, videoUrl: 'https://example.test/a.mp4', createdAt: sameTime } });
    }
    for (const [route, key, count] of [
      ['/api/social/posts/feed', 'posts', 6], ['/api/social/posts/user/' + bob!.id, 'posts', 6],
      ['/api/social/posts/saved', 'posts', 5], [`/api/social/posts/${parent.id}/replies`, 'replies', 5],
    ] as const) {
      const ids: string[] = []; let cursor: string | null = null;
      for (let page = 0; page < 5; page++) {
        const result = await request(app).get(route).query({ limit: 2, ...(cursor ? { cursor } : {}) }).set(authHeader(A));
        expect(result.status).toBe(200);
        ids.push(...result.body[key].map((p: { id: string }) => p.id)); cursor = result.body.nextCursor;
        if (!cursor) break;
      }
      expect(cursor).toBeNull(); expect(ids).toHaveLength(count); expect(new Set(ids).size).toBe(count);
      expect((await request(app).get(route).query({ limit: -1 }).set(authHeader(A))).status).toBe(400);
      expect((await request(app).get(route).query({ cursor: 'missing' }).set(authHeader(A))).status).toBe(400);
    }
  });

  it.each(['2015-01-01', '2000-02-30', 'not-a-date', '2099-01-01'])('rejects an invalid or underage registration: %s', async dateOfBirth => {
    const result = await request(app).post('/api/auth/register').set(authHeader('demo_new_adult')).send({ userData: {
      email: 'new@example.test', firstName: 'New', lastName: 'User', dateOfBirth,
      gender: 'OTHER', location: 'Testville', lookingFor: 'FRIENDSHIP',
    } });
    expect(result.status).toBe(400);
  });
});
