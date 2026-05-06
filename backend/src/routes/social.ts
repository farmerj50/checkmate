/**
 * SOCIAL API LAYER
 * Handles all social media functionality — posts, likes, comments, follows, notifications.
 * Completely separate from the dating/matching system.
 * DO NOT modify Match or Like (dating). PostLike is separate from dating Like.
 */
import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { io } from '../lib/io';

const router = express.Router();

const AUTHOR_SELECT = {
  id: true, firstName: true, profilePictures: true, isVerified: true, profileVideo: true,
};

function emitNotification(userId: string, payload: object) {
  try { io?.to(`user:${userId}`).emit('notification:new', payload); } catch { /* silent */ }
}

// ── POST /posts ───────────────────────────────────────────────────────────────
router.post('/posts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    mediaUrl: z.string().url(),
    mediaType: z.enum(['VIDEO', 'IMAGE']).default('VIDEO'),
    caption: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const post = await prisma.post.create({
      data: { authorId: me.id, ...parsed.data },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: me.id }, select: { id: true } },
      },
    });
    res.status(201).json({ post: formatPost(post, me.id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /posts/feed ───────────────────────────────────────────────────────────
router.get('/posts/feed', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const cursor = req.query.cursor as string | undefined;
    const limit  = 20;

    // Users I follow
    const follows = await prisma.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } });
    const followingIds = follows.map((f) => f.followingId);

    // Posts from followed users + own posts
    const followedPosts = await prisma.post.findMany({
      where: {
        authorId: { in: [...followingIds, me.id] },
        ...(cursor ? { createdAt: { lt: (await prisma.post.findUnique({ where: { id: cursor }, select: { createdAt: true } }))?.createdAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: me.id }, select: { id: true } },
      },
    });

    // Discovery pool — non-followed, recent 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const discoveryPosts = followedPosts.length < limit
      ? await prisma.post.findMany({
          where: {
            authorId: { notIn: [...followingIds, me.id] },
            createdAt: { gte: sevenDaysAgo },
          },
          orderBy: { likes: { _count: 'desc' } },
          take: limit - followedPosts.length,
          include: {
            author: { select: AUTHOR_SELECT },
            _count: { select: { likes: true, comments: true } },
            likes: { where: { userId: me.id }, select: { id: true } },
          },
        })
      : [];

    const posts = [...followedPosts, ...discoveryPosts].map((p) => formatPost(p, me.id));
    res.json({ posts, nextCursor: posts[posts.length - 1]?.id ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /posts/user/:userId ───────────────────────────────────────────────────
router.get('/posts/user/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const posts = await prisma.post.findMany({
      where: { authorId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: me.id }, select: { id: true } },
      },
    });
    res.json({ posts: posts.map((p) => formatPost(p, me.id)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /posts/:postId ─────────────────────────────────────────────────────
router.delete('/posts/:postId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post || post.authorId !== me.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.post.delete({ where: { id: req.params.postId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /posts/:postId/like (toggle) ─────────────────────────────────────────
router.post('/posts/:postId/like', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: req.params.postId, userId: me.id } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      const count = await prisma.postLike.count({ where: { postId: req.params.postId } });
      return res.json({ liked: false, count });
    }

    await prisma.postLike.create({ data: { postId: req.params.postId, userId: me.id } });
    const count = await prisma.postLike.count({ where: { postId: req.params.postId } });

    // Notify post author
    const post = await prisma.post.findUnique({ where: { id: req.params.postId }, select: { authorId: true } });
    if (post && post.authorId !== me.id) {
      const notif = await prisma.notification.create({
        data: { userId: post.authorId, type: 'POST_LIKED', actorId: me.id, postId: req.params.postId },
      });
      const actor = await prisma.user.findUnique({ where: { id: me.id }, select: AUTHOR_SELECT });
      emitNotification(post.authorId, { ...notif, actor });
    }

    res.json({ liked: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /posts/:postId/likes ──────────────────────────────────────────────────
router.get('/posts/:postId/likes', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const [count, mine] = await Promise.all([
      prisma.postLike.count({ where: { postId: req.params.postId } }),
      prisma.postLike.findUnique({ where: { postId_userId: { postId: req.params.postId, userId: me.id } } }),
    ]);
    res.json({ count, isLikedByMe: !!mine });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /posts/:postId/comments ──────────────────────────────────────────────
router.post('/posts/:postId/comments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ content: z.string().min(1).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const comment = await prisma.comment.create({
      data: { postId: req.params.postId, authorId: me.id, content: parsed.data.content },
      include: { author: { select: AUTHOR_SELECT } },
    });

    // Notify post author
    const post = await prisma.post.findUnique({ where: { id: req.params.postId }, select: { authorId: true } });
    if (post && post.authorId !== me.id) {
      const notif = await prisma.notification.create({
        data: { userId: post.authorId, type: 'POST_COMMENTED', actorId: me.id, postId: req.params.postId, commentId: comment.id },
      });
      emitNotification(post.authorId, { ...notif, actor: comment.author, preview: parsed.data.content.slice(0, 60) });
    }

    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /posts/:postId/comments ───────────────────────────────────────────────
router.get('/posts/:postId/comments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const cursor = req.query.cursor as string | undefined;
    const comments = await prisma.comment.findMany({
      where: {
        postId: req.params.postId,
        ...(cursor ? { createdAt: { lt: (await prisma.comment.findUnique({ where: { id: cursor }, select: { createdAt: true } }))?.createdAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { author: { select: AUTHOR_SELECT } },
    });
    res.json({ comments, nextCursor: comments[comments.length - 1]?.id ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /posts/:postId/comments/:id ────────────────────────────────────────
router.delete('/posts/:postId/comments/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment || comment.authorId !== me.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /follow/:userId ──────────────────────────────────────────────────────
router.post('/follow/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (me.id === req.params.userId) return res.status(400).json({ error: 'Cannot follow yourself' });

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId: req.params.userId } },
      update: {},
      create: { followerId: me.id, followingId: req.params.userId },
    });

    const notif = await prisma.notification.create({
      data: { userId: req.params.userId, type: 'NEW_FOLLOWER', actorId: me.id },
    });
    const actor = await prisma.user.findUnique({ where: { id: me.id }, select: AUTHOR_SELECT });
    emitNotification(req.params.userId, { ...notif, actor });

    res.json({ following: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /follow/:userId ────────────────────────────────────────────────────
router.delete('/follow/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    await prisma.follow.deleteMany({
      where: { followerId: me.id, followingId: req.params.userId },
    });
    res.json({ following: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /followers ────────────────────────────────────────────────────────────
router.get('/followers', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const followers = await prisma.follow.findMany({
      where: { followingId: me.id },
      include: { follower: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ followers: followers.map((f) => f.follower) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /following ────────────────────────────────────────────────────────────
router.get('/following', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const following = await prisma.follow.findMany({
      where: { followerId: me.id },
      include: { following: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ following: following.map((f) => f.following) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /users/:userId/follow-status ─────────────────────────────────────────
router.get('/users/:userId/follow-status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const [isFollowing, followerCount, followingCount] = await Promise.all([
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: req.params.userId } } }),
      prisma.follow.count({ where: { followingId: req.params.userId } }),
      prisma.follow.count({ where: { followerId: req.params.userId } }),
    ]);
    res.json({ isFollowing: !!isFollowing, followerCount, followingCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /notifications ────────────────────────────────────────────────────────
router.get('/notifications', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
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
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /notifications/read-all ───────────────────────────────────────────────
router.put('/notifications/read-all', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    await prisma.notification.updateMany({ where: { userId: me.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /notifications/:id/read ───────────────────────────────────────────────
router.put('/notifications/:id/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /notifications/unread-count ──────────────────────────────────────────
router.get('/notifications/unread-count', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!me) return res.status(404).json({ error: 'User not found' });

    const count = await prisma.notification.count({ where: { userId: me.id, isRead: false } });
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── helpers ───────────────────────────────────────────────────────────────────
type RawPost = {
  id: string; authorId: string; mediaUrl: string; mediaType: string;
  caption: string | null; createdAt: Date; updatedAt: Date;
  author: { id: string; firstName: string; profilePictures: string[]; isVerified: boolean; profileVideo?: string | null };
  _count: { likes: number; comments: number };
  likes: { id: string }[];
};

function formatPost(p: RawPost, myId: string) {
  return {
    id: p.id, authorId: p.authorId, author: p.author,
    mediaUrl: p.mediaUrl, mediaType: p.mediaType,
    caption: p.caption ?? undefined,
    likeCount: p._count.likes, commentCount: p._count.comments,
    isLikedByMe: p.likes.length > 0,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;
