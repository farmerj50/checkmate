import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, MapPin, Clock, Ticket, Share2, MoreVertical, Flag, Heart } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAsync } from '../hooks/useAsync';
import AsyncState from '../components/ui/AsyncState';
import { normalizeAssetUrl } from '../utils/helpers';
import { nightOutService, type NightOutEvent } from '../services/nightOut';
import { NIGHT_OUT_CATEGORY_LABELS, formatEventPrice } from '../services/nightOut/presentation';
import ReportEventModal from '../components/nightOut/ReportEventModal';

const AGE_LABELS = { ALL_AGES: 'All ages', EIGHTEEN_PLUS: '18+', TWENTYONE_PLUS: '21+' } as const;

export default function NightOutDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [localEvent, setLocalEvent] = useState<NightOutEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const eventState = useAsync(
    () => (eventId ? nightOutService.getEvent(eventId) : Promise.resolve(null)),
    [eventId]
  );

  const event = localEvent ?? eventState.data ?? null;

  async function toggleSave() {
    if (!event || saving) return;
    setSaving(true);
    const before = event;
    try {
      const updated = event.isSaved
        ? await nightOutService.unsaveEvent(event.id)
        : await nightOutService.saveEvent(event.id);
      setLocalEvent(updated);
    } catch {
      setLocalEvent(before);
      toast.error('Could not update — try again');
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    if (!event) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event.title, url }).catch(() => {});
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
          <span className="text-white font-semibold truncate">Event</span>
        </div>

        {event && (
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
                      <Flag className="w-4 h-4 text-red-400" /> Report event
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AsyncState
        loading={eventState.status === 'loading'}
        error={eventState.error}
        empty={eventState.status === 'success' && !event}
        emptyMessage="This event isn't available."
        errorMessage="Couldn't load this event."
        onRetry={eventState.reload}
      >
        {event && (
          <div>
            {/* Hero video */}
            <div className="bg-black" style={{ aspectRatio: '4/3' }}>
              <video
                src={normalizeAssetUrl(event.videoUrl) ?? ''}
                className="w-full h-full object-cover"
                autoPlay loop muted playsInline
              />
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Title + category */}
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full bg-[#ff4d8d]/15 text-[#ff4d8d] text-xs font-semibold mb-2">
                  {NIGHT_OUT_CATEGORY_LABELS[event.category]}
                </span>
                <h1 className="text-white text-2xl font-bold leading-tight">{event.title}</h1>
              </div>

              {/* Info rows */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5 text-white/70">
                  <Clock className="w-4 h-4 flex-none mt-0.5" />
                  <span>
                    {format(new Date(event.startTime), 'EEEE, MMM d · h:mm a')}
                    {event.endTime && ` – ${format(new Date(event.endTime), 'h:mm a')}`}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-white/70">
                  <MapPin className="w-4 h-4 flex-none mt-0.5" />
                  <span>{event.venueName} — {event.address}, {event.city}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <span className="px-2.5 py-1 rounded-full bg-white/8 text-white/60 text-xs font-medium">
                    {AGE_LABELS[event.ageRestriction]}
                  </span>
                  <span className="text-white font-semibold">{formatEventPrice(event.coverPrice)}</span>
                </div>
              </div>

              {event.description && (
                <p className="text-white/60 text-sm leading-relaxed border-t border-white/6 pt-4">
                  {event.description}
                </p>
              )}

              {/* Host */}
              <button
                onClick={() => navigate(`/night-out/host/${event.hostId}`)}
                className="flex items-center gap-3 border-t border-white/6 pt-4 w-full"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex-none">
                  {event.host.profilePictures[0] && (
                    <img src={normalizeAssetUrl(event.host.profilePictures[0])} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold text-sm truncate">{event.host.firstName}</span>
                    {event.host.isVerified && <BadgeCheck className="w-4 h-4 text-[#ff4d8d] flex-none" />}
                  </div>
                  <span className="text-white/40 text-xs">Hosted by</span>
                </div>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-3 border-t border-white/6 pt-4">
                <button
                  onClick={toggleSave}
                  disabled={saving}
                  className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center flex-none disabled:opacity-50"
                >
                  <Heart className={`w-5 h-5 ${event.isSaved ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white/70'}`} />
                </button>
                {event.ticketUrl && (
                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-semibold text-sm"
                  >
                    <Ticket className="w-4 h-4" /> Get Tickets
                  </a>
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

      {reportOpen && event && (
        <ReportEventModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
