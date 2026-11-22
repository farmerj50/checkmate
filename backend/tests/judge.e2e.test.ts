import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: provider.create } }; } }));
import { prisma } from '../src/lib/prisma';
import { evaluateConversation } from '../src/routes/judge';
import { resetDb, createUser, authHeader, A, B, request, app } from './test.helpers';

describe('Judge concurrent state changes', () => {
  beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });
  afterEach(() => { process.env.OPENAI_API_KEY = ''; });

  async function fixture() {
    const a = await createUser(A, 'Alice'); const b = await createUser(B, 'Bob');
    const match = await prisma.match.create({ data: { user1Id: a!.id, user2Id: b!.id } });
    const session = await prisma.judgeSession.create({ data: {
      matchId: match.id, requestedById: a!.id, status: 'ACTIVE', userAApproved: true, userBApproved: true,
    } });
    await prisma.message.createMany({ data: Array.from({ length: 4 }, () => ({ matchId: match.id, senderId: a!.id, receiverId: b!.id, content: 'fixture' })) });
    return { match, session };
  }

  it.each([1, 2])('cannot overwrite a cooldown with a late tier %s evaluation', async tier => {
    const { match, session } = await fixture();
    process.env.OPENAI_API_KEY = 'local-fixture-no-network';
    provider.create.mockImplementation(async () => {
      await prisma.judgeSession.update({ where: { id: session.id }, data: { status: 'COOLDOWN', cooldownEndsAt: new Date(Date.now() + 60_000) } });
      return { choices: [{ message: { content: JSON.stringify({ tier, confidenceLevel: 'HIGH', reason: 'Fixture' }) } }] };
    });
    await evaluateConversation(match.id);
    expect(provider.create).toHaveBeenCalledTimes(1);
    expect((await prisma.judgeSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe('COOLDOWN');
    expect(await prisma.judgeEvent.count({ where: { sessionId: session.id } })).toBe(0);
  });

  it('resumes after both participants vote concurrently', async () => {
    const { match, session } = await fixture();
    await prisma.judgeSession.update({ where: { id: session.id }, data: { status: 'PAUSED' } });
    const votes = await Promise.all([A, B].map(token => request(app).post(`/api/matches/${match.id}/judge/continue`).set(authHeader(token))));
    expect(votes.every(result => result.status === 200)).toBe(true);
    expect((await prisma.judgeSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe('ACTIVE');
  });
});
