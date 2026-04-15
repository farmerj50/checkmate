import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { notifyNewMessage } from '../lib/notifications';

const router = express.Router();

const SendMessageSchema = z.object({
  matchId: z.string().min(1),
  content: z.string().min(1).max(2000),
  messageType: z.enum(['TEXT', 'IMAGE', 'GIF', 'EMOJI', 'VIDEO']).optional().default('VIDEO'),
});

// Send message
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = SendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { matchId, content, messageType } = parsed.data;

    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ user1Id: currentUser.id }, { user2Id: currentUser.id }],
        isActive: true,
      },
    });

    if (!match) {
      return res.status(403).json({ error: 'Not authorized to send message to this match' });
    }

    const receiverId =
      match.user1Id === currentUser.id ? match.user2Id : match.user1Id;

    const message = await prisma.message.create({
      data: {
        matchId,
        senderId: currentUser.id,
        receiverId,
        content,
        messageType,
      },
      include: { sender: true },
    });

    // Fire-and-forget push to receiver
    notifyNewMessage(
      receiverId,
      currentUser.firstName,
      content,
      matchId
    ).catch(() => {});

    res.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages for a match (paginated, chronological)
router.get('/:matchId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;
    const limitNum = Math.min(Number(req.query.limit ?? 50), 100);
    const pageNum = Math.max(Number(req.query.page ?? 1), 1);

    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ user1Id: currentUser.id }, { user2Id: currentUser.id }],
      },
    });

    if (!match) {
      return res.status(403).json({ error: 'Not authorized to view messages for this match' });
    }

    const messages = await prisma.message.findMany({
      where: { matchId },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    // Mark incoming messages as read
    await prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: currentUser.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

export default router;
