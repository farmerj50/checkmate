import { activeUserIdentityWhere } from '../lib/access';
import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { getAccessibleMatch } from '../lib/access';
import { sendChatMessage, ChatError } from '../lib/chat';
import { messageSenderSelect } from '../lib/profiles';

const router = express.Router();
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid), select: { id: true },
    });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    const message = await sendChatMessage(currentUser.id, req.body);
    return res.json({ message });
  } catch (error) {
    return res.status(error instanceof ChatError ? error.status : 500)
      .json({ error: error instanceof ChatError ? error.message : 'Failed to send message' });
  }
});

router.get('/:matchId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const paging = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    }).safeParse(req.query);
    if (!paging.success) return res.status(400).json({ error: 'Invalid pagination' });
    const user = await prisma.user.findUnique({
      where: activeUserIdentityWhere(req.user!.uid), select: { id: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { matchId } = req.params;
    if (!await getAccessibleMatch(user.id, matchId)) return res.status(403).json({ error: 'Match not found' });
    const messages = await prisma.message.findMany({
      where: { matchId }, include: { sender: { select: messageSenderSelect } },
      orderBy: { createdAt: 'desc' }, skip: (paging.data.page - 1) * paging.data.limit, take: paging.data.limit,
    });
    await prisma.message.updateMany({
      where: { matchId, receiverId: user.id, isRead: false }, data: { isRead: true },
    });
    return res.json({ messages: messages.reverse() });
  } catch {
    return res.status(500).json({ error: 'Failed to get messages' });
  }
});
export default router;
