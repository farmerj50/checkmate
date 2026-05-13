import { Server as SocketServer, Socket } from 'socket.io';
import admin from 'firebase-admin';
import { prisma } from '../lib/prisma';
import { evaluateConversation } from '../routes/judge';

// Map firebaseUid → socketId for online presence
const onlineUsers = new Map<string, string>();

async function getUserFromSocket(socket: Socket): Promise<string | null> {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return null;

    // Real Firebase verification if initialized
    if (admin.apps.length && admin.app().options.projectId) {
      const decoded = await admin.auth().verifyIdToken(token);
      return decoded.uid;
    }

    // Demo mode: token is the uid
    return token.startsWith('demo_') ? token : 'demo_user';
  } catch {
    return null;
  }
}

export function initSocket(io: SocketServer) {
  io.on('connection', async (socket: Socket) => {
    const uid = await getUserFromSocket(socket);

    if (!uid) {
      socket.disconnect(true);
      return;
    }

    // Look up DB user
    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: { id: true },
    });

    if (!dbUser) {
      socket.disconnect(true);
      return;
    }

    const userId = dbUser.id;

    // Register online
    onlineUsers.set(userId, socket.id);
    await prisma.user.update({ where: { id: userId }, data: { lastActive: new Date() } });
    io.emit('user:online', { userId });

    // Personal room so we can push per-user events (e.g. badge notifications)
    socket.join(`user:${userId}`);

    // ── Join match room ──────────────────────────────────────────
    socket.on('match:join', async (matchId: string) => {
      // Verify user belongs to this match
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          OR: [{ user1Id: userId }, { user2Id: userId }],
          isActive: true,
        },
      });
      if (match) socket.join(`match:${matchId}`);
    });

    socket.on('match:leave', (matchId: string) => {
      socket.leave(`match:${matchId}`);
    });

    // ── Send message ─────────────────────────────────────────────
    socket.on(
      'message:send',
      async (
        payload: { matchId: string; content: string; messageType?: string },
        ack?: (response: { ok: boolean; message?: object; error?: string }) => void
      ) => {
        try {
          const { matchId, content, messageType = 'TEXT' } = payload;

          if (!content?.trim()) {
            ack?.({ ok: false, error: 'Empty message' });
            return;
          }

          const match = await prisma.match.findFirst({
            where: {
              id: matchId,
              OR: [{ user1Id: userId }, { user2Id: userId }],
              isActive: true,
            },
          });

          if (!match) {
            ack?.({ ok: false, error: 'Match not found' });
            return;
          }

          // Block messages during judge cooldown
          const judgeCheck = await prisma.judgeSession.findUnique({
            where: { matchId },
            select: { status: true },
          });
          if (judgeCheck?.status === 'COOLDOWN') {
            ack?.({ ok: false, error: 'Interaction is in cooldown' });
            return;
          }

          const receiverId = match.user1Id === userId ? match.user2Id : match.user1Id;

          const message = await prisma.message.create({
            data: {
              matchId,
              senderId: userId,
              receiverId,
              content: content.trim(),
              messageType: messageType as any,
            },
            include: { sender: true },
          });

          // Broadcast to everyone in the match room (including sender for confirmation)
          io.to(`match:${matchId}`).emit('message:new', message);

          // Also notify the receiver's personal room so badge counts update
          io.to(`user:${receiverId}`).emit('message:badge', {
            matchId,
            senderId: userId,
            content: message.content,
          });

          // Auto-evaluate conversation every 10 messages when judge is active
          if (judgeCheck && ['ACTIVE', 'TIER1_NOTICE'].includes(judgeCheck.status)) {
            const msgCount = await prisma.message.count({ where: { matchId } });
            if (msgCount % 10 === 0) {
              evaluateConversation(matchId); // fire and forget
            }
          }

          ack?.({ ok: true, message });
        } catch (err) {
          console.error('Socket message:send error:', err);
          ack?.({ ok: false, error: 'Failed to send message' });
        }
      }
    );

    // ── Typing indicators ────────────────────────────────────────
    socket.on('typing:start', (matchId: string) => {
      socket.to(`match:${matchId}`).emit('typing:start', { userId, matchId });
    });

    socket.on('typing:stop', (matchId: string) => {
      socket.to(`match:${matchId}`).emit('typing:stop', { userId, matchId });
    });

    // ── Read receipts ────────────────────────────────────────────
    socket.on('messages:read', async (matchId: string) => {
      await prisma.message.updateMany({
        where: { matchId, senderId: { not: userId }, isRead: false },
        data: { isRead: true },
      });
      socket.to(`match:${matchId}`).emit('messages:read', { matchId, readBy: userId });
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await prisma.user.update({ where: { id: userId }, data: { lastActive: new Date() } });
      io.emit('user:offline', { userId });
    });
  });
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}
