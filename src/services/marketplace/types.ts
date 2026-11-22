export type MarketplaceCategory =
  | 'ELECTRONICS'
  | 'FURNITURE'
  | 'CLOTHING'
  | 'VEHICLES'
  | 'HOME_GARDEN'
  | 'FREE'
  | 'OTHER';

/** NEARBY is a smart filter over location, not a category — see MockMarketplaceService.listListings. */
export type MarketplaceTab = 'ALL' | 'NEARBY' | MarketplaceCategory;

export type MarketplaceCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'USED';
export type MarketplaceListingStatus = 'ACTIVE' | 'SOLD' | 'REMOVED';

export interface MarketplaceSeller {
  id: string;
  firstName: string;
  profilePictures: string[];
  isVerified: boolean;
}

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  /** Denormalized seller summary embedded on the listing, same pattern as NightOutEvent.host. */
  seller: MarketplaceSeller;
  title: string;
  description: string;
  price: number; // dollars; 0 = Free
  videoUrl: string;
  thumbnailUrl: string | null;
  category: MarketplaceCategory;
  /** Simple display string (e.g. "Austin, TX") — no lat/long, no shared Location type. Deliberately
   *  deferred/inconsistent with NightOutEvent's richer location fields; not reconciled in this slice. */
  location: string;
  condition: MarketplaceCondition;
  status: MarketplaceListingStatus;
  createdAt: string; // ISO 8601
  /** Viewer-scoped — not in the original field spec, added to make "save" implementable client-side. */
  isSaved: boolean;
  saveCount: number;
}
// Deliberately no `quantity` field — Marketplace is peer-to-peer, one listing = one item.
// Multi-unit/inventory selling is a distinct future feature, not part of this slice.

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CreateMarketplaceListingInput {
  title: string;
  description: string;
  price: number;
  category: MarketplaceCategory;
  condition: MarketplaceCondition;
  location: string;
  videoUrl: string; // ignored by the mock service
  thumbnailUrl?: string;
}

export type MarketplaceReportReason =
  | 'PROHIBITED_ITEM'
  | 'MISLEADING_LISTING'
  | 'SUSPECTED_SCAM'
  | 'SPAM'
  | 'OTHER';

export interface ReportMarketplaceListingInput {
  listingId: string;
  reason: MarketplaceReportReason;
  description?: string;
}

export interface ContactSellerInput {
  listingId: string;
  message: string;
}
