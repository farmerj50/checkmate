import { useNavigate } from 'react-router-dom';
import { Heart, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { normalizeAssetUrl } from '../../utils/helpers';
import { nightOutService, type NightOutEvent } from '../../services/nightOut';

import { NIGHT_OUT_CATEGORY_LABELS, formatEventPrice } from '../../services/nightOut/presentation';

interface Props {
  event: NightOutEvent;
  onChange: (updated: NightOutEvent) => void;
}

export default function NightOutEventCard({ event, onChange }: Props) {
  const navigate = useNavigate();
  const media = normalizeAssetUrl(event.videoUrl);

  async function toggleSave(e: React.MouseEvent) {
    e.stopPropagation();
    const before = event;
    try {
      const updated = event.isSaved
        ? await nightOutService.unsaveEvent(event.id)
        : await nightOutService.saveEvent(event.id);
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
      onClick={() => navigate(`/night-out/${event.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/night-out/${event.id}`); }}
      className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-black text-left group cursor-pointer"
    >
      <video
        src={media ? `${media}#t=0.001` : ''}
        className="w-full h-full object-cover"
        muted playsInline preload="metadata"
      />

      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      <button
        onClick={toggleSave}
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
      >
        <Heart className={`w-4 h-4 ${event.isSaved ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white'}`} />
      </button>

      <span className="absolute top-2.5 left-2.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold">
        {NIGHT_OUT_CATEGORY_LABELS[event.category]}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3 space-y-0.5">
        <h3 className="text-white font-bold text-sm leading-tight line-clamp-1">{event.title}</h3>
        <p className="text-white/70 text-xs flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 flex-none" />
          {event.venueName}
        </p>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-white/70 text-xs">{format(new Date(event.startTime), 'EEE, MMM d · h:mm a')}</span>
          <span className="text-white text-xs font-semibold">{formatEventPrice(event.coverPrice)}</span>
        </div>
      </div>
    </div>
  );
}
