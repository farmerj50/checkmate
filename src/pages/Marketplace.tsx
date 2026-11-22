import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Search } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import AsyncState from '../components/ui/AsyncState';
import MarketplaceListingCard from '../components/marketplace/MarketplaceListingCard';
import { marketplaceService, type MarketplaceListing, type MarketplaceTab } from '../services/marketplace';

const TABS: { value: MarketplaceTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NEARBY', label: 'Nearby' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'VEHICLES', label: 'Vehicles' },
  { value: 'HOME_GARDEN', label: 'Home & Garden' },
  { value: 'FREE', label: 'Free' },
  { value: 'OTHER', label: 'Other' },
];

const EMPTY_MESSAGES: Record<MarketplaceTab, string> = {
  ALL: 'No listings yet',
  NEARBY: 'Nothing nearby yet',
  ELECTRONICS: 'No listings in this category',
  FURNITURE: 'No listings in this category',
  CLOTHING: 'No listings in this category',
  VEHICLES: 'No listings in this category',
  HOME_GARDEN: 'No listings in this category',
  FREE: 'No listings in this category',
  OTHER: 'No listings in this category',
};

const SEARCH_DEBOUNCE_MS = 250;

export default function Marketplace() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce the raw input into the value actually sent to the service, so a mock
  // call (and, later, a real search request) doesn't fire on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listState = useAsync(async () => {
    const page = await marketplaceService.listListings(activeTab, undefined, searchQuery);
    // Full replace, never append — a new tab/search must not mix with the previous
    // result set's accumulated pages.
    setListings(page.items);
    setCursor(page.nextCursor);
    return page;
  }, [activeTab, searchQuery]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await marketplaceService.listListings(activeTab, cursor, searchQuery);
      setListings((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleListingChange(updated: MarketplaceListing) {
    setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#050508] pb-24 lg:pl-[220px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/95 backdrop-blur-xl border-b border-white/6 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff4d8d]/15 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-[#ff4d8d]" />
            </div>
            <h1 className="text-xl font-bold text-white">Marketplace</h1>
          </div>
          <button
            onClick={() => navigate('/marketplace/create')}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-semibold"
          >
            Sell something
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search listings…"
            autoComplete="off"
            className="w-full bg-white/5 border border-white/8 rounded-full pl-9 pr-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#ff4d8d]/40 [color-scheme:dark]"
          />
        </div>

        {/* Tabs — 9 items, horizontally scrollable pill row */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-none px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.value
                  ? 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white'
                  : 'bg-white/5 text-white/40 border border-white/8 hover:text-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        <AsyncState
          loading={listState.status === 'loading'}
          error={listState.error}
          empty={listState.status === 'success' && listings.length === 0}
          emptyMessage={isSearching ? 'No listings match your search' : EMPTY_MESSAGES[activeTab]}
          errorMessage="Couldn't load listings."
          onRetry={listState.reload}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {listings.map((listing) => (
              <MarketplaceListingCard key={listing.id} listing={listing} onChange={handleListingChange} />
            ))}
          </div>
          {cursor && (
            <div className="flex justify-center py-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-5 py-2 rounded-full bg-white/8 border border-white/10 text-white/60 text-sm font-medium hover:text-white disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
