import type {
  ContactSellerInput,
  CreateMarketplaceListingInput,
  MarketplaceListing,
  MarketplaceTab,
  Page,
  ReportMarketplaceListingInput,
} from './types';

export interface MarketplaceService {
  listListings(tab: MarketplaceTab, cursor?: string, search?: string): Promise<Page<MarketplaceListing>>;
  getListing(listingId: string): Promise<MarketplaceListing | null>;
  getSellerListings(sellerId: string, cursor?: string): Promise<Page<MarketplaceListing>>;
  createListing(input: CreateMarketplaceListingInput): Promise<MarketplaceListing>;
  saveListing(listingId: string): Promise<MarketplaceListing>;
  unsaveListing(listingId: string): Promise<MarketplaceListing>;
  markSold(listingId: string): Promise<MarketplaceListing>;
  contactSeller(input: ContactSellerInput): Promise<void>;
  report(input: ReportMarketplaceListingInput): Promise<void>;
}
