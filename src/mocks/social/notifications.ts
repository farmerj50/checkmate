import type { SocialNotification } from '../../types';
import { authorById } from './authors';

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

/**
 * Notification *types* here (NEW_FOLLOWER / POST_LIKED / POST_COMMENTED / NEW_MATCH)
 * match the existing, stable contract in src/types/index.ts exactly — this is real
 * Vipi behavior being mocked, not a new shape. POST_COMMENTED stays even though
 * the product direction has moved off comments, because that's what the current,
 * unmodified notification contract still defines; renaming it is Codex's call.
 */
export const MOCK_NOTIFICATIONS: SocialNotification[] = [
  {
    id: 'notif-1',
    type: 'NEW_FOLLOWER',
    actor: authorById('user-jordan'),
    isRead: false,
    createdAt: hoursAgo(1),
  },
  {
    id: 'notif-2',
    type: 'POST_LIKED',
    actor: authorById('user-mila'),
    postId: 'post-1',
    isRead: false,
    createdAt: hoursAgo(3),
  },
  {
    id: 'notif-3',
    type: 'POST_COMMENTED',
    actor: authorById('user-devon'),
    postId: 'post-2',
    isRead: true,
    createdAt: hoursAgo(26),
  },
];
