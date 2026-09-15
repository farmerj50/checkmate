import request from 'supertest';
import app from '../src/server';
import { prisma } from '../src/lib/prisma';

const A = 'demo_alice';
const B = 'demo_bob';
const C = 'demo_charlie';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function resetDb() {
  await prisma.postReaction.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.block.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userPrompt.deleteMany().catch(() => null);
  await prisma.profileView.deleteMany().catch(() => null);
  await prisma.user.deleteMany();
}

async function createUser(token: string, name: string) {
  const u = await prisma.user.create({ data: {
    firebaseUid: token,
    email: `${token}@example.test`,
    firstName: name,
    lastName: 'Test',
    dateOfBirth: new Date(1990,0,1),
    gender: 'OTHER' as any,
    location: 'Testville',
    profilePictures: [],
    profileVideos: [],
    lookingFor: 'FRIENDSHIP' as any,
  }});
  return u;
}

async function run() {
  try {
    console.log('Resetting DB...');
    await resetDb();
    console.log('Creating users...');
    const ua = await createUser(A, 'Alice');
    const ub = await createUser(B, 'Bob');
    const uc = await createUser(C, 'Charlie');

    // FOLLOW tests
    console.log('Follow: Alice follows Bob');
    let res = await request(app).post(`/api/social/follow/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200 || res.body.following !== true) throw new Error('Follow failed');

    console.log('Duplicate follow is idempotent');
    res = await request(app).post(`/api/social/follow/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200 || res.body.following !== true) throw new Error('Duplicate follow failed');

    console.log('Self-follow rejected');
    res = await request(app).post(`/api/social/follow/${ua.id}`).set(authHeader(A)).send();
    if (res.status === 200) throw new Error('Self-follow should be rejected');

    console.log('Unfollow works');
    res = await request(app).delete(`/api/social/follow/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200 || res.body.following !== false) throw new Error('Unfollow failed');

    console.log('Duplicate unfollow is safe');
    res = await request(app).delete(`/api/social/follow/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200 || res.body.following !== false) throw new Error('Duplicate unfollow failed');

    // REACTIONS tests
    console.log('Bob creates a post');
    res = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/video.mp4' });
    if (res.status !== 201) throw new Error('Post creation failed');
    const postId = res.body.post.id;

    console.log('Alice reacts with 🔥');
    res = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    if (res.status !== 200 || !res.body.reacted) throw new Error('Reaction failed');
    const count1 = res.body.count;

    console.log('Duplicate same reaction is idempotent');
    res = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    if (res.status !== 200 || !res.body.reacted || res.body.count !== count1) throw new Error('Duplicate reaction failed');

    console.log('Different emoji allowed');
    res = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '❤️' });
    if (res.status !== 200 || !res.body.reacted) throw new Error('Second emoji reaction failed');

    console.log('Clear reaction works');
    res = await request(app).delete(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    if (res.status !== 200 || res.body.reacted !== false) throw new Error('Clear reaction failed');

    console.log('Clear missing reaction is safe');
    res = await request(app).delete(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    if (res.status !== 200) throw new Error('Clear missing reaction failed');

    console.log('Reacting to deleted post should fail');
    // Soft-delete post
    res = await request(app).delete(`/api/social/posts/${postId}`).set(authHeader(B)).send();
    if (res.status !== 200) throw new Error('Soft-delete failed');
    res = await request(app).post(`/api/social/posts/${postId}/reactions`).set(authHeader(A)).send({ emoji: '🔥' });
    if (res.status === 200) throw new Error('React to deleted post should fail');

    // BLOCK tests
    console.log('Alice follows Bob again for block removal test');
    res = await request(app).post(`/api/social/follow/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200) throw new Error('Follow before block failed');

    console.log('Alice blocks Bob');
    res = await request(app).post(`/api/social/block/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200 || res.body.blocked !== true) throw new Error('Block failed');

    console.log('Block removes follow relations');
    // Check follow status
    res = await request(app).get('/api/social/users/' + ub.id + '/follow-status').set(authHeader(A)).send();
    if (res.status !== 200 || res.body.isFollowing) throw new Error('Follow not removed by block');

    console.log('Duplicate block is idempotent');
    res = await request(app).post(`/api/social/block/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200 || res.body.blocked !== true) throw new Error('Duplicate block failed');

    console.log('Self-block rejected');
    res = await request(app).post(`/api/social/block/${ua.id}`).set(authHeader(A)).send();
    if (res.status === 200) throw new Error('Self-block should be rejected');

    console.log('Unblock works');
    res = await request(app).delete(`/api/social/block/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200 || res.body.blocked !== false) throw new Error('Unblock failed');

    // REPORT tests
    console.log('Alice reports Bob');
    res = await request(app).post('/api/social/reports').set(authHeader(A)).send({ reportedId: ub.id, reason: 'SPAM' });
    if (res.status !== 201) throw new Error('Report failed');

    console.log('Self-report rejected');
    res = await request(app).post('/api/social/reports').set(authHeader(A)).send({ reportedId: ua.id, reason: 'SPAM' });
    if (res.status === 201) throw new Error('Self-report should be rejected');

    // REPLY tests
    console.log('Bob creates a fresh post');
    res = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/video2.mp4' });
    if (res.status !== 201) throw new Error('Post2 creation failed');
    const parentId = res.body.post.id;

    console.log('Invalid parentPostId rejected');
    res = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/r.mp4', parentPostId: 'nope' });
    if (res.status === 201) throw new Error('Invalid parent accepted');

    console.log('Reply increments replyCount');
    res = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/r.mp4', parentPostId: parentId });
    if (res.status !== 201) throw new Error('Reply creation failed');
    // fetch parent
    res = await request(app).get(`/api/social/posts/${parentId}`).set(authHeader(B)).send();
    if (res.status !== 200 || res.body.post.replyCount < 1) throw new Error('Reply count not incremented');

    console.log('Reply to soft-deleted post rejected');
    // soft-delete parent
    res = await request(app).delete(`/api/social/posts/${parentId}`).set(authHeader(B)).send();
    if (res.status !== 200) throw new Error('Soft-delete parent failed');
    res = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/r2.mp4', parentPostId: parentId });
    if (res.status === 201) throw new Error('Reply to deleted parent should be rejected');

    // SOFT-DELETE visibility
    console.log('Deleted post hidden from profile and feed');
    // Create post, delete, then check user posts
    res = await request(app).post('/api/social/posts').set(authHeader(B)).send({ videoUrl: 'http://example.test/v3.mp4' });
    const p3 = res.body.post.id;
    res = await request(app).delete(`/api/social/posts/${p3}`).set(authHeader(B)).send();
    res = await request(app).get(`/api/social/posts/user/${ub.id}`).set(authHeader(A)).send();
    if (res.status !== 200) throw new Error('Profile posts fetch failed');
    if (res.body.posts.some((p: any) => p.id === p3)) throw new Error('Deleted post visible in profile');

    // Pagination simple test
    console.log('Pagination cursor for profile posts');
    // create multiple posts
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      res = await request(app).post('/api/social/posts').set(authHeader(C)).send({ videoUrl: `http://example.test/c${i}.mp4` });
      ids.push(res.body.post.id);
    }
    res = await request(app).get(`/api/social/posts/user/${uc.id}?limit=2`).set(authHeader(A)).send();
    if (res.status !== 200) throw new Error('Pagination fetch failed');
    const page1 = res.body.posts;
    const cursor = res.body.nextCursor;
    res = await request(app).get(`/api/social/posts/user/${uc.id}?cursor=${cursor}&limit=2`).set(authHeader(A)).send();
    if (res.status !== 200) throw new Error('Pagination second page failed');

    console.log('Authorization: cannot act as another user by sending authorId');
    // Attempt to create post with authorId in body (should be ignored) - server ignores authorId anyway
    res = await request(app).post('/api/social/posts').set(authHeader(A)).send({ videoUrl: 'http://example.test/h.mp4', authorId: ub.id });
    if (res.status !== 201) throw new Error('Post with authorId rejected unexpectedly');
    const createdBy = res.body.post.authorId;
    if (createdBy !== (await prisma.user.findUnique({ where: { firebaseUid: A } }))?.id) throw new Error('Post author mismatch');

    console.log('All checks passed');
    process.exit(0);
  } catch (e) {
    console.error('E2E failure:', e);
    process.exit(2);
  } finally {
    // keep DB for inspection
  }
}

run();
