import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import * as yaml from 'js-yaml';
import path from 'path';
import { resetDb, createUser, authHeader, A, B, request, app } from './test.helpers';

function readContract() {
  const openapiRaw = fs.readFileSync(path.join(process.cwd(), 'docs', 'openapi-v0.1.yaml'), 'utf8');
  return yaml.load(openapiRaw) as any;
}

function expectPostShape(post: any) {
  expect(post).toHaveProperty('id');
  expect(post).toHaveProperty('authorId');
  expect(post).toHaveProperty('author');
  expect(post).toHaveProperty('videoUrl');
  expect(post).toHaveProperty('reactionCount');
  expect(post).toHaveProperty('reactions');
  expect(post).toHaveProperty('viewerReactions');
  expect(post).toHaveProperty('replyCount');
  expect(post).toHaveProperty('parentPostId');
  expect(post).toHaveProperty('createdAt');
  expect(typeof post.reactions).toBe('object');
  expect(Array.isArray(post.viewerReactions)).toBe(true);
}

describe('OpenAPI contract basic validation', () => {
  beforeEach(async () => {
    await resetDb();
    await createUser(A, 'Alice');
    await createUser(B, 'Bob');
  });

  it('openapi file includes social paths and POST /api/social/posts matches response shape', async () => {
    const doc = readContract();
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining([
      '/api/upload/post-media',
      '/api/social/posts',
      '/api/social/posts/{postId}',
      '/api/social/posts/{postId}/replies',
      '/api/social/posts/feed',
      '/api/social/posts/user/{userId}',
      '/api/social/posts/{postId}/reactions',
      '/api/social/follow/{userId}',
      '/api/social/block/{userId}',
      '/api/social/reports',
      '/api/social/users/{userId}/follow-status',
    ]));

    const res = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/c.mp4' });
    expect(res.status).toBe(201);
    expectPostShape(res.body.post);
    expect(res.body.post.reactionCount).toBe(0);
    expect(res.body.post.reactions).toEqual({});
    expect(res.body.post.viewerReactions).toEqual([]);
  });

  it('feed, profile, and replies responses match paginated contract shapes', async () => {
    const parent = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/parent.mp4' });
    expect(parent.status).toBe(201);
    expectPostShape(parent.body.post);
    const parentPost = parent.body.post;

    const reply = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/reply.mp4', parentPostId: parentPost.id });
    expect(reply.status).toBe(201);
    expectPostShape(reply.body.post);
    expect(reply.body.post.parentPostId).toBe(parentPost.id);

    const profile = await request(app).get(`/api/social/posts/user/${parentPost.authorId}`).set(authHeader(A));
    expect(profile.status).toBe(200);
    expect(Array.isArray(profile.body.posts)).toBe(true);
    expect(profile.body).toHaveProperty('nextCursor');
    expectPostShape(profile.body.posts[0]);

    const feed = await request(app).get('/api/social/posts/feed').set(authHeader(A));
    expect(feed.status).toBe(200);
    expect(Array.isArray(feed.body.posts)).toBe(true);
    expect(feed.body).toHaveProperty('nextCursor');
    expectPostShape(feed.body.posts[0]);

    const replies = await request(app).get(`/api/social/posts/${parentPost.id}/replies`).set(authHeader(B));
    expect(replies.status).toBe(200);
    expect(Array.isArray(replies.body.replies)).toBe(true);
    expect(replies.body).toHaveProperty('nextCursor');
    expectPostShape(replies.body.replies[0]);
  });

  it('contract includes persisted reaction state and responses adhere', async () => {
    const doc = readContract();
    expect(Object.keys(doc.paths)).toContain('/api/social/posts/{postId}/reactions');
    expect(doc.components.schemas.Post.required).toEqual(expect.arrayContaining(['reactions', 'viewerReactions']));

    const p = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/p.mp4' });
    const postId = p.body.post.id;
    const fire = '\u{1F525}';
    const laugh = '\u{1F602}';

    const r = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: fire });
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('reacted');
    expect(r.body).toHaveProperty('count');

    const r2 = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(B)).send({ emoji: fire });
    expect(r2.status).toBe(200);

    const r3 = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: laugh });
    expect(r3.status).toBe(200);

    const viewedByAlice = await request(app).get(`/api/social/posts/${postId}`).set(authHeader(A));
    expect(viewedByAlice.status).toBe(200);
    expectPostShape(viewedByAlice.body.post);
    expect(viewedByAlice.body.post.reactionCount).toBe(3);
    expect(viewedByAlice.body.post.reactions).toEqual({ [fire]: 2, [laugh]: 1 });
    expect(viewedByAlice.body.post.viewerReactions.sort()).toEqual([fire, laugh].sort());

    const viewedByBob = await request(app).get(`/api/social/posts/${postId}`).set(authHeader(B));
    expect(viewedByBob.status).toBe(200);
    expectPostShape(viewedByBob.body.post);
    expect(viewedByBob.body.post.reactions).toEqual({ [fire]: 2, [laugh]: 1 });
    expect(viewedByBob.body.post.viewerReactions).toEqual([fire]);

    const clearLaugh = await request(app).delete(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: laugh });
    expect(clearLaugh.status).toBe(200);
    expect(clearLaugh.body.count).toBe(2);

    const afterClearAsAlice = await request(app).get(`/api/social/posts/${postId}`).set(authHeader(A));
    expect(afterClearAsAlice.status).toBe(200);
    expectPostShape(afterClearAsAlice.body.post);
    expect(afterClearAsAlice.body.post.reactionCount).toBe(2);
    expect(afterClearAsAlice.body.post.reactions).toEqual({ [fire]: 2 });
    expect(afterClearAsAlice.body.post.viewerReactions).toEqual([fire]);
  });

  it('follow, block, reports appear in openapi and respond correctly', async () => {
    const doc = readContract();
    expect(Object.keys(doc.paths)).toContain('/api/upload/post-media');
    expect(Object.keys(doc.paths)).toContain('/api/social/follow/{userId}');
    expect(Object.keys(doc.paths)).toContain('/api/social/block/{userId}');
    expect(Object.keys(doc.paths)).toContain('/api/social/reports');

    const bob = (await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://x' })).body.post;
    const f = await request(app).post(`/api/social/follow/${bob.authorId}`).set(authHeader(A)).send();
    expect(f.status).toBe(200);
    expect(f.body).toHaveProperty('following');

    const b = await request(app).post(`/api/social/block/${bob.authorId}`).set(authHeader(A)).send();
    expect(b.status).toBe(200);
    expect(b.body).toHaveProperty('blocked');

    const r = await request(app).post('/api/social/reports').set(authHeader(A)).send({ reportedId: bob.authorId, reason: 'SPAM' });
    expect(r.status).toBe(201);
    expect(r.body.report).toBeTruthy();
  });
});
