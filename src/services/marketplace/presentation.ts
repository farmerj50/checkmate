import type { MarketplaceCategory, MarketplaceListing } from './types';

export const MARKETPLACE_CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  ELECTRONICS: 'Electronics',
  FURNITURE: 'Furniture',
  CLOTHING: 'Clothing',
  VEHICLES: 'Vehicles',
  HOME_GARDEN: 'Home & Garden',
  FREE: 'Free',
  OTHER: 'Other',
};

export const MARKETPLACE_CONDITION_LABELS: Record<MarketplaceListing['condition'], string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  USED: 'Used',
};

export function formatListingPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price.toLocaleString()}`;
}
