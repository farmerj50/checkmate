import { z } from 'zod';
import { prisma } from './prisma';
import { getAccessibleMatch } from './access';
import { messageSenderSelect } from './profiles';
import { io } from './io';
import { notifyNewMessage } from './notifications';

export const MessageInput = z.object({
  matchId: z.string().min(1).max(128),
  content: z.string().trim().min(1).max(2000),
  messageType: z.enum(['TEXT', 'IMAGE', 'GIF', 'EMOJI', 'VIDEO']).default('TEXT'),
}).refine(value => !['IMAGE', 'GIF', 'VIDEO'].includes(value.messageType) || z.url({ protocol: /^https?$/ }).safeParse(value.content).success, {
  message: 'Media messages require an HTTP or HTTPS URL', path: ['content'],
});

export class ChatError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function sendChatMessage(userId: string, input: unknown) {
  const parsed = MessageInput.safeParse(input);
  if (!parsed.success) throw new ChatError(400, 'Invalid message');
  const { matchId, content, messageType } = parsed.data;
  const match = await getAccessibleMatch(userId, matchId);
  if (!match) throw new ChatError(403, 'Match not found');
  const judge = await prisma.judgeSession.findUnique({ where: { matchId } });
  if (judge && ['COOLDOWN', 'PAUSED'].includes(judge.status)) {
    throw new ChatError(409, 'Interaction is paused');
  }
  const receiverId = match.user1Id === userId ? match.user2Id : match.user1Id;
  const message = await prisma.message.create({
    data: { matchId, senderId: userId, receiverId, content, messageType },
    include: { sender: { select: messageSenderSelect } },
  });
  io?.to(`match:${matchId}`).emit('message:new', message);
  io?.to(`user:${receiverId}`).emit('message:badge', { matchId, senderId: userId, content });
  void notifyNewMessage(receiverId, message.sender.firstName, content, matchId).catch(() => {});
  if (judge && ['ACTIVE', 'TIER1_NOTICE'].includes(judge.status)) {
    // Both REST and Socket.IO use this path. Review failures must not fail a saved message.
    void (async () => {
      const count = await prisma.message.count({ where: { matchId } });
      if (count % 10 === 0) {
        const { evaluateConversation } = await import('../routes/judge');
        await evaluateConversation(matchId);
      }
    })().catch(() => {});
  }
  return message;
}
