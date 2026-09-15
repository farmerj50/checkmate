import { ApiSocialService } from './ApiSocialService';
import type { SocialService } from './SocialService';

/**
 * Live: Codex's social contract is frozen, so this now points at the real
 * backend. MockSocialService (still fully implemented and type-correct) is
 * available for local-only UI work — swap the line below back to
 * `new MockSocialService()` if the real backend isn't reachable in your
 * current dev setup. Screens import `socialService` from here and never
 * touch either implementation directly.
 */
export const socialService: SocialService = new ApiSocialService();

export type { SocialService } from './SocialService';
export type {
  CreatePostInput,
  CreateReplyInput,
  Page,
  ReportInput,
  SocialPost,
} from './types';
