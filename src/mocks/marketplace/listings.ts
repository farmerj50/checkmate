import type { MarketplaceListing, MarketplaceCategory, MarketplaceCondition, MarketplaceListingStatus } from '../../services/marketplace/types';
import { marketplaceSellerById } from './sellers';
import { pickSampleMarketplaceVideo } from './videos';

/** "Me" for Nearby filtering purposes — arbitrary, just needs to be stable. See MockMarketplaceService. */
export const MOCK_ME_LOCATION = 'Austin, TX';

function daysFromNow(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString();
}

interface Seed {
  title: string;
  description: string;
  price: number;
  category: MarketplaceCategory;
  condition: MarketplaceCondition;
  location: string;
  sellerId: string;
  status?: MarketplaceListingStatus;
}

const SELLER_IDS = ['seller-jenna', 'seller-mike-electronics', 'seller-thrift-co', 'seller-carlos'];
const CONDITIONS: MarketplaceCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'];
const DENVER_INDEXES = new Set([2, 5, 8, 11, 14]);

const RAW: { title: string; description: string; price: number; category: MarketplaceCategory }[] = [
  { title: 'iPhone 13 Pro - 256GB', description: 'Unlocked, great condition, comes with original box and charger.', price: 550, category: 'ELECTRONICS' },
  { title: 'Sony Noise Cancelling Headphones', description: 'WH-1000XM4, barely used, includes case.', price: 180, category: 'ELECTRONICS' },
  { title: 'Gaming Monitor 27-inch', description: '144Hz 1440p monitor, no dead pixels.', price: 220, category: 'ELECTRONICS' },
  { title: 'Mid-Century Sofa', description: 'Two-seater, walnut legs, minor wear on one cushion.', price: 300, category: 'FURNITURE' },
  { title: 'Oak Dining Table', description: 'Seats 6, solid oak, a few surface scratches.', price: 250, category: 'FURNITURE' },
  { title: 'Bookshelf - IKEA', description: 'Billy bookshelf, white, disassembled for easy transport.', price: 40, category: 'FURNITURE' },
  { title: "Leather Jacket - Men's L", description: 'Genuine leather, worn a handful of times.', price: 90, category: 'CLOTHING' },
  { title: 'Vintage Denim Jacket', description: '90s vintage, size M, great condition.', price: 45, category: 'CLOTHING' },
  { title: 'Designer Handbag', description: 'Authentic, gently used, dust bag included.', price: 320, category: 'CLOTHING' },
  { title: '2015 Honda Civic', description: '98k miles, clean title, recent oil change.', price: 9500, category: 'VEHICLES' },
  { title: 'Mountain Bike - Trek', description: 'Trek Marlin 7, size M, well maintained.', price: 480, category: 'VEHICLES' },
  { title: 'Electric Scooter', description: '20mph top speed, new battery installed last month.', price: 220, category: 'VEHICLES' },
  { title: 'Patio Furniture Set', description: '4-chair set with table, weather-resistant.', price: 260, category: 'HOME_GARDEN' },
  { title: 'Potted Plants Bundle', description: 'Five healthy indoor plants, pots included.', price: 35, category: 'HOME_GARDEN' },
  { title: 'Power Drill Set', description: 'Cordless drill with bit set, two batteries.', price: 60, category: 'HOME_GARDEN' },
  { title: 'Free Moving Boxes', description: '20+ sturdy boxes, various sizes, must pick up.', price: 0, category: 'FREE' },
  { title: 'Free Couch - Needs Pickup', description: 'Functional but has a tear on one arm. You haul.', price: 0, category: 'FREE' },
  { title: 'Free Kids Books Bundle', description: 'Around 30 picture books, good condition.', price: 0, category: 'FREE' },
  { title: 'Guitar - Acoustic', description: 'Yamaha acoustic, comes with soft case.', price: 130, category: 'OTHER' },
  { title: 'Board Game Collection', description: 'Eight games including Catan and Ticket to Ride.', price: 70, category: 'OTHER' },
  { title: 'Camping Gear Bundle', description: 'Tent, two sleeping bags, and a camp stove.', price: 110, category: 'OTHER' },
];

const SEEDS: Seed[] = RAW.map((r, i) => ({
  ...r,
  condition: CONDITIONS[i % CONDITIONS.length],
  location: DENVER_INDEXES.has(i) ? 'Denver, CO' : MOCK_ME_LOCATION,
  sellerId: SELLER_IDS[i % SELLER_IDS.length],
  status: i === 1 ? 'SOLD' : 'ACTIVE',
}));

export const MOCK_MARKETPLACE_LISTINGS: MarketplaceListing[] = SEEDS.map((seed, i) => ({
  id: `marketplace-${i + 1}`,
  sellerId: seed.sellerId,
  seller: marketplaceSellerById(seed.sellerId),
  title: seed.title,
  description: seed.description,
  price: seed.price,
  videoUrl: pickSampleMarketplaceVideo(i),
  thumbnailUrl: null,
  category: seed.category,
  location: seed.location,
  condition: seed.condition,
  status: seed.status ?? 'ACTIVE',
  createdAt: daysFromNow(-i),
  isSaved: false,
  saveCount: (i * 3) % 25,
}));
