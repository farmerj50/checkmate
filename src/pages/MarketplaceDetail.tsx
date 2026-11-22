import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, MapPin, Share2, MoreVertical, Flag, Heart, MessageCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAsync } from '../hooks/useAsync';
import AsyncState from '../components/ui/AsyncState';
import { normalizeAssetUrl } from '../utils/helpers';
import { marketplaceService, MOCK_ME_ID, type MarketplaceListing } from '../services/marketplace';
import { MARKETPLACE_CATEGORY_LABELS, MARKETPLACE_CONDITION_LABELS, formatListingPrice } from '../services/marketplace/presentation';
import ReportListingModal from '../components/marketplace/ReportListingModal';
import ContactSellerModal from '../components/marketplace/ContactSellerModal';

export default function MarketplaceDetail() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const [localListing, setLocalListing] = useState<MarketplaceListing | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);

  const listingState = useAsync(
    () => (listingId ? marketplaceService.getListing(listingId) : Promise.resolve(null)),
    [listingId]
  );

  const listing = localListing ?? listingState.data ?? null;
  const isUnavailable = listingState.status === 'success' && (!listing || listing.status === 'REMOVED');
  const isOwner = listing?.sellerId === MOCK_ME_ID;
  const isSold = listing?.status === 'SOLD';

  async function toggleSave() {
    if (!listing || saving) return;
    setSaving(true);
    const before = listing;
    try {
      const updated = listing.isSaved
        ? await marketplaceService.unsaveListing(listing.id)
        : await marketplaceService.saveListing(listing.id);
      setLocalListing(updated);
    } catch {
      setLocalListing(before);
      toast.error('Could not update — try again');
    } finally {
      setSaving(false);
    }
  }

  async function markSold() {
    if (!listing || markingSold) return;
    setMarkingSold(true);
    try {
      const updated = await marketplaceService.markSold(listing.id);
      setLocalListing(updated);
      toast.success('Listing marked as sold');
    } catch {
      toast.error('Could not update — try again');
    } finally {
      setMarkingSold(false);
    }
  }

  async function share() {
    if (!listing) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: listing.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  }

  return (
    <div className="min-h-screen bg-[#050508] pb-20 lg:pl-[220px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/8 flex-none">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-semibold truncate">Listing</span>
        </div>

        {listing && !isUnavailable && (
          <div className="relative flex-none">
            <button onClick={() => setMenuOpen((v) => !v)} className="p-2 rounded-full bg-white/8">
              <MoreVertical className="w-5 h-5 text-white/70" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute right-0 top-12 bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-44 py-1 z-20"
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
                    >
                      <Flag className="w-4 h-4 text-red-400" /> Report listing
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AsyncState
        loading={listingState.status === 'loading'}
        error={listingState.error}
        empty={isUnavailable}
        emptyMessage="Listing unavailable"
        errorMessage="Couldn't load this listing."
        onRetry={listingState.reload}
      >
        {listing && (
          <div>
            {/* Hero video */}
            <div className="bg-black relative" style={{ aspectRatio: '4/3' }}>
              <video
                src={normalizeAssetUrl(listing.videoUrl) ?? ''}
                className="w-full h-full object-cover"
                autoPlay loop muted playsInline
              />
              {isSold && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <span className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold tracking-widest uppercase">
                    Sold
                  </span>
                </div>
              )}
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Title + category */}
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full bg-[#ff4d8d]/15 text-[#ff4d8d] text-xs font-semibold mb-2">
                  {MARKETPLACE_CATEGORY_LABELS[listing.category]}
                </span>
                <h1 className="text-white text-2xl font-bold leading-tight">{listing.title}</h1>
              </div>

              {/* Price + condition + location */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-white text-2xl font-bold">{formatListingPrice(listing.price)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/8 text-white/60 text-xs font-medium">
                    {MARKETPLACE_CONDITION_LABELS[listing.condition]}
                  </span>
                  {isSold && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/8 text-white/60 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sold
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-2.5 text-white/70">
                  <MapPin className="w-4 h-4 flex-none mt-0.5" />
                  <span>{listing.location}</span>
                </div>
              </div>

              {listing.description && (
                <p className="text-white/60 text-sm leading-relaxed border-t border-white/6 pt-4">
                  {listing.description}
                </p>
              )}

              {/* Seller */}
              <button
                onClick={() => navigate(`/marketplace/seller/${listing.sellerId}`)}
                className="flex items-center gap-3 border-t border-white/6 pt-4 w-full"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex-none">
                  {listing.seller.profilePictures[0] && (
                    <img src={normalizeAssetUrl(listing.seller.profilePictures[0])} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold text-sm truncate">{listing.seller.firstName}</span>
                    {listing.seller.isVerified && <BadgeCheck className="w-4 h-4 text-[#ff4d8d] flex-none" />}
                  </div>
                  <span className="text-white/40 text-xs">Sold by</span>
                </div>
              </button>

              {/* Actions — differ by status, not just ownership */}
              <div className="flex items-center gap-3 border-t border-white/6 pt-4">
                {!isSold && (
                  <button
                    onClick={toggleSave}
                    disabled={saving}
                    className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center flex-none disabled:opacity-50"
                  >
                    <Heart className={`w-5 h-5 ${listing.isSaved ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white/70'}`} />
                  </button>
                )}

                {!isSold && !isOwner && (
                  <button
                    onClick={() => setContactOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-semibold text-sm"
                  >
                    <MessageCircle className="w-4 h-4" /> Contact Seller
                  </button>
                )}

                {isOwner && listing.status === 'ACTIVE' && (
                  <button
                    onClick={markSold}
                    disabled={markingSold}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/8 border border-white/10 text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {markingSold ? 'Marking…' : 'Mark as Sold'}
                  </button>
                )}

                <button
                  onClick={share}
                  className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center flex-none"
                >
                  <Share2 className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>
          </div>
        )}
      </AsyncState>

      {reportOpen && listing && (
        <ReportListingModal
          listingId={listing.id}
          listingTitle={listing.title}
          onClose={() => setReportOpen(false)}
        />
      )}

      {contactOpen && listing && (
        <ContactSellerModal
          listingId={listing.id}
          listingTitle={listing.title}
          sellerFirstName={listing.seller.firstName}
          onClose={() => setContactOpen(false)}
        />
      )}
    </div>
  );
}
