import type { SocialPost } from '../../services/social/types';
import { authorById } from './authors';
import { SAMPLE_VIDEOS } from './videos';

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const reactionCount = (reactions: Record<string, number>) => Object.values(reactions).reduce((sum, n) => sum + n, 0);

/** Root posts only (parentPostId: null) — replies live in mocks/social/replies.ts. */
export const MOCK_FEED_POSTS: SocialPost[] = [
  {
    id: 'post-1',
    authorId: 'user-ava',
    author: authorById('user-ava'),
    videoUrl: SAMPLE_VIDEOS[0],
    caption: 'Sunday morning run 🏃',
    parentPostId: null,
    replyCount: 2,
    reactions: { '🔥': 12, '👍': 4 },
    reactionCount: reactionCount({ '🔥': 12, '👍': 4 }),
    viewerReactions: [],
    createdAt: hoursAgo(2),
  },
  {
    id: 'post-2',
    authorId: 'user-jordan',
    author: authorById('user-jordan'),
    videoUrl: SAMPLE_VIDEOS[1],
    caption: 'New setup, thoughts?',
    parentPostId: null,
    replyCount: 1,
    reactions: { '🎸': 3 },
    reactionCount: reactionCount({ '🎸': 3 }),
    viewerReactions: ['🎸'],
    createdAt: hoursAgo(5),
  },
  {
    id: 'post-3',
    authorId: 'user-mila',
    author: authorById('user-mila'),
    videoUrl: SAMPLE_VIDEOS[2],
    caption: undefined,
    parentPostId: null,
    replyCount: 0,
    reactions: {},
    reactionCount: 0,
    viewerReactions: [],
    createdAt: hoursAgo(9),
  },
  {
    id: 'post-4',
    authorId: 'user-devon',
    author: authorById('user-devon'),
    videoUrl: SAMPLE_VIDEOS[3],
    caption: 'Recipe in replies 👀',
    parentPostId: null,
    replyCount: 0,
    reactions: { '💥': 21, '🔥': 8, '👍': 2 },
    reactionCount: reactionCount({ '💥': 21, '🔥': 8, '👍': 2 }),
    viewerReactions: [],
    createdAt: hoursAgo(20),
  },
  {
    id: 'post-5',
    authorId: 'user-priya',
    author: authorById('user-priya'),
    videoUrl: SAMPLE_VIDEOS[4],
    caption: 'First post, be nice',
    parentPostId: null,
    replyCount: 0,
    reactions: { '👍': 1 },
    reactionCount: reactionCount({ '👍': 1 }),
    viewerReactions: [],
    createdAt: hoursAgo(30),
  },
];
