import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, X, Star, MapPin, BadgeCheck,
  Settings, Sparkles, Info, Crown, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PremiumGate from '../components/PremiumGate';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { calculateAge } from '../utils/helpers';
import type { SwipeCard as SwipeCardType, Match, User } from '../types';

const KB_CLASSES = ['kb1', 'kb2', 'kb3', 'kb4'];

// ── Match Overlay ─────────────────────────────────────────────────────────────
function MatchOverlay({ match, currentUser, onClose, onMessage }: {
  match: Match & { otherUser: User };
  currentUser: User;
  onClose: () => void;
  onMessage: () => void;
}) {
  const other = match.otherUser;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-pink-600/95 to-rose-700/95 backdrop-blur-sm px-6 text-white text-center"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div key={i} className="absolute text-2xl pointer-events-none"
          style={{ left: `${Math.random() * 90 + 5}%`, top: `${Math.random() * 80 + 10}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0.5], y: -80 }}
          transition={{ duration: 2, delay: Math.random() * 1.5 }}>❤️</motion.div>
      ))}
      <motion.h1 initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }}
        className="text-4xl font-bold mb-2">It's a Match!</motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="text-white/80 mb-10">You and {other.firstName} liked each other</motion.p>
      <div className="flex items-center gap-4 mb-10">
        <motion.img initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          src={currentUser.profilePictures?.[0] || `https://ui-avatars.com/api/?name=${currentUser.firstName}&background=fff&color=ec4899`}
          alt="You" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl" />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }} className="text-3xl">💕</motion.div>
        <motion.img initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          src={other.profilePictures?.[0] || `https://ui-avatars.com/api/?name=${other.firstName}&background=fff&color=ec4899`}
          alt={other.firstName} className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl" />
      </div>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="w-full space-y-3">
        <button onClick={onMessage} className="w-full py-4 rounded-2xl bg-white text-pink-600 font-semibold text-lg shadow-lg active:scale-95 transition-transform">
          Send a Message 💬
        </button>
        <button onClick={onClose} className="w-full py-3 rounded-2xl border-2 border-white/40 text-white font-medium active:scale-95 transition-transform">
          Keep Watching
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Feed Card ─────────────────────────────────────────────────────────────────
function FeedCard({
  card, isActive, superLikesRemaining,
  onLike, onPass, onSuperLike,
}: {
  card: SwipeCardType;
  isActive: boolean;
  superLikesRemaining: number;
  onLike: () => void;
  onPass: () => void;
  onSuperLike: () => void;
}) {
  const { user, distance, compatibilityScore, commonInterests } = card;
  const [infoOpen, setInfoOpen] = useState(false);
  const [flash, setFlash] = useState<'like' | 'pass' | 'super' | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const kbClass = useRef(KB_CLASSES[Math.floor(Math.random() * KB_CLASSES.length)]);

  // Play when video has data and card is active; pause when leaving
  useEffect(() => {
    if (!videoRef.current) return;
    if (!isActive) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setVideoReady(false);
      return;
    }
    // If already has data, play immediately; otherwise onCanPlay will trigger it
    if (videoRef.current.readyState >= 3) {
      videoRef.current.play().catch(() => {});
    } else {
      // Kick off buffering
      videoRef.current.load();
    }
  }, [isActive]);

  const handleCanPlay = () => {
    setVideoReady(true);
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const fireAction = (type: 'like' | 'pass' | 'super', cb: () => void) => {
    setFlash(type);
    setTimeout(() => { setFlash(null); cb(); }, 420);
  };

  const photo = user.profilePictures?.[0];
  const hasVideo = !!user.profileVideo && !videoError;
  const age = calculateAge(user.dateOfBirth);

  return (
    <div className="relative w-full h-full bg-zinc-900 select-none">

      {/* ── Media ── */}

      {/* Photo layer — always shown; video renders on top once ready */}
      {photo ? (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={photo}
            alt={user.firstName}
            className={`absolute inset-0 w-full h-full object-cover object-top origin-top ${isActive && !hasVideo ? kbClass.current : ''}`}
          />
        </div>
      ) : !hasVideo ? (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
          <span className="text-white/20 text-8xl font-bold">{user.firstName[0]}</span>
        </div>
      ) : null}

      {/* Video layer — fades in once buffered */}
      {hasVideo && (
        <video
          ref={videoRef}
          src={user.profileVideo!}
          className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500"
          style={{ opacity: videoReady ? 1 : 0 }}
          loop
          muted
          playsInline
          preload="auto"
          onCanPlay={handleCanPlay}
          onError={() => setVideoError(true)}
        />
      )}

      {/* Buffering spinner (shows while video URL exists but hasn't buffered yet) */}
      {hasVideo && !videoReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 rounded-full border-3 border-white/20 border-t-white/80 animate-spin" style={{ borderWidth: 3 }} />
        </div>
      )}

      {/* ── Gradient overlays ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)' }} />

      {/* ── Top badges ── */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5">
          <Sparkles className="w-3 h-3 text-pink-400" />
          <span className="text-white text-xs font-semibold">{compatibilityScore}% match</span>
        </div>
        <button
          className="pointer-events-auto w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
          onClick={() => setInfoOpen(v => !v)}
        >
          <Info className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* ── Bottom info + actions ── */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-5 flex items-end gap-3">

        {/* Info column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h2 className="text-white text-[22px] font-bold leading-tight drop-shadow-lg">
              {user.firstName}, {age}
            </h2>
            {user.isVerified && <BadgeCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />}
          </div>

          {user.occupation && (
            <p className="text-white/70 text-sm leading-tight mb-0.5">{user.occupation}</p>
          )}

          <div className="flex items-center gap-1 mb-2">
            <MapPin className="w-3 h-3 text-white/45 flex-shrink-0" />
            <span className="text-white/45 text-xs">
              {distance < 1 ? '< 1 km away' : `${Math.round(distance)} km away`}
            </span>
          </div>

          {/* Expandable info */}
          <AnimatePresence>
            {infoOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                {user.bio && (
                  <p className="text-white/75 text-sm mb-2 leading-relaxed line-clamp-3">{user.bio}</p>
                )}
                {commonInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {commonInterests.slice(0, 4).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-pink-500/50 backdrop-blur-sm text-white text-xs rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons — right side, TikTok style */}
        <div className="flex flex-col items-center gap-3 pb-1 flex-shrink-0">
          {/* Super Like */}
          <div className="flex flex-col items-center gap-0.5">
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={() => superLikesRemaining > 0 && fireAction('super', onSuperLike)}
              disabled={superLikesRemaining === 0}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                superLikesRemaining === 0
                  ? 'bg-zinc-800/70 border border-zinc-700/50'
                  : 'bg-zinc-900/80 border border-white/20 backdrop-blur-sm'
              }`}
            >
              <Star className={`w-5 h-5 ${superLikesRemaining === 0 ? 'text-zinc-600' : 'text-yellow-300'}`} />
            </motion.button>
            <span className="text-white/40 text-[10px] font-medium">
              {superLikesRemaining > 0 ? `${superLikesRemaining}` : '—'}
            </span>
          </div>

          {/* Like */}
          <div className="flex flex-col items-center gap-0.5">
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={() => fireAction('like', onLike)}
              className="w-14 h-14 rounded-full bg-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/40"
            >
              <Heart className="w-7 h-7 text-white fill-white" />
            </motion.button>
            <span className="text-white/40 text-[10px] font-medium">Like</span>
          </div>

          {/* Pass */}
          <div className="flex flex-col items-center gap-0.5">
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={() => fireAction('pass', onPass)}
              className="w-12 h-12 rounded-full bg-zinc-900/80 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
            >
              <X className="w-5 h-5 text-white/70" />
            </motion.button>
            <span className="text-white/40 text-[10px] font-medium">Pass</span>
          </div>
        </div>
      </div>

      {/* ── Flash overlays ── */}
      <AnimatePresence>
        {flash === 'like' && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="border-[3px] border-pink-500 rounded-2xl px-8 py-3 rotate-[-12deg] bg-black/20 backdrop-blur-sm">
              <span className="text-pink-400 text-4xl font-black tracking-wider">LIKE</span>
            </div>
          </motion.div>
        )}
        {flash === 'pass' && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="border-[3px] border-zinc-400 rounded-2xl px-8 py-3 rotate-[12deg] bg-black/20 backdrop-blur-sm">
              <span className="text-zinc-300 text-4xl font-black tracking-wider">NOPE</span>
            </div>
          </motion.div>
        )}
        {flash === 'super' && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="border-[3px] border-yellow-400 rounded-2xl px-8 py-3 bg-black/20 backdrop-blur-sm">
              <span className="text-yellow-300 text-4xl font-black tracking-wider">SUPER ⭐</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Discover Page ─────────────────────────────────────────────────────────────
export default function Discover() {
  const navigate = useNavigate();
  const { dbUser } = useAuth();
  const [cards, setCards]           = useState<SwipeCardType[]>([]);
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set());
  const [viewIndex, setViewIndex]   = useState(0);   // index into visibleCards
  const [direction, setDirection]   = useState<1 | -1>(1); // animation direction
  const [loading, setLoading]       = useState(true);
  const [newMatch, setNewMatch]     = useState<(Match & { otherUser: User }) | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [superLikesRemaining, setSuperLikesRemaining] = useState(3);
  const [premiumGate, setPremiumGate] = useState<{ open: boolean; reason: 'likes' | 'super_likes' }>({ open: false, reason: 'likes' });
  const [refreshing, setRefreshing] = useState(false);

  const feedAreaRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const wheelCooling = useRef(false);

  // ── Data load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [discoverData, profileData, superData] = await Promise.all([
          api.get<{ matches: SwipeCardType[] }>('/users/discover'),
          api.get<{ user: User }>('/users/profile'),
          api.get<{ remaining: number }>('/users/super-likes/remaining'),
        ]);
        setCards(discoverData.matches);
        setCurrentUser(profileData.user);
        setSuperLikesRemaining(superData.remaining);
      } catch {
        toast.error('Could not load profiles');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const visibleCards = cards.filter(c => !dismissed.has(c.user.id));

  const goNext = useCallback(() => {
    setDirection(1);
    setViewIndex(i => Math.min(i + 1, Math.max(0, visibleCards.length - 1)));
  }, [visibleCards.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setViewIndex(i => Math.max(0, i - 1));
  }, []);

  // ── Wheel (desktop scroll / trackpad) ────────────────────────────────────
  useEffect(() => {
    const el = feedAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelCooling.current) return;
      wheelCooling.current = true;
      setTimeout(() => { wheelCooling.current = false; }, 650);
      if (e.deltaY > 5)       goNext();
      else if (e.deltaY < -5) goPrev();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [goNext, goPrev]);

  // ── Touch (mobile swipe) ──────────────────────────────────────────────────
  useEffect(() => {
    const el = feedAreaRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onEnd   = (e: TouchEvent) => {
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      if (dy > 60)       goNext();
      else if (dy < -60) goPrev();
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [goNext, goPrev]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [discoverData, superData] = await Promise.all([
        api.get<{ matches: SwipeCardType[] }>('/users/discover'),
        api.get<{ remaining: number }>('/users/super-likes/remaining'),
      ]);
      setCards(discoverData.matches);
      setSuperLikesRemaining(superData.remaining);
      setDismissed(new Set());
      setViewIndex(0);
    } catch {
      toast.error('Could not refresh feed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const dismiss = useCallback((cardId: string) => {
    // Remove from visible set — viewIndex stays, next card slides in
    setDismissed(prev => new Set([...prev, cardId]));
  }, []);

  const handleLike = useCallback(async (card: SwipeCardType) => {
    dismiss(card.user.id);
    try {
      const data = await api.post<{ match: (Match & { otherUser: User }) | null; isMatch: boolean }>(
        '/matches/like', { receiverId: card.user.id, isSuper: false }
      );
      if (data.isMatch && data.match) setNewMatch({ ...data.match, otherUser: card.user });
    } catch (err: any) {
      if (err?.status === 429) {
        setDismissed(prev => { const s = new Set(prev); s.delete(card.user.id); return s; });
        setPremiumGate({ open: true, reason: 'likes' });
      }
    }
  }, [dismiss]);

  const handlePass = useCallback(async (card: SwipeCardType) => {
    dismiss(card.user.id);
    try { await api.post('/matches/pass', { receiverId: card.user.id }); } catch { /* non-critical */ }
  }, [dismiss]);

  const handleSuperLike = useCallback(async (card: SwipeCardType) => {
    if (superLikesRemaining === 0) return;
    setSuperLikesRemaining(n => Math.max(0, n - 1));
    dismiss(card.user.id);
    try {
      const data = await api.post<{ match: (Match & { otherUser: User }) | null; isMatch: boolean }>(
        '/matches/like', { receiverId: card.user.id, isSuper: true }
      );
      toast('⭐ Super Like sent!', { icon: '💙' });
      if (data.isMatch && data.match) setNewMatch({ ...data.match, otherUser: card.user });
    } catch (err: any) {
      setSuperLikesRemaining(n => n + 1);
      setDismissed(prev => { const s = new Set(prev); s.delete(card.user.id); return s; });
      if (err?.status === 429) setPremiumGate({ open: true, reason: 'super_likes' });
    }
  }, [superLikesRemaining, dismiss]);

  const clampedIndex = Math.min(viewIndex, Math.max(0, visibleCards.length - 1));
  const card = visibleCards[clampedIndex];
  const hasMore = visibleCards.length > 0;

  const HEADER_H = 52;
  const NAV_H    = 68;

  return (
    <div className="fixed inset-0 bg-black">

      {/* ── Header ── */}
      <div className="absolute top-0 inset-x-0 z-20 bg-black flex items-center justify-between px-4"
        style={{ height: HEADER_H }}>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
          <span className="text-white font-bold text-lg tracking-tight">Discover</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress indicator */}
          {!loading && hasMore && (
            <div className="flex gap-1 items-center mr-1">
              {visibleCards.slice(0, 6).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
                  i === clampedIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/25'
                }`} />
              ))}
            </div>
          )}
          <motion.button onClick={refresh} disabled={refreshing} whileTap={{ scale: 0.88 }}
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={refreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.2 }}
            className="p-2 rounded-full bg-zinc-900 disabled:opacity-50">
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </motion.button>
          <button onClick={() => navigate('/settings')} className="p-2 rounded-full bg-zinc-900">
            <Settings className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* ── Feed area — wheel & touch handled here ── */}
      <div ref={feedAreaRef}
        className="absolute inset-x-0 flex justify-center bg-black"
        style={{ top: HEADER_H, bottom: NAV_H }}>

        {loading ? (
          <div className="flex items-center justify-center w-full">
            <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !hasMore ? (
          <div className="flex flex-col items-center justify-center text-center px-8 w-full max-w-sm">
            <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-pink-500/30">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">You're all caught up!</h2>
            <p className="text-zinc-500 mb-6 text-sm leading-relaxed">
              No more profiles right now. Check back later or adjust your preferences.
            </p>
            <button onClick={() => navigate('/settings')}
              className="px-6 py-3 rounded-2xl bg-pink-600 text-white font-semibold text-sm">
              Adjust Preferences
            </button>
          </div>
        ) : (
          /* Single card slot — AnimatePresence slides in/out on viewIndex change */
          <div className="relative w-full max-w-[430px] h-full px-2 py-2">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={card.user.id}
                custom={direction}
                initial={{ y: direction > 0 ? '100%' : '-100%', opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: direction > 0 ? '-100%' : '100%', opacity: 0.5 }}
                transition={{ duration: 0.32, ease: [0.32, 0, 0.67, 0] }}
                className="absolute inset-2"
              >
                <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
                  <FeedCard
                    card={card}
                    isActive={true}
                    superLikesRemaining={superLikesRemaining}
                    onLike={() => handleLike(card)}
                    onPass={() => handlePass(card)}
                    onSuperLike={() => handleSuperLike(card)}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Bottom Nav — absolute, fixed height ── */}
      <div
        className="absolute bottom-0 inset-x-0 bg-black border-t border-zinc-900 flex justify-around items-center px-8"
        style={{ height: NAV_H }}
      >
        <button onClick={() => navigate('/matches')} className="flex flex-col items-center gap-1">
          <Heart className="w-5 h-5 text-zinc-500" />
          <span className="text-zinc-600 text-[10px]">Matches</span>
        </button>
        <button onClick={() => navigate('/premium')} className="flex flex-col items-center gap-1">
          <Crown className="w-5 h-5 text-zinc-500" />
          <span className="text-zinc-600 text-[10px]">Premium</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1">
          {dbUser?.profilePictures?.[0] ? (
            <img src={dbUser.profilePictures[0]} className="w-6 h-6 rounded-full object-cover border border-zinc-700" alt="me" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700" />
          )}
          <span className="text-zinc-600 text-[10px]">Profile</span>
        </button>
      </div>

      {/* ── Premium Gate ── */}
      <PremiumGate
        open={premiumGate.open}
        reason={premiumGate.reason}
        onClose={() => setPremiumGate(s => ({ ...s, open: false }))}
      />

      {/* ── Match Overlay ── */}
      <AnimatePresence>
        {newMatch && currentUser && (
          <MatchOverlay
            match={newMatch}
            currentUser={currentUser}
            onClose={() => setNewMatch(null)}
            onMessage={() => { setNewMatch(null); navigate(`/chat/${newMatch.id}`); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
