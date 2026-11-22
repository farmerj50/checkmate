import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, PartyPopper } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import AsyncState from '../components/ui/AsyncState';
import { normalizeAssetUrl } from '../utils/helpers';
import NightOutEventCard from '../components/nightOut/NightOutEventCard';
import { nightOutService, type NightOutEvent } from '../services/nightOut';

export default function NightOutHost() {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<NightOutEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const listState = useAsync(async () => {
    if (!hostId) return { items: [], nextCursor: null };
    const page = await nightOutService.getHostEvents(hostId);
    setEvents(page.items);
    setCursor(page.nextCursor);
    return page;
  }, [hostId]);

  async function loadMore() {
    if (!hostId || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await nightOutService.getHostEvents(hostId, cursor);
      setEvents((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleEventChange(updated: NightOutEvent) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  const host = events[0]?.host;

  return (
    <div className="min-h-screen bg-[#050508] pb-20 lg:pl-[220px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/8 flex-none">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold truncate">{host?.firstName ?? 'Host'}</span>
      </div>

      <AsyncState
        loading={listState.status === 'loading'}
        error={listState.error}
        errorMessage="Couldn't load this host."
        onRetry={listState.reload}
      >
        {/* Identity block */}
        {host && (
          <div className="px-4 pt-6 pb-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden flex-none">
              {host.profilePictures[0] && (
                <img src={normalizeAssetUrl(host.profilePictures[0])} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-white text-lg font-bold truncate">{host.firstName}</h2>
                {host.isVerified && <BadgeCheck className="w-5 h-5 text-[#ff4d8d] flex-none" />}
              </div>
              <p className="text-white/40 text-sm">{events.length} upcoming event{events.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        )}

        <div className="px-4">
          {events.length === 0 ? (
            <div className="text-center py-16">
              <PartyPopper className="w-10 h-10 text-white/15 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No events from this host yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {events.map((event) => (
                <NightOutEventCard key={event.id} event={event} onChange={handleEventChange} />
              ))}
            </div>
          )}
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
        </div>
      </AsyncState>
    </div>
  );
}
