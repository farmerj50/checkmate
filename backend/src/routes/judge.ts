import express from 'express';
import OpenAI from 'openai';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { io } from '../lib/io';

const router = express.Router();

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith('sk-your')) return null;
  return new OpenAI({ apiKey: key });
}

const EVAL_SYSTEM_PROMPT = `You are CheckMate Resolve — a neutral AI mediator. Evaluate the conversation for:
- Tier 1 (notice): Emotional escalation, raised tension, minor hostility, communication slowing
- Tier 2 (recommendation): Repeated hostility, circular arguments, bad-faith responses, no progress, threats

Respond ONLY with valid JSON: { "tier": 0 | 1 | 2, "confidenceLevel": "LOW" | "MEDIUM" | "HIGH", "reason": string | null }

Rules:
- tier 0: conversation is fine, reason must be null
- tier 1: gentle notice warranted, reason is one calm neutral sentence
- tier 2: recommend pause, reason is one neutral sentence visible to both users
- Never take sides. Never reference specific users by name. Never alter or fabricate messages.
- All interventions are visible to both participants.`;

const SUMMARY_SYSTEM_PROMPT = `You are CheckMate Resolve. Generate a brief neutral post-session summary.
Respond ONLY with valid JSON: { "disagreement": string, "breakdownReason": string, "suggestion": string }
Each field is exactly one neutral sentence. Do not take sides.`;

async function logEvent(
  sessionId: string,
  type: string,
  actorId: string | null,
  metadata?: object
) {
  await prisma.judgeEvent.create({
    data: { sessionId, type, actorId, metadata: metadata ?? undefined },
  });
}

async function getMatchParties(matchId: string, userId: string) {
  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      OR: [{ user1Id: userId }, { user2Id: userId }],
      isActive: true,
    },
  });
  if (!match) return null;
  const isUser1 = match.user1Id === userId;
  const otherId = isUser1 ? match.user2Id : match.user1Id;
  return { match, isUser1, otherId };
}

export async function evaluateConversation(matchId: string) {
  try {
    const session = await prisma.judgeSession.findUnique({ where: { matchId } });
    if (!session || !['ACTIVE', 'TIER1_NOTICE'].includes(session.status)) return;

    const openai = getOpenAI();
    if (!openai) return;

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { sender: { select: { firstName: true } } },
    });

    if (messages.length < 4) return;

    const transcript = messages
      .reverse()
      .map((m) => `${m.sender.firstName}: ${m.content}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        { role: 'system', content: EVAL_SYSTEM_PROMPT },
        { role: 'user', content: `Evaluate this conversation:\n\n${transcript}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const result = JSON.parse(text) as {
      tier: 0 | 1 | 2;
      confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      reason: string | null;
    };

    if (result.tier === 1 && session.tier < 1) {
      await prisma.judgeSession.update({
        where: { matchId },
        data: { tier: 1, status: 'TIER1_NOTICE' },
      });
      io.to(`match:${matchId}`).emit('judge:notice', {
        reason: result.reason,
        confidenceLevel: result.confidenceLevel,
      });
      await logEvent(session.id, 'NOTICE', null, result);
    } else if (result.tier === 2) {
      await prisma.judgeSession.update({
        where: { matchId },
        data: {
          tier: 2,
          status: 'RECOMMENDED_STOP',
          judgeRecommendedStop: true,
          stopReason: result.reason,
          confidenceLevel: result.confidenceLevel,
          judgeStrikeCount: { increment: 1 },
        },
      });
      io.to(`match:${matchId}`).emit('judge:recommendation', {
        reason: result.reason,
        confidenceLevel: result.confidenceLevel,
      });
      await logEvent(session.id, 'RECOMMENDATION', null, result);
    }
  } catch (err) {
    console.error('Judge evaluation error:', err);
  }
}

async function generateSummary(matchId: string, sessionId: string) {
  try {
    const openai = getOpenAI();
    if (!openai) return;

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { sender: { select: { firstName: true } } },
    });

    const transcript = messages
      .reverse()
      .map((m) => `${m.sender.firstName}: ${m.content}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: `Summarize this mediated conversation:\n\n${transcript}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const result = JSON.parse(text) as {
      disagreement: string;
      breakdownReason: string;
      suggestion: string;
    };

    const summaryText = `${result.disagreement} ${result.breakdownReason} ${result.suggestion}`;

    await prisma.judgeSession.update({
      where: { id: sessionId },
      data: { summary: summaryText },
    });

    io.to(`match:${matchId}`).emit('judge:summary', { summary: summaryText });
    await logEvent(sessionId, 'SUMMARY', null, result);
  } catch (err) {
    console.error('Judge summary error:', err);
  }
}

// ── GET /matches/:matchId/judge ───────────────────────────────────────────────
router.get('/:matchId/judge', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user!.uid;

    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userId }, select: { id: true } });
    if (!dbUser) return res.status(401).json({ error: 'User not found' });

    const parties = await getMatchParties(matchId, dbUser.id);
    if (!parties) return res.status(404).json({ error: 'Match not found' });

    const session = await prisma.judgeSession.findUnique({ where: { matchId } });
    return res.json({ session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /matches/:matchId/judge/request ─────────────────────────────────────
router.post('/:matchId/judge/request', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user!.uid;

    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: userId },
      select: { id: true, isPremium: true },
    });
    if (!dbUser) return res.status(401).json({ error: 'User not found' });
    if (!dbUser.isPremium) {
      return res.status(403).json({ error: 'CheckMate Resolve is a premium feature' });
    }

    const parties = await getMatchParties(matchId, dbUser.id);
    if (!parties) return res.status(404).json({ error: 'Match not found' });

    const { isUser1, otherId } = parties;

    const session = await prisma.judgeSession.upsert({
      where: { matchId },
      update: {
        status: 'REQUESTED',
        requestedById: dbUser.id,
        userAApproved: isUser1 ? true : false,
        userBApproved: isUser1 ? false : true,
        userAAgreesToStop: false,
        userBAgreesToStop: false,
        userAWantsToContinue: false,
        userBWantsToContinue: false,
        judgeRecommendedStop: false,
        tier: 0,
      },
      create: {
        matchId,
        requestedById: dbUser.id,
        status: 'REQUESTED',
        userAApproved: isUser1,
        userBApproved: !isUser1,
      },
    });

    await logEvent(session.id, 'REQUESTED', dbUser.id);
    io.to(`user:${otherId}`).emit('judge:requested', { sessionId: session.id });

    return res.json({ session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /matches/:matchId/judge/approve ──────────────────────────────────────
router.post('/:matchId/judge/approve', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user!.uid;

    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userId }, select: { id: true } });
    if (!dbUser) return res.status(401).json({ error: 'User not found' });

    const parties = await getMatchParties(matchId, dbUser.id);
    if (!parties) return res.status(404).json({ error: 'Match not found' });

    const { isUser1 } = parties;

    const existing = await prisma.judgeSession.findUnique({ where: { matchId } });
    if (!existing) return res.status(404).json({ error: 'No judge session found' });

    const updatedData: any = isUser1 ? { userAApproved: true } : { userBApproved: true };
    const bothApproved =
      (isUser1 && existing.userBApproved) || (!isUser1 && existing.userAApproved);
    if (bothApproved) updatedData.status = 'ACTIVE';

    const session = await prisma.judgeSession.update({ where: { matchId }, data: updatedData });

    if (bothApproved) {
      await logEvent(session.id, 'APPROVED', dbUser.id);
      io.to(`match:${matchId}`).emit('judge:activated', { session });
    }

    return res.json({ session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /matches/:matchId/judge/decline ──────────────────────────────────────
router.post('/:matchId/judge/decline', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user!.uid;

    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userId }, select: { id: true } });
    if (!dbUser) return res.status(401).json({ error: 'User not found' });

    const parties = await getMatchParties(matchId, dbUser.id);
    if (!parties) return res.status(404).json({ error: 'Match not found' });

    const existing = await prisma.judgeSession.findUnique({ where: { matchId } });
    if (!existing) return res.status(404).json({ error: 'No judge session found' });

    const session = await prisma.judgeSession.update({
      where: { matchId },
      data: { status: 'DECLINED' },
    });

    await logEvent(session.id, 'DECLINED', dbUser.id);
    io.to(`match:${matchId}`).emit('judge:declined');

    return res.json({ session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /matches/:matchId/judge/agree-stop ───────────────────────────────────
router.post('/:matchId/judge/agree-stop', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user!.uid;

    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userId }, select: { id: true } });
    if (!dbUser) return res.status(401).json({ error: 'User not found' });

    const parties = await getMatchParties(matchId, dbUser.id);
    if (!parties) return res.status(404).json({ error: 'Match not found' });

    const { isUser1 } = parties;

    const existing = await prisma.judgeSession.findUnique({ where: { matchId } });
    if (!existing || !existing.judgeRecommendedStop) {
      return res.status(400).json({ error: 'No active recommendation to agree to' });
    }

    const updateData: any = isUser1
      ? { userAAgreesToStop: true }
      : { userBAgreesToStop: true };
    updateData.judgeStrikeCount = { increment: 1 };

    const otherAgreed = isUser1 ? existing.userBAgreesToStop : existing.userAAgreesToStop;
    const cooldownEndsAt = new Date(Date.now() + 5 * 60 * 1000);

    updateData.status = 'COOLDOWN';
    updateData.cooldownEndsAt = cooldownEndsAt;

    const session = await prisma.judgeSession.update({ where: { matchId }, data: updateData });

    await logEvent(session.id, 'COOLDOWN', dbUser.id);
    io.to(`match:${matchId}`).emit('judge:cooldown', { cooldownEndsAt: cooldownEndsAt.toISOString() });

    // After 5 minutes → move to PAUSED and generate summary
    setTimeout(async () => {
      try {
        const updated = await prisma.judgeSession.update({
          where: { matchId, status: 'COOLDOWN' },
          data: { status: 'PAUSED' },
        });
        io.to(`match:${matchId}`).emit('judge:paused');
        await generateSummary(matchId, updated.id);
      } catch {
        // Session may have been resumed — ignore
      }
    }, 5 * 60 * 1000);

    return res.json({ session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /matches/:matchId/judge/continue ─────────────────────────────────────
router.post('/:matchId/judge/continue', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user!.uid;

    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userId }, select: { id: true } });
    if (!dbUser) return res.status(401).json({ error: 'User not found' });

    const parties = await getMatchParties(matchId, dbUser.id);
    if (!parties) return res.status(404).json({ error: 'Match not found' });

    const { isUser1 } = parties;

    const existing = await prisma.judgeSession.findUnique({ where: { matchId } });
    if (!existing) return res.status(404).json({ error: 'No judge session found' });

    const updateData: any = isUser1
      ? { userAWantsToContinue: true }
      : { userBWantsToContinue: true };

    const otherWantsToContinue = isUser1 ? existing.userBWantsToContinue : existing.userAWantsToContinue;

    // Either party voting to continue from RECOMMENDED_STOP resets to ACTIVE
    // From PAUSED, both must vote to resume
    const isPaused = existing.status === 'PAUSED';
    const shouldResume = isPaused ? otherWantsToContinue : true;

    if (shouldResume) {
      updateData.status = 'ACTIVE';
      updateData.judgeRecommendedStop = false;
      updateData.tier = 0;
      updateData.stopReason = null;
      updateData.userAAgreesToStop = false;
      updateData.userBAgreesToStop = false;
      updateData.userAWantsToContinue = false;
      updateData.userBWantsToContinue = false;
      updateData.cooldownEndsAt = null;
    }

    const session = await prisma.judgeSession.update({ where: { matchId }, data: updateData });

    if (shouldResume) {
      await logEvent(session.id, 'RESUMED', dbUser.id);
      io.to(`match:${matchId}`).emit('judge:continued');
    }

    return res.json({ session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
