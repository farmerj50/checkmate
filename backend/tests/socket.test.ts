import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  match: { findFirst: vi.fn(), findMany: vi.fn() },
  // Database-backed tests cover Judge persistence; this suite exercises transport guards.
  judgeSession: { findUnique: vi.fn() },
  message: { create: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
vi.mock('../src/routes/judge', () => ({ evaluateConversation: vi.fn() }));
vi.mock('../src/lib/notifications', () => ({ notifyNewMessage: vi.fn().mockResolvedValue(undefined) }));
import { initSocket } from '../src/socket/chat';

describe('Socket.IO dependency compatibility', () => {
  const clients: Socket[] = [];
  const http = createServer();
  const server = new Server(http);
  let url: string;
  let firebase: ReturnType<typeof initializeApp>;

  beforeAll(async () => {
    firebase = initializeApp({ projectId: 'unit-socket-project' });
    vi.spyOn(getAuth(firebase), 'verifyIdToken').mockImplementation(async token => {
      if (token !== 'fixture-token') throw new Error('Invalid fixture token');
      return { uid: 'fixture-uid' } as DecodedIdToken;
    });
    db.user.findUnique.mockResolvedValue({ id: 'sender', isActive: true, dateOfBirth: new Date('1990-01-01') });
    db.user.update.mockResolvedValue({});
    db.match.findMany.mockResolvedValue([]);
    db.match.findFirst.mockImplementation(async ({ where }) =>
      where.id === 'allowed-match' ? { id: where.id, user1Id: 'sender', user2Id: 'receiver' } : null);
    db.judgeSession.findUnique.mockResolvedValue(null);
    db.message.create.mockImplementation(async ({ data }) => ({ id: 'message-id', ...data, sender: { id: 'sender', firstName: 'Sender' } }));
    db.message.updateMany.mockResolvedValue({ count: 1 });
    initSocket(server);
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.disconnect();
  });
  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    vi.restoreAllMocks();
    await deleteApp(firebase);
  });

  async function clientFor(transport: 'websocket' | 'polling') {
    const client = connect(url, {
      transports: [transport], auth: { token: 'fixture-token' },
      autoConnect: false, reconnection: false,
    });
    clients.push(client);
    const online = new Promise<void>(resolve => client.once('connect', () => resolve()));
    client.connect();
    await online;
    return client;
  }

  it.each(['websocket', 'polling'] as const)('delivers and acknowledges messages over %s', async transport => {
    const client = await clientFor(transport);
    client.emit('match:join', 'allowed-match');
    await vi.waitFor(() => expect(server.sockets.sockets.get(client.id!)?.rooms.has('match:allowed-match')).toBe(true));
    const delivered = new Promise<object>(resolve => client.once('message:new', resolve));
    const ack = await client.timeout(2000).emitWithAck('message:send', {
      matchId: 'allowed-match', content: ' hello ',
    });
    expect(ack).toMatchObject({ ok: true, message: { content: 'hello', senderId: 'sender' } });
    expect(await delivered).toMatchObject({ id: 'message-id', matchId: 'allowed-match', content: 'hello' });
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { firebaseUid: 'fixture-uid' }, select: { id: true, isActive: true, dateOfBirth: true } });
  });

  it('rejects message sends to a match the user cannot access', async () => {
    const client = await clientFor('websocket');
    const before = db.message.create.mock.calls.length;
    const ack = await client.timeout(2000).emitWithAck('message:send', {
      matchId: 'forbidden-match', content: 'hello',
    });
    expect(ack).toEqual({ ok: false, error: 'Match not found' });
    expect(db.message.create).toHaveBeenCalledTimes(before);
  });

  it('disconnects clients whose Firebase token is invalid', async () => {
    const client = connect(url, {
      transports: ['websocket'], auth: { token: 'invalid' }, autoConnect: false, reconnection: false,
    });
    clients.push(client);
    const disconnected = new Promise<Error>(resolve => client.once('connect_error', resolve));
    client.connect();
    expect((await disconnected).message).toBe('Authentication required');
  });

  it('rejects malformed payloads and paused conversations without persisting messages', async () => {
    const client = await clientFor('websocket');
    const before = db.message.create.mock.calls.length;
    for (const payload of [null, {}, { matchId: 'allowed-match', content: 'a'.repeat(2001) }, { matchId: 'allowed-match', content: 'javascript:alert(1)', messageType: 'VIDEO' }]) {
      expect(await client.timeout(2000).emitWithAck('message:send', payload)).toMatchObject({ ok: false });
    }
    db.judgeSession.findUnique.mockResolvedValueOnce({ status: 'COOLDOWN' });
    expect(await client.timeout(2000).emitWithAck('message:send', { matchId: 'allowed-match', content: 'hello' }))
      .toEqual({ ok: false, error: 'Interaction is paused' });
    expect(db.message.create).toHaveBeenCalledTimes(before);
  });

  it('checks access for typing and receipts and updates only received messages', async () => {
    const client = await clientFor('websocket');
    db.match.findFirst.mockClear(); db.message.updateMany.mockClear();
    client.emit('typing:start', 'forbidden-match');
    client.emit('typing:stop', 'forbidden-match');
    client.emit('messages:read', 'forbidden-match');
    // A following acknowledged message lets the prior event handlers complete.
    await client.timeout(2000).emitWithAck('message:send', { matchId: 'allowed-match', content: 'barrier' });
    expect(db.match.findFirst.mock.calls.filter(([arg]) => arg.where.id === 'forbidden-match')).toHaveLength(3);
    expect(db.message.updateMany).not.toHaveBeenCalled();
    client.emit('messages:read', 'allowed-match');
    await vi.waitFor(() => expect(db.message.updateMany).toHaveBeenCalledWith({
      where: { matchId: 'allowed-match', receiverId: 'sender', isRead: false }, data: { isRead: true },
    }));
    expect(db.match.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isActive: true, OR: [{ user1Id: 'sender' }, { user2Id: 'sender' }], user1: expect.objectContaining({ NOT: expect.any(Array) }), user2: expect.objectContaining({ NOT: expect.any(Array) }) }),
    }));
  });
});
