import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith('sk-ant-your')) return null;
  return new Anthropic({ apiKey: key });
}

// POST /api/ai/caption
router.post('/caption', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = getClient();
  if (!client) {
    return res.status(503).json({ error: 'AI not configured. Add ANTHROPIC_API_KEY to backend/.env.dev.' });
  }

  const { firstName, bio, interests } = req.body as {
    firstName?: string;
    bio?: string;
    interests?: string[];
  };

  try {
    const prompt = `Generate 3 short, fun video caption suggestions for a dating app profile video.
Person: ${firstName ?? 'someone'}
Bio: ${bio ?? 'No bio yet'}
Interests: ${(interests ?? []).slice(0, 5).join(', ') || 'various things'}

Requirements:
- Each caption is 1-2 short sentences max (under 60 characters each)
- Witty, warm, and authentic — not cheesy
- No hashtags, no emojis
- Return ONLY the 3 captions, one per line, no numbering`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const captions = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3);

    res.json({ captions });
  } catch (err: any) {
    console.error('AI caption error:', err);
    res.status(500).json({ error: err.message ?? 'Failed to generate captions' });
  }
});

export default router;
