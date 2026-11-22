import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import AsyncState from '../components/ui/AsyncState';
import NightOutEventCard from '../components/nightOut/NightOutEventCard';
import { nightOutService, type NightOutEvent, type NightOutTab } from '../services/nightOut';

const TABS: { value: NightOutTab; label: string }[] = [
  { value: 'TONIGHT', label: 'Tonight' },
  { value: 'THIS_WEEKEND', label: 'This Weekend' },
  { value: 'NEARBY', label: 'Nearby' },
  { value: 'FOOD_DRINKS', label: 'Food & Drinks' },
  { value: 'LIVE_MUSIC', label: 'Live Music' },
  { value: 'PARTIES', label: 'Parties' },
  { value: 'COMEDY', label: 'Comedy' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'DATE_NIGHT', label: 'Date Night' },
];

const EMPTY_MESSAGES: Record<NightOutTab, string> = {
  TONIGHT: 'No events tonight',
  THIS_WEEKEND: 'No events this weekend yet',
  NEARBY: 'Nothing nearby yet',
  FOOD_DRINKS: 'No events in this category',
  LIVE_MUSIC: 'No events in this category',
  PARTIES: 'No events in this category',
  COMEDY: 'No events in this category',
  EVENTS: 'No events in this category',
  DATE_NIGHT: 'No events in this category',
};

export default function NightOut() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NightOutTab>('TONIGHT');
  const [events, setEvents] = useState<NightOutEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const listState = useAsync(async () => {
    const page = await nightOutService.listEvents(activeTab);
    setEvents(page.items);
    setCursor(page.nextCursor);
    return page;
  }, [activeTab]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await nightOutService.listEvents(activeTab, cursor);
      setEvents((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleEventChange(updated: NightOutEvent) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  return (
    <div className="min-h-screen bg-[#050508] pb-24 lg:pl-[220px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/95 backdrop-blur-xl border-b border-white/6 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff4d8d]/15 flex items-center justify-center">
              <PartyPopper className="w-4 h-4 text-[#ff4d8d]" />
            </div>
            <h1 className="text-xl font-bold text-white">Night Out</h1>
          </div>
          <button
            onClick={() => navigate('/night-out/create')}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-semibold"
          >
            Host an event
          </button>
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
          empty={listState.status === 'success' && events.length === 0}
          emptyMessage={EMPTY_MESSAGES[activeTab]}
          errorMessage="Couldn't load events."
          onRetry={listState.reload}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {events.map((event) => (
              <NightOutEventCard key={event.id} event={event} onChange={handleEventChange} />
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
