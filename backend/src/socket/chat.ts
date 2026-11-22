import { Server as SocketServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../middleware/auth';
import { accessibleMatchWhere, getAccessibleMatch } from '../lib/access';
import { ageInYears } from '../lib/profiles';
import { sendChatMessage, ChatError } from '../lib/chat';
import { setIo } from '../lib/io';

const onlineUsers = new Map<string, Set<string>>();
const validMatchId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;

async function publishPresence(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { preferences: { select: { showLastActive: true } } },
  });
  if (user?.preferences?.showLastActive === false) return;
  const matches = await prisma.match.findMany({
    where: accessibleMatchWhere(userId), select: { user1Id: true, user2Id: true },
  });
  return matches.map(match => match.user1Id === userId ? match.user2Id : match.user1Id);
}

export function initSocket(io: SocketServer) {
  setIo(io);
  io.use(async (socket, next) => {
    try {
      const identity = await verifyAccessToken(socket.handshake.auth?.token);
      const user = await prisma.user.findUnique({
        where: { firebaseUid: identity.uid },
        select: { id: true, isActive: true, dateOfBirth: true },
      });
      if (!user?.isActive || ageInYears(user.dateOfBirth) < 18) throw new Error('Unavailable account');
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    const connections = onlineUsers.get(userId) ?? new Set<string>();
    connections.add(socket.id);
    onlineUsers.set(userId, connections);
    socket.join('user:' + userId);

    async function presence(online: boolean) {
      try {
        await prisma.user.update({ where: { id: userId }, data: { lastActive: new Date() } });
        const recipients = await publishPresence(userId);
        for (const id of recipients ?? []) io.to('user:' + id).emit(online ? 'user:online' : 'user:offline', { userId });
      } catch { /* Presence failure must not crash chat. */ }
    }
    if (connections.size === 1) void presence(true);

    let windowStarted = Date.now();
    let eventCount = 0;
    function withinLimit() {
      if (Date.now() - windowStarted > 10_000) { windowStarted = Date.now(); eventCount = 0; }
      return ++eventCount <= 100;
    }

    socket.on('match:join', async (matchId: unknown) => {
      if (!validMatchId(matchId) || !withinLimit()) return;
      try { if (await getAccessibleMatch(userId, matchId)) await socket.join('match:' + matchId); } catch { /* retry on reconnect */ }
    });
    socket.on('match:leave', (matchId: unknown) => {
      if (validMatchId(matchId)) socket.leave('match:' + matchId);
    });

    socket.on('message:send', async (payload: unknown, callback?: unknown) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      if (!withinLimit()) return ack({ ok: false, error: 'Too many requests' });
      try {
        const message = await sendChatMessage(userId, payload);
        ack({ ok: true, message });
      } catch (error) {
        ack({ ok: false, error: error instanceof ChatError ? error.message : 'Failed to send message' });
      }
    });

    for (const event of ['typing:start', 'typing:stop']) {
      socket.on(event, async (matchId: unknown) => {
        if (!validMatchId(matchId) || !withinLimit()) return;
        try {
          if (await getAccessibleMatch(userId, matchId)) socket.to('match:' + matchId).emit(event, { userId, matchId });
        } catch { /* Do not broadcast on an authorization lookup failure. */ }
      });
    }
    socket.on('messages:read', async (matchId: unknown) => {
      if (!validMatchId(matchId) || !withinLimit()) return;
      try {
        if (!await getAccessibleMatch(userId, matchId)) return;
        await prisma.message.updateMany({
          where: { matchId, receiverId: userId, isRead: false }, data: { isRead: true },
        });
        socket.to('match:' + matchId).emit('messages:read', { matchId, readBy: userId });
      } catch { /* Do not emit receipts if authorization or persistence fails. */ }
    });
    socket.on('disconnect', () => {
      connections.delete(socket.id);
      if (!connections.size) { onlineUsers.delete(userId); void presence(false); }
    });
  });
}

export function isUserOnline(userId: string): boolean { return !!onlineUsers.get(userId)?.size; }
