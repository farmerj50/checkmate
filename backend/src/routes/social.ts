import { activeUserIdentityWhere } from '../lib/access';
/**
 * SOCIAL API LAYER
 * Handles all social media functionality — video posts, reactions, replies, follows, notifications.
 * Completely separate from the dating/matching system.
 * DO NOT modify Match or Like (dating). PostLike is separate from dating Like.
 */
import express from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { io } from '../lib/io';
import { blockUser, canViewPost, visiblePostWhere, visibleUserWhere } from '../lib/access';

const router = express.Router();

const AUTHOR_SELECT = {
  id: true, firstName: true, profilePictures: true, isVerified: true, profileVideo: true,
};

const REACTION_SELECT = {
  emoji: true,
  userId: true,
};


const PageQuery = z.object({
  cursor: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
class InvalidCursor extends Error {}
function afterCursor(anchor: { id: string; createdAt: Date } | null) {
  return anchor ? { AND: [{ OR: [
    { createdAt: { lt: anchor.createdAt } },
    { createdAt: anchor.createdAt, id: { lt: anchor.id } },
  ] }] } : {};
}
const POST_INCLUDE = {
  author: { select: AUTHOR_SELECT }, reactions: { select: REACTION_SELECT },
  savedBy: { select: { userId: true } },
  _count: { select: { reactions: true, replies: true, savedBy: true } },
};
async function postPage(viewerId: string, scope: Prisma.PostWhereInput, cursor: string | undefined, limit: number) {
  const where = { ...visiblePostWhere(viewerId), ...scope };
  const anchor = cursor ? await prisma.post.findFirst({
    where: { ...where, id: cursor }, select: { id: true, createdAt: true },
  }) : null;
  if (cursor && !anchor) throw new InvalidCursor();
  const rows = await prisma.post.findMany({
    where: { ...where, ...afterCursor(anchor) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, include: POST_INCLUDE,
  });
  const page = rows.slice(0, limit);
  return { items: page.map(post => formatPost(post, viewerId)), nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}

function emitNotification(userId: string, payload: object) {
  try { io?.to(`user:${userId}`).emit('notification:new', payload); } catch { /* silent */ }
}

function hasPrismaCode(err: unknown, code: string) {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === code;
}

// ── POST /posts ───────────────────────────────────────────────────────────────
// Create a video post (or a video reply if parentPostId is provided)
router.post('/posts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    videoUrl: z.string().url().regex(/^https?:\/\//i),
    thumbnailUrl: z.string().url().regex(/^https?:\/\//i).optional(),
    caption: z.string().max(500).optional(),
    parentPostId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    // If parentPostId provided, validate parent
    if (parsed.data.parentPostId) {
      const parent = await prisma.post.findUnique({ where: { id: parsed.data.parentPostId } });
      if (!parent || !canViewPost(parent, me.id)) return res.status(400).json({ error: 'Invalid parentPostId' });
      // Prevent replying to a post from a blocked user or to a post that has blocked the replier
      const blocked = await prisma.block.findFirst({ where: { OR: [ { blockerId: parent.authorId, blockedId: me.id }, { blockerId: me.id, blockedId: parent.authorId } ] } });
      if (blocked) return res.status(403).json({ error: 'Cannot reply due to block relationship' });
    }

    const post = await prisma.post.create({
      data: {
        authorId: me.id,
        videoUrl: parsed.data.videoUrl,
        thumbnailUrl: parsed.data.thumbnailUrl,
        caption: parsed.data.caption,
        parentPostId: parsed.data.parentPostId ?? null,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        reactions: { select: REACTION_SELECT },
        savedBy: { select: { userId: true } },
        _count: { select: { reactions: true, replies: true, savedBy: true } },
      },
    });

    // If this is a reply, increment parent's replyCount
    if (parsed.data.parentPostId) {
      await prisma.post.update({ where: { id: parsed.data.parentPostId }, data: { replyCount: { increment: 1 } } }).catch(() => null);
    }
    res.status(201).json({ post: formatPost(post, me.id) });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// DELETE reaction (clear) - idempotent
router.delete('/posts/:postId/reactions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ emoji: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const targetPost = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!targetPost || !canViewPost(targetPost, me.id)) return res.status(404).json({ error: 'Post not found' });

    // delete if exists; idempotent
    await prisma.postReaction.deleteMany({ where: { postId: req.params.postId, userId: me.id, emoji: parsed.data.emoji } });
    const count = await prisma.postReaction.count({ where: { postId: req.params.postId } });
    res.json({ reacted: false, count });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});


// ── GET /posts/:postId ────────────────────────────────────────────────────
// GET saved videos for the authenticated viewer
router.get('/posts/saved', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const query = PageQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'Invalid pagination' });
  const { cursor, limit } = query.data;
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    const where = { userId: me.id, post: visiblePostWhere(me.id) };
    const anchor = cursor ? await prisma.savedPost.findFirst({
      where: { ...where, id: cursor }, select: { id: true, createdAt: true },
    }) : null;
    if (cursor && !anchor) throw new InvalidCursor();
    const rows = await prisma.savedPost.findMany({
      where: { ...where, ...afterCursor(anchor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      include: { post: { include: POST_INCLUDE } },
    });
    const page = rows.slice(0, limit);
    res.json({ posts: page.map(item => formatPost(item.post, me.id)), nextCursor: rows.length > limit ? page[page.length - 1].id : null });
  } catch (error) {
    res.status(error instanceof InvalidCursor ? 400 : 500).json({ error: error instanceof InvalidCursor ? 'Invalid cursor' : 'Failed to load posts' });
  }
});

// Save a video post - idempotent
router.post('/posts/:postId/save', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const targetPost = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!targetPost || !canViewPost(targetPost, me.id)) return res.status(404).json({ error: 'Post not found' });

    const blockedRel = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: targetPost.authorId, blockedId: me.id },
          { blockerId: me.id, blockedId: targetPost.authorId },
        ],
      },
    });
    if (blockedRel) return res.status(403).json({ error: 'Cannot save this post' });

    await prisma.savedPost.upsert({
      where: { postId_userId: { postId: req.params.postId, userId: me.id } },
      update: {},
      create: { postId: req.params.postId, userId: me.id },
    });

    const count = await prisma.savedPost.count({ where: { postId: req.params.postId } });
    res.json({ saved: true, count });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// Unsave a video post - idempotent
router.delete('/posts/:postId/save', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    await prisma.savedPost.deleteMany({
      where: { postId: req.params.postId, userId: me.id },
    });
    const count = await prisma.savedPost.count({ where: { postId: req.params.postId } });
    res.json({ saved: false, count });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

router.get('/posts/:postId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  if (req.params.postId === 'feed') return next();
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const post = await prisma.post.findUnique({
      where: { id: req.params.postId },
      include: {
        author: { select: AUTHOR_SELECT },
        reactions: { select: REACTION_SELECT },
        savedBy: { select: { userId: true } },
        _count: { select: { reactions: true, replies: true, savedBy: true } },
      },
    });
    if (!post || !canViewPost(post, me.id)) return res.status(404).json({ error: 'Post not found' });

    // Enforce blocking rules
    const blocked = await prisma.block.findFirst({ where: { OR: [ { blockerId: post.authorId, blockedId: me.id }, { blockerId: me.id, blockedId: post.authorId } ] } });
    if (blocked) return res.status(403).json({ error: 'Access to this post is blocked' });

    res.json({ post: formatPost(post as RawPost, me.id) });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});


// ── GET /posts/:postId/replies ────────────────────────────────────────────
router.get('/posts/:postId/replies', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const query = PageQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'Invalid pagination' });
  const { cursor, limit } = query.data;
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    const parent = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!parent || !canViewPost(parent, me.id)) return res.status(404).json({ error: 'Parent post not found' });
    if (!await prisma.user.findFirst({ where: { id: parent.authorId, ...visibleUserWhere(me.id) }, select: { id: true } })) {
      return res.status(403).json({ error: 'Access to this post is blocked' });
    }
    const page = await postPage(me.id, { parentPostId: req.params.postId }, cursor, limit);
    res.json({ replies: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    res.status(error instanceof InvalidCursor ? 400 : 500).json({ error: error instanceof InvalidCursor ? 'Invalid cursor' : 'Failed to load posts' });
  }
});

// ── GET /posts/feed ───────────────────────────────────────────────────────────
router.get('/posts/feed', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const query = PageQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'Invalid pagination' });
  const { cursor, limit } = query.data;
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    const page = await postPage(me.id, { parentPostId: null }, cursor, limit);
    res.json({ posts: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    res.status(error instanceof InvalidCursor ? 400 : 500).json({ error: error instanceof InvalidCursor ? 'Invalid cursor' : 'Failed to load posts' });
  }
});

// ── GET /posts/user/:userId ───────────────────────────────────────────────────
router.get('/posts/user/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const query = PageQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'Invalid pagination' });
  const { cursor, limit } = query.data;
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    const page = await postPage(me.id, { parentPostId: null, authorId: req.params.userId }, cursor, limit);
    res.json({ posts: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    res.status(error instanceof InvalidCursor ? 400 : 500).json({ error: error instanceof InvalidCursor ? 'Invalid cursor' : 'Failed to load posts' });
  }
});

// ── DELETE /posts/:postId ─────────────────────────────────────────────────────
router.delete('/posts/:postId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post || post.authorId !== me.id) return res.status(403).json({ error: 'Forbidden' });
    // Soft-delete
    await prisma.post.update({ where: { id: req.params.postId }, data: { isDeleted: true, deletedAt: new Date() } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── POST /posts/:postId/reactions ─────────────────────────────────────────────
router.post('/posts/:postId/reactions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ emoji: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    // Validate post
    const targetPost = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!targetPost || !canViewPost(targetPost, me.id)) return res.status(404).json({ error: 'Post not found' });
    const blockedRel = await prisma.block.findFirst({ where: { OR: [ { blockerId: targetPost.authorId, blockedId: me.id }, { blockerId: me.id, blockedId: targetPost.authorId } ] } });
    if (blockedRel) return res.status(403).json({ error: 'Cannot react to this post' });

    try {
      await prisma.postReaction.upsert({
        where: {
          postId_userId_emoji: {
            postId: req.params.postId,
            userId: me.id,
            emoji: parsed.data.emoji,
          },
        },
        update: {},
        create: {
          postId: req.params.postId,
          userId: me.id,
          emoji: parsed.data.emoji,
        },
      });
    } catch (err) {
      if (hasPrismaCode(err, 'P2003')) {
        return res.status(404).json({ error: 'Post not found' });
      }
      throw err;
    }
    const count = await prisma.postReaction.count({ where: { postId: req.params.postId } });

    // Notify post author
    const post = await prisma.post.findUnique({ where: { id: req.params.postId }, select: { authorId: true } });
    if (post && post.authorId !== me.id) {
      const notif = await prisma.notification.create({ data: { userId: post.authorId, type: 'POST_LIKED', actorId: me.id, postId: req.params.postId } });
      const actor = await prisma.user.findUnique({ where: { id: me.id }, select: AUTHOR_SELECT });
      emitNotification(post.authorId, { ...notif, actor });
    }

    res.json({ reacted: true, count });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── POST /follow/:userId ──────────────────────────────────────────────────────
router.post('/follow/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (me.id === req.params.userId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const [target, blocked] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true } }),
      prisma.block.findFirst({ where: { OR: [ { blockerId: me.id, blockedId: req.params.userId }, { blockerId: req.params.userId, blockedId: me.id } ] } }),
    ]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (blocked) return res.status(403).json({ error: 'Cannot follow due to block relationship' });

    const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: req.params.userId } } }).catch(() => null);
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId: req.params.userId } },
      update: {},
      create: { followerId: me.id, followingId: req.params.userId },
    });

    if (!existing) {
      const notif = await prisma.notification.create({ data: { userId: req.params.userId, type: 'NEW_FOLLOWER', actorId: me.id } });
      const actor = await prisma.user.findUnique({ where: { id: me.id }, select: AUTHOR_SELECT });
      emitNotification(req.params.userId, { ...notif, actor });
    }

    res.json({ following: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── DELETE /follow/:userId ────────────────────────────────────────────────────
router.delete('/follow/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    await prisma.follow.deleteMany({
      where: { followerId: me.id, followingId: req.params.userId },
    });
    res.json({ following: false });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});


// ── POST /block/:userId ─────────────────────────────────────────────────────
router.post('/block/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (me.id === req.params.userId) return res.status(400).json({ error: 'Cannot block yourself' });
    const target = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    await blockUser(me.id, req.params.userId);

    res.json({ blocked: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});


// ── DELETE /block/:userId ───────────────────────────────────────────────────
router.delete('/block/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    await prisma.block.deleteMany({ where: { blockerId: me.id, blockedId: req.params.userId } });
    res.json({ blocked: false });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});


// ── POST /reports ───────────────────────────────────────────────────────────
router.post('/reports', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ reportedId: z.string(), reason: z.enum(['INAPPROPRIATE_CONTENT','HARASSMENT','FAKE_PROFILE','SPAM','UNDERAGE','OTHER']), description: z.string().max(1000).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (me.id === parsed.data.reportedId) return res.status(400).json({ error: 'Cannot report yourself' });
    const target = await prisma.user.findUnique({ where: { id: parsed.data.reportedId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const report = await prisma.report.create({ data: { reporterId: me.id, reportedId: parsed.data.reportedId, reason: parsed.data.reason as any, description: parsed.data.description } });
    res.status(201).json({ report });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── GET /followers ────────────────────────────────────────────────────────────
router.get('/followers', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const followers = await prisma.follow.findMany({
      where: { followingId: me.id },
      include: { follower: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ followers: followers.map((f) => f.follower) });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── GET /following ────────────────────────────────────────────────────────────
router.get('/following', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const following = await prisma.follow.findMany({
      where: { followerId: me.id },
      include: { following: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ following: following.map((f) => f.following) });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── GET /users/:userId/follow-status ─────────────────────────────────────────
router.get('/users/:userId/follow-status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const [isFollowing, followerCount, followingCount] = await Promise.all([
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: req.params.userId } } }),
      prisma.follow.count({ where: { followingId: req.params.userId } }),
      prisma.follow.count({ where: { followerId: req.params.userId } }),
    ]);
    res.json({ isFollowing: !!isFollowing, followerCount, followingCount });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── GET /notifications ────────────────────────────────────────────────────────
router.get('/notifications', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const notifications = await prisma.notification.findMany({
      where: { userId: me.id },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });

    // Fetch actor info
    const actorIds = [...new Set(notifications.map((n) => n.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: AUTHOR_SELECT })
      : [];
    const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

    res.json({ notifications: notifications.map((n) => ({ ...n, actor: n.actorId ? actorMap[n.actorId] : null })) });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── PUT /notifications/read-all ───────────────────────────────────────────────
router.put('/notifications/read-all', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    await prisma.notification.updateMany({ where: { userId: me.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── PUT /notifications/:id/read ───────────────────────────────────────────────
router.put('/notifications/:id/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    const updated = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: me.id }, data: { isRead: true },
    });
    if (!updated.count) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── GET /notifications/unread-count ──────────────────────────────────────────
router.get('/notifications/unread-count', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: activeUserIdentityWhere(req.user!.uid), select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const count = await prisma.notification.count({ where: { userId: me.id, isRead: false } });
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: 'Request could not be completed' });
  }
});

// ── helpers ───────────────────────────────────────────────────────────────────
type RawPost = {
  id: string; authorId: string; videoUrl: string;
  caption: string | null; thumbnailUrl?: string | null; createdAt: Date; updatedAt: Date;
  parentPostId?: string | null;
  author: { id: string; firstName: string; profilePictures: string[]; isVerified: boolean; profileVideo?: string | null };
  reactions: { emoji: string; userId: string }[];
  savedBy?: { userId: string }[];
  _count: { reactions: number; replies: number; savedBy?: number };
};

function formatPost(p: RawPost, myId: string) {
  const reactions = p.reactions.reduce<Record<string, number>>((counts, reaction) => {
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
    return counts;
  }, {});
  const viewerReactions = p.reactions
    .filter((reaction) => reaction.userId === myId)
    .map((reaction) => reaction.emoji);
  const savedBy = p.savedBy ?? [];

  return {
    id: p.id, authorId: p.authorId, author: p.author,
    videoUrl: p.videoUrl, thumbnailUrl: p.thumbnailUrl ?? undefined,
    caption: p.caption ?? undefined,
    reactionCount: p._count.reactions,
    reactions,
    viewerReactions,
    saveCount: p._count.savedBy ?? savedBy.length,
    isSaved: savedBy.some((save) => save.userId === myId),
    replyCount: p._count.replies,
    parentPostId: p.parentPostId ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;
