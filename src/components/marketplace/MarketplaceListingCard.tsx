import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, BadgeCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeAssetUrl } from '../../utils/helpers';
import { marketplaceService, type MarketplaceListing } from '../../services/marketplace';

import { MARKETPLACE_CATEGORY_LABELS, MARKETPLACE_CONDITION_LABELS, formatListingPrice } from '../../services/marketplace/presentation';

interface Props {
  listing: MarketplaceListing;
  onChange: (updated: MarketplaceListing) => void;
}

export default function MarketplaceListingCard({ listing, onChange }: Props) {
  const navigate = useNavigate();
  const media = normalizeAssetUrl(listing.videoUrl);
  const isSold = listing.status === 'SOLD';

  async function toggleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (isSold) return;
    const before = listing;
    try {
      const updated = listing.isSaved
        ? await marketplaceService.unsaveListing(listing.id)
        : await marketplaceService.saveListing(listing.id);
      onChange(updated);
    } catch {
      onChange(before);
      toast.error('Could not update — try again');
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/marketplace/${listing.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/marketplace/${listing.id}`); }}
      className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-black text-left group cursor-pointer"
    >
      <video
        src={media ? `${media}#t=0.001` : ''}
        className="w-full h-full object-cover"
        muted playsInline preload="metadata"
      />

      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {isSold && (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
          <span className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold tracking-widest uppercase">
            Sold
          </span>
        </div>
      )}

      <button
        onClick={toggleSave}
        disabled={isSold}
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center disabled:opacity-40"
      >
        <Heart className={`w-4 h-4 ${listing.isSaved ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white'}`} />
      </button>

      <span className="absolute top-2.5 left-2.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold">
        {MARKETPLACE_CATEGORY_LABELS[listing.category]}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3 space-y-0.5">
        <h3 className="text-white font-bold text-sm leading-tight line-clamp-1">{listing.title}</h3>
        <p className="text-white/70 text-xs flex items-center gap-1 truncate">
          by {listing.seller.firstName}
          {listing.seller.isVerified && <BadgeCheck className="w-3 h-3 text-[#ff4d8d] flex-none" />}
        </p>
        <p className="text-white/70 text-xs flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 flex-none" />
          {listing.location}
        </p>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-white text-xs font-semibold">{formatListingPrice(listing.price)}</span>
          <span className="text-white/60 text-[10px]">{MARKETPLACE_CONDITION_LABELS[listing.condition]}</span>
        </div>
      </div>
    </div>
  );
}
