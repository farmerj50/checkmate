import { MOCK_MARKETPLACE_LISTINGS, MOCK_ME_LOCATION } from '../../mocks/marketplace/listings';
import { pickSampleMarketplaceVideo } from '../../mocks/marketplace/videos';
import type { MarketplaceService } from './MarketplaceService';
import type {
  CreateMarketplaceListingInput,
  MarketplaceListing,
  MarketplaceTab,
  Page,
} from './types';

const PAGE_SIZE = 12;
const NETWORK_DELAY_MS = 300;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** "Me" for the purposes of this mock session — arbitrary, just needs to be stable. */
export const MOCK_ME_ID = 'me';

const CATEGORY_TABS = new Set(['ELECTRONICS', 'FURNITURE', 'CLOTHING', 'VEHICLES', 'HOME_GARDEN', 'FREE', 'OTHER']);

/**
 * In-memory implementation of MarketplaceService, seeded from src/mocks/marketplace/**.
 * Frontend-only — there is no real Marketplace backend yet, so every filter here is a
 * deliberately simple stand-in, not production logic. See plan §8 for what's expected
 * to change once a real contract exists.
 */
export class MockMarketplaceService implements MarketplaceService {
  private listings: MarketplaceListing[] = clone(MOCK_MARKETPLACE_LISTINGS);
  private nextListingSeed = this.listings.length;

  async listListings(tab: MarketplaceTab, cursor?: string, search?: string): Promise<Page<MarketplaceListing>> {
    let filtered = this.listings.filter((l) => l.status !== 'REMOVED');

    if (tab === 'NEARBY') {
      // NEARBY is a fake city-string filter, not real geospatial distance — there's
      // no geolocation/maps integration in this slice. See plan §8.
      filtered = filtered.filter((l) => l.location === MOCK_ME_LOCATION);
    } else if (CATEGORY_TABS.has(tab)) {
      filtered = filtered.filter((l) => l.category === tab);
    }
    // 'ALL' — no additional filter.

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      // Search runs against the full in-memory set, before pagination — filtering only
      // the currently-loaded page would hide matches that exist on a later page.
      filtered = filtered.filter((l) => l.title.toLowerCase().includes(q));
    }

    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(paginate(sorted, cursor));
  }

  async getListing(listingId: string): Promise<MarketplaceListing | null> {
    return delay(this.listings.find((l) => l.id === listingId) ?? null);
  }

  async getSellerListings(sellerId: string, cursor?: string): Promise<Page<MarketplaceListing>> {
    const sorted = this.listings
      .filter((l) => l.sellerId === sellerId && l.status !== 'REMOVED')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(paginate(sorted, cursor));
  }

  async createListing(input: CreateMarketplaceListingInput): Promise<MarketplaceListing> {
    // mock-only: the real file the user picked/recorded is never persisted anywhere —
    // there's no upload endpoint for marketplace media yet, so a stock sample clip
    // stands in for it. Do not let this look like a real upload succeeded; see plan §8.
    const seed = this.nextListingSeed++;
    const listing: MarketplaceListing = {
      id: `marketplace-created-${Date.now()}`,
      sellerId: MOCK_ME_ID,
      seller: { id: MOCK_ME_ID, firstName: 'You', profilePictures: [], isVerified: false },
      title: input.title,
      description: input.description,
      price: input.price,
      videoUrl: pickSampleMarketplaceVideo(seed),
      thumbnailUrl: null,
      category: input.category,
      location: input.location,
      condition: input.condition,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      isSaved: false,
      saveCount: 0,
    };
    this.listings = [listing, ...this.listings];
    return delay(listing);
  }

  async saveListing(listingId: string): Promise<MarketplaceListing> {
    const listing = this.findMutableListing(listingId);
    if (!listing.isSaved) {
      listing.isSaved = true;
      listing.saveCount += 1;
    }
    return delay(listing);
  }

  async unsaveListing(listingId: string): Promise<MarketplaceListing> {
    const listing = this.findMutableListing(listingId);
    if (listing.isSaved) {
      listing.isSaved = false;
      listing.saveCount = Math.max(0, listing.saveCount - 1);
    }
    return delay(listing);
  }

  async markSold(listingId: string): Promise<MarketplaceListing> {
    const listing = this.findMutableListing(listingId);
    if (listing.sellerId !== MOCK_ME_ID) {
      throw new Error('Only the seller can mark this listing as sold');
    }
    if (listing.status === 'REMOVED') {
      throw new Error('Cannot mark a removed listing as sold');
    }
    listing.status = 'SOLD'; // no-op if already SOLD — a repeated/double-click request succeeds harmlessly
    return delay(listing);
  }

  async contactSeller(): Promise<void> {
    return delay(undefined);
  }

  async report(): Promise<void> {
    return delay(undefined);
  }

  private findMutableListing(listingId: string): MarketplaceListing {
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error(`Mock marketplace listing not found: ${listingId}`);
    return listing;
  }
}

function paginate<T extends { id: string }>(items: T[], cursor?: string): Page<T> {
  const startIndex = cursor ? items.findIndex((i) => i.id === cursor) + 1 : 0;
  const page = items.slice(startIndex, startIndex + PAGE_SIZE);
  const nextCursor = items.length > startIndex + PAGE_SIZE ? page[page.length - 1]?.id ?? null : null;
  return { items: page, nextCursor };
}
