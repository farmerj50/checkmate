import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith('sk-ant-your')) return null;
  return new Anthropic({ apiKey: key });
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith('sk-your')) return null;
  return new OpenAI({ apiKey: key });
}

const SYSTEM_PROMPT = (contextBlock: string) =>
  `You are CheckMate Studio AI — a professional content creator and video strategist for CheckMate, a social dating app. You help creators produce compelling short-form video content.

Your capabilities:
- Write complete video scripts with timing marks (e.g. [0-3s Hook], [3-15s Content], [15-30s CTA])
- Create detailed video concepts and storyboards
- Suggest specific visual scenes, B-roll ideas, and photo compositions
- Analyze content and give actionable improvement feedback
- Generate captions, hooks, and hashtags
- Advise on posting strategy and engagement

Style guidelines:
- For scripts: include timing marks, voiceover/dialogue, and visual direction per segment
- For lists: use bullet points with specific, actionable details
- For concepts: cover hook, main content, and CTA sections
- Be direct, specific, and encouraging — never vague
- Responses can be up to 400 words for creative tasks; keep chat/advice under 150 words
- No markdown headers (##). Use plain bullets and line breaks.${contextBlock}`;

// POST /api/ai/caption
router.post('/caption', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const anthropic = getAnthropic();
  if (!anthropic) {
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

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const captions = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
    res.json({ captions });
  } catch (err: any) {
    console.error('AI caption error:', err);
    res.status(500).json({ error: err.message ?? 'Failed to generate captions' });
  }
});

// POST /api/ai/studio  — AI content creator, supports Claude and GPT-4
router.post('/studio', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { message, caption, hasVideo, hasImages, imageCount, script, model = 'claude' } = req.body as {
    message: string;
    caption?: string;
    hasVideo?: boolean;
    hasImages?: boolean;
    imageCount?: number;
    script?: string;
    model?: 'claude' | 'gpt4';
  };

  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const contextLines: string[] = [];
  if (hasVideo && caption) contextLines.push(`Current video caption: "${caption}"`);
  if (hasImages && imageCount) contextLines.push(`User has uploaded ${imageCount} image(s) for this post.`);
  if (script) contextLines.push(`Current script draft:\n${script.slice(0, 600)}`);
  const contextBlock = contextLines.length > 0 ? `\n\nCurrent project context:\n${contextLines.join('\n')}` : '';
  const systemPrompt = SYSTEM_PROMPT(contextBlock);

  try {
    let reply: string;

    if (model === 'gpt4') {
      const openai = getOpenAI();
      if (!openai) return res.status(503).json({ error: 'OpenAI not configured. Add OPENAI_API_KEY to backend/.env.dev.' });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 700,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
      });
      reply = completion.choices[0]?.message?.content?.trim() ?? '';
    } else {
      const anthropic = getAnthropic();
      if (!anthropic) return res.status(503).json({ error: 'AI not configured. Add ANTHROPIC_API_KEY to backend/.env.dev.' });

      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      });
      reply = (msg.content[0] as { type: string; text: string }).text.trim();
    }

    res.json({ reply, model });
  } catch (err: any) {
    console.error('AI studio error:', err);
    res.status(500).json({ error: err.message ?? 'AI error' });
  }
});

export default router;
