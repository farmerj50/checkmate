import type { SocialPost } from '../../services/social/types';
import { authorById } from './authors';
import { SAMPLE_VIDEOS } from './videos';

const minsAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();

/** Keyed by parent post id. Every entry here has parentPostId set. */
export const MOCK_REPLIES: Record<string, SocialPost[]> = {
  'post-1': [
    {
      id: 'reply-1',
      authorId: 'user-jordan',
      author: authorById('user-jordan'),
      videoUrl: SAMPLE_VIDEOS[5],
      caption: undefined,
      parentPostId: 'post-1',
      replyCount: 0,
      reactions: { '👍': 2 },
      reactionCount: 2,
      viewerReactions: [],
      saveCount: 0,
      isSaved: false,
      createdAt: minsAgo(90),
    },
    {
      id: 'reply-2',
      authorId: 'user-priya',
      author: authorById('user-priya'),
      videoUrl: SAMPLE_VIDEOS[0],
      caption: undefined,
      parentPostId: 'post-1',
      replyCount: 0,
      reactions: {},
      reactionCount: 0,
      viewerReactions: [],
      saveCount: 0,
      isSaved: false,
      createdAt: minsAgo(40),
    },
  ],
  'post-2': [
    {
      id: 'reply-3',
      authorId: 'user-mila',
      author: authorById('user-mila'),
      videoUrl: SAMPLE_VIDEOS[1],
      caption: undefined,
      parentPostId: 'post-2',
      replyCount: 0,
      reactions: { '🔥': 1 },
      reactionCount: 1,
      viewerReactions: [],
      saveCount: 0,
      isSaved: false,
      createdAt: minsAgo(200),
    },
  ],
};
