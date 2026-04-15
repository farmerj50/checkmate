import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, Briefcase, GraduationCap, Heart, Ruler,
  BadgeCheck, Video, ChevronDown, ChevronUp, Flag, Ban,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import ReportModal from '../components/ReportModal';
import { calculateAge } from '../utils/helpers';

const LOOKING_FOR_LABELS: Record<string, string> = {
  RELATIONSHIP: 'Relationship',
  CASUAL: 'Casual dating',
  FRIENDSHIP: 'Friendship',
  NETWORKING: 'Networking',
};

interface MatchUser {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  location: string;
  bio?: string;
  occupation?: string;
  education?: string;
  height?: number;
  interests: string[];
  lookingFor: string;
  ageRangeMin: number;
  ageRangeMax: number;
  maxDistance: number;
  profileVideos: string[];
  profileVideo?: string;
  isVerified: boolean;
  lastActive: string;
}

export default function MatchProfile() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<MatchUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoIndex, setVideoIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showPrefs, setShowPrefs] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const wheelCooling = useRef(false);
  const touchStart = useRef(0);

  useEffect(() => {
    if (!matchId) return;
    api
      .get<{ user: MatchUser }>(`/matches/${matchId}/profile`)
      .then((d) => setUser(d.user))
      .catch(() => { toast.error('Could not load profile'); navigate('/matches'); })
      .finally(() => setLoading(false));
  }, [matchId, navigate]);

  const videos = user?.profileVideos ?? [];
  const total = videos.length;

  const goNext = useCallback(() => {
    if (!total) return;
    setDirection(1);
    setVideoIndex((i) => (i + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (!total) return;
    setDirection(-1);
    setVideoIndex((i) => (i - 1 + total) % total);
  }, [total]);

  // Wheel navigation
  useEffect(() => {
    const el = feedRef.current;
    if (!el || total <= 1) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelCooling.current) return;
      wheelCooling.current = true;
      setTimeout(() => { wheelCooling.current = false; }, 600);
      if (e.deltaY > 5) goNext();
      else if (e.deltaY < -5) goPrev();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [goNext, goPrev, total]);

  // Touch navigation
  useEffect(() => {
    const el = feedRef.current;
    if (!el || total <= 1) return;
    const onTouchStart = (e: TouchEvent) => { touchStart.current = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      const delta = touchStart.current - e.changedTouches[0].clientY;
      if (delta > 50) goNext();
      else if (delta < -50) goPrev();
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [goNext, goPrev, total]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={() => navigate('/matches')}
          className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
          <h2 className="text-white font-semibold text-sm">{user.firstName}</h2>
          {user.isVerified && <BadgeCheck className="w-4 h-4 text-blue-400" />}
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <Flag className="w-4 h-4 text-white/70" />
        </button>

        {/* Report/Block dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              className="absolute right-4 top-16 bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-44 py-1 z-40"
            >
              <button
                onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
              >
                <Flag className="w-4 h-4 text-red-400" /> Report
              </button>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  try {
                    await api.post(`/safety/block/${user.id}`, {});
                    toast.success(`${user.firstName} blocked`);
                    navigate('/matches');
                  } catch { toast.error('Could not block user'); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10"
              >
                <Ban className="w-4 h-4" /> Block
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Video feed */}
      <div
        ref={feedRef}
        className="flex-1 relative"
        style={{ height: showPrefs ? '55vh' : '100vh' }}
      >
        {total === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900">
            <Video className="w-12 h-12 text-white/20" />
            <p className="text-white/40 text-sm">{user.firstName} hasn't uploaded any videos yet.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={videoIndex}
              custom={direction}
              initial={{ y: direction > 0 ? '100%' : '-100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: direction > 0 ? '-100%' : '100%', opacity: 0.6 }}
              transition={{ duration: 0.3, ease: [0.32, 0, 0.67, 0] }}
              className="absolute inset-0"
            >
              <video
                src={videos[videoIndex]}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted={false}
                playsInline
              />

              {/* Gradient overlay — bottom */}
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />

              {/* Video counter */}
              {total > 1 && (
                <div className="absolute top-16 right-4 flex flex-col gap-1 items-center">
                  {videos.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all ${
                        i === videoIndex ? 'h-6 bg-white' : 'h-2 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Name + preferences toggle */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold text-2xl">
                        {user.firstName}, {calculateAge(user.dateOfBirth)}
                      </span>
                      {user.isVerified && <BadgeCheck className="w-5 h-5 text-blue-400" />}
                    </div>
                    {user.occupation && (
                      <p className="text-white/70 text-sm">{user.occupation}</p>
                    )}
                    <p className="text-white/50 text-xs mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{user.location}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowPrefs((v) => !v)}
                    className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs font-medium"
                  >
                    {showPrefs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    {showPrefs ? 'Hide' : 'About'}
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Dating preferences panel */}
      <AnimatePresence>
        {showPrefs && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="bg-gray-950 border-t border-white/10 overflow-y-auto"
            style={{ maxHeight: '45vh' }}
          >
            <div className="px-5 py-5 space-y-5">
              {/* Bio */}
              {user.bio && (
                <div>
                  <p className="text-white/80 text-sm leading-relaxed">{user.bio}</p>
                </div>
              )}

              {/* Preferences grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 rounded-2xl p-3">
                  <p className="text-white/30 text-xs mb-1">Looking for</p>
                  <p className="text-white font-medium text-sm flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                    {LOOKING_FOR_LABELS[user.lookingFor] ?? user.lookingFor}
                  </p>
                </div>

                <div className="bg-gray-900 rounded-2xl p-3">
                  <p className="text-white/30 text-xs mb-1">Age preference</p>
                  <p className="text-white font-medium text-sm">
                    {user.ageRangeMin} – {user.ageRangeMax} yrs
                  </p>
                </div>

                {user.height && (
                  <div className="bg-gray-900 rounded-2xl p-3">
                    <p className="text-white/30 text-xs mb-1">Height</p>
                    <p className="text-white font-medium text-sm flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-white/40" />
                      {user.height} cm
                    </p>
                  </div>
                )}

                {user.education && (
                  <div className="bg-gray-900 rounded-2xl p-3">
                    <p className="text-white/30 text-xs mb-1">Education</p>
                    <p className="text-white font-medium text-sm flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-white/40" />
                      {user.education}
                    </p>
                  </div>
                )}

                {user.occupation && (
                  <div className="bg-gray-900 rounded-2xl p-3 col-span-2">
                    <p className="text-white/30 text-xs mb-1">Occupation</p>
                    <p className="text-white font-medium text-sm flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-white/40" />
                      {user.occupation}
                    </p>
                  </div>
                )}
              </div>

              {/* Interests */}
              {user.interests.length > 0 && (
                <div>
                  <p className="text-white/30 text-xs mb-2">Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {user.interests.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-pink-500/15 text-pink-400 border border-pink-500/20 rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Last active */}
              <p className="text-white/20 text-xs">
                Active {formatDistanceToNow(new Date(user.lastActive), { addSuffix: true })}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report modal */}
      {reportOpen && (
        <ReportModal
          userId={user.id}
          userName={user.firstName}
          onClose={() => setReportOpen(false)}
          onBlocked={() => navigate('/matches')}
        />
      )}
    </div>
  );
}
