import { MockMarketplaceService, MOCK_ME_ID } from './MockMarketplaceService';
import type { MarketplaceService } from './MarketplaceService';

/**
 * Mock-only for now — there is no Marketplace backend yet (no schema, routes, or
 * contract). Once one exists, add an ApiMarketplaceService implementing MarketplaceService
 * and swap the line below, same as src/services/nightOut/index.ts did for Night Out.
 * Screens import `marketplaceService` from here and never touch the implementation directly.
 */
export const marketplaceService: MarketplaceService = new MockMarketplaceService();

/**
 * Single source of truth for "am I the seller" checks — imported by both the mock
 * service and any page/component that gates an action on listing ownership (e.g.
 * Mark as Sold, Contact Seller), so the identity isn't a duplicated string literal.
 */
export { MOCK_ME_ID };

export type { MarketplaceService } from './MarketplaceService';
export type {
  ContactSellerInput,
  CreateMarketplaceListingInput,
  MarketplaceCategory,
  MarketplaceCondition,
  MarketplaceListing,
  MarketplaceListingStatus,
  MarketplaceReportReason,
  MarketplaceSeller,
  MarketplaceTab,
  Page,
  ReportMarketplaceListingInput,
} from './types';
