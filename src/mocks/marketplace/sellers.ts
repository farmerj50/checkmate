import type { MarketplaceSeller } from '../../services/marketplace/types';

export const MOCK_MARKETPLACE_SELLERS: MarketplaceSeller[] = [
  { id: 'seller-jenna', firstName: 'Jenna', profilePictures: ['https://i.pravatar.cc/150?img=44'], isVerified: true },
  { id: 'seller-mike-electronics', firstName: 'Mike', profilePictures: ['https://i.pravatar.cc/150?img=15'], isVerified: false },
  { id: 'seller-thrift-co', firstName: 'Thrift Co.', profilePictures: ['https://i.pravatar.cc/150?img=60'], isVerified: true },
  { id: 'seller-carlos', firstName: 'Carlos', profilePictures: ['https://i.pravatar.cc/150?img=22'], isVerified: false },
];

export function marketplaceSellerById(id: string): MarketplaceSeller {
  return MOCK_MARKETPLACE_SELLERS.find((s) => s.id === id) ?? MOCK_MARKETPLACE_SELLERS[0];
}
