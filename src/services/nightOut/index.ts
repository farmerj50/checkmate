import { MockNightOutService } from './MockNightOutService';
import type { NightOutService } from './NightOutService';

/**
 * Mock-only for now — there is no Night Out backend yet (no schema, routes, or
 * contract). Once one exists, add an ApiNightOutService implementing NightOutService
 * and swap the line below, same as src/services/social/index.ts did for Social.
 * Screens import `nightOutService` from here and never touch the implementation directly.
 */
export const nightOutService: NightOutService = new MockNightOutService();

export type { NightOutService } from './NightOutService';
export type {
  CreateNightOutEventInput,
  NightOutAgeRestriction,
  NightOutCategory,
  NightOutEvent,
  NightOutHost,
  NightOutReportReason,
  NightOutTab,
  Page,
  ReportNightOutEventInput,
} from './types';
