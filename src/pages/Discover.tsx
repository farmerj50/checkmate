import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, X, MapPin, BadgeCheck,
  Settings, Sparkles, Info, Crown, RefreshCw,
  Volume2, VolumeX, ChevronUp, Video, Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PremiumGate from '../components/PremiumGate';
import SignalButtons from '../components/SignalButtons';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { calculateAge } from '../utils/helpers';
import type { SwipeCard as SwipeCardType, Match, User, SignalType } from '../types';

// Ken Burns classes for static photos
const KB_CLASSES = ['kb1', 'kb2', 'kb3', 'kb4'];

const LOOKING_FOR_META: Record<string, { label: string; bg: string }> = {
  RELATIONSHIP: { label: '❤️ Relationship', bg: 'bg-pink-500/70' },
  CASUAL:       { label: '✨ Casual',       bg: 'bg-orange-500/65' },
  FRIENDSHIP:   { label: '👋 Friendship',   bg: 'bg-blue-500/65' },
  NETWORKING:   { label: '💼 Networking',   bg: 'bg-purple-500/65' },
};

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
          Send a Video 🎬
        </button>
        <button onClick={onClose} className="w-full py-3 rounded-2xl border-2 border-white/40 text-white font-medium active:scale-95 transition-transform">
          Keep Watching
        </button>
      </motion.div>
    </motion.div>
  );
}

// Signal feedback config
const SIGNAL_FEEDBACK: Record<SignalType, { color: string; message: string; emoji: string }> = {
  INTRIGUED:   { color: '#ff4d8d', message: 'Something caught your attention.', emoji: '🔥' },
  STIMULATING: { color: '#06b6d4', message: 'Mind engaged.',                    emoji: '🧠' },
  HIGH_VALUE:  { color: '#f59e0b', message: 'You recognized something rare.',    emoji: '💎' },
  ALIGNED:     { color: '#22c55e', message: 'Your instincts are aligned.',       emoji: '🎯' },
};

// ── Feed Card ─────────────────────────────────────────────────────────────────
function FeedCard({
  card, isActive, showDebug,
  onSignal, onPass, onTransitionChange,
}: {
  card: SwipeCardType;
  isActive: boolean;
  showDebug: boolean;
  onSignal: (type: SignalType) => void;
  onPass: () => void;
  onTransitionChange?: (v: boolean) => void;
}) {
  const { user, distance, compatibilityScore, commonInterests, scoreBreakdown } = card;

  // Build ordered media array: active video first, then photos, with optional prompt slide at index 1
  const mediaItems = useMemo(() => {
    const items: ({ type: 'video' | 'image'; url: string } | { type: 'prompt'; question: string; answer: string })[] = [];
    if (user.profileVideo) items.push({ type: 'video', url: user.profileVideo });
    for (const url of (user.profilePictures ?? [])) {
      if (url) items.push({ type: 'image', url });
    }
    if (card.prompt) {
      items.splice(1, 0, { type: 'prompt', question: card.prompt.question, answer: card.prompt.answer });
    }
    return items;
  }, [user.profileVideo, user.profilePictures, card.prompt]);

  const [mediaIndex, setMediaIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [flash, setFlash] = useState<'like' | 'pass' | 'super' | null>(null);
  const [debugWatchSec, setDebugWatchSec] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const kbClass = useRef(KB_CLASSES[Math.floor(Math.random() * KB_CLASSES.length)]);
  const watchStartRef = useRef<number | null>(null);
  const totalWatchRef = useRef<number>(0);

  const currentMedia = mediaItems[mediaIndex];
  const isVideoSlide = currentMedia?.type === 'video';
  const isPromptSlide = currentMedia?.type === 'prompt';
  const hasMedia = mediaItems.length > 0;

  const [signalFeedback, setSignalFeedback] = useState<{ type: SignalType; color: string; message: string; emoji: string } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  function getSignalMessage(type: SignalType): string {
    return {
      INTRIGUED:   'Something caught your eye.',
      STIMULATING: 'Mind engaged.',
      HIGH_VALUE:  'You recognized something rare.',
      ALIGNED:     'Your instincts are aligned.',
    }[type];
  }

  function handleSignal(type: SignalType) {
    const fb = SIGNAL_FEEDBACK[type];
    setIsTransitioning(true);
    onTransitionChange?.(true);
    setTimeout(() => setSignalFeedback({ type, ...fb }), 120);
    setTimeout(() => setSignalFeedback(null), 650);
    setTimeout(() => {
      setIsTransitioning(false);
      onTransitionChange?.(false);
      fireAction('like', () => onSignal(type));
    }, 850);
  }

  // Reset when card changes
  useEffect(() => {
    setMediaIndex(0);
    setVideoReady(false);
    setVideoError(false);
    setProfileOpen(false);
    totalWatchRef.current = 0;
    watchStartRef.current = null;
    setDebugWatchSec(0);
  }, [user.id]);

  // Watch-time tracking (accumulates while card is active)
  useEffect(() => {
    if (isActive) {
      watchStartRef.current = Date.now();
      const iv = setInterval(() => {
        const elapsed = watchStartRef.current ? (Date.now() - watchStartRef.current) / 1000 : 0;
        setDebugWatchSec(totalWatchRef.current + elapsed);
      }, 500);
      return () => clearInterval(iv);
    } else {
      if (watchStartRef.current) {
        totalWatchRef.current += (Date.now() - watchStartRef.current) / 1000;
        watchStartRef.current = null;
      }
      setDebugWatchSec(totalWatchRef.current);
    }
  }, [isActive]);

  // Video play/pause
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (!isActive || !isVideoSlide) {
      vid.pause();
      if (!isVideoSlide) vid.currentTime = 0;
      if (!isActive) setVideoReady(false);
      return;
    }
    if (vid.readyState >= 3) {
      vid.play().catch(() => {});
    } else {
      vid.load();
    }
  }, [isActive, isVideoSlide]);

  const handleCanPlay = () => {
    setVideoReady(true);
    if (isActive && isVideoSlide) {
      videoRef.current?.play().catch(() => {});
    }
  };

  const goMedia = useCallback((dir: 1 | -1) => {
    if (mediaItems.length <= 1) return;
    setMediaIndex(i => {
      const next = i + dir;
      if (next < 0 || next >= mediaItems.length) return i;
      return next;
    });
    setVideoReady(false);
  }, [mediaItems.length]);

  // Tap left/right on media area
  const handleMediaTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (profileOpen) { setProfileOpen(false); return; }
    if (mediaItems.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.38) goMedia(-1);
    else goMedia(1);
  };

  const fireAction = (type: 'like' | 'pass' | 'super', cb: () => void) => {
    setFlash(type);
    setTimeout(() => { setFlash(null); cb(); }, 420);
  };

  const age = calculateAge(user.dateOfBirth);
  const recentlyActive = user.lastActive
    ? Date.now() - new Date(user.lastActive).getTime() < 48 * 3_600_000
    : false;
  const lf = LOOKING_FOR_META[user.lookingFor];

  return (
    <motion.div
      className="relative w-full h-full bg-zinc-900 select-none overflow-hidden"
      animate={{
        scale: isTransitioning ? 0.975 : 1,
        opacity: isTransitioning ? 0.92 : 1,
        filter: isTransitioning ? 'brightness(0.9)' : 'brightness(1)',
      }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >

      {/* ── Background media ── */}

      {/* Fallback: no media at all */}
      {!hasMedia && (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
          <span className="text-white/15 text-9xl font-black">{user.firstName[0]}</span>
        </div>
      )}

      {/* Photo slide */}
      {isVideoSlide || isPromptSlide ? null : currentMedia && currentMedia.type === 'image' ? (
        <AnimatePresence mode="wait">
          <motion.img
            key={currentMedia.url}
            src={currentMedia.url}
            alt={user.firstName}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`absolute inset-0 w-full h-full object-cover object-top origin-top ${isActive ? kbClass.current : ''}`}
          />
        </AnimatePresence>
      ) : null}

      {/* Prompt slide — intentional pause moment */}
      {isPromptSlide && currentMedia.type === 'prompt' && (
        <motion.div
          key="prompt-slide"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] to-[#0a0a1a] flex flex-col items-center justify-center px-10 text-center z-[5]"
        >
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-6">Asked</p>
          <p className="text-white/50 text-sm mb-5 italic">"{currentMedia.question}"</p>
          <p className="text-white text-2xl font-bold leading-snug mb-6">"{currentMedia.answer}"</p>
          <p className="text-white/30 text-xs">Send a signal based on this ↓</p>
        </motion.div>
      )}

      {/* Photo shown behind video while buffering */}
      {isVideoSlide && !videoReady && (
        user.profilePictures?.[0] ? (
          <img
            src={user.profilePictures[0]}
            alt={user.firstName}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-white/15 text-9xl font-black">{user.firstName[0]}</span>
          </div>
        )
      )}

      {/* Video element (always mounted when video exists so it can buffer) */}
      {currentMedia?.type === 'video' && !videoError && (
        <video
          ref={videoRef}
          src={currentMedia.url}
          className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500"
          style={{ opacity: videoReady ? 1 : 0 }}
          loop
          muted={muted}
          playsInline
          preload="auto"
          onCanPlay={handleCanPlay}
          onError={() => setVideoError(true)}
        />
      )}

      {/* Buffering spinner */}
      {isVideoSlide && !videoReady && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="w-10 h-10 rounded-full animate-spin"
            style={{ border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'rgba(255,255,255,0.75)' }}
          />
        </div>
      )}

      {/* ── Gradient overlays ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.05) 60%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-0 top-0 h-28 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
      />

      {/* ── Media tap zones (top 62% of card — below header, above info) ── */}
      <div
        className="absolute inset-x-0 top-0 z-20"
        style={{ bottom: '38%' }}
        onClick={handleMediaTap}
      />

      {/* ── Top bar: per-media progress + badges ── */}
      <div className="absolute top-3 inset-x-3 z-30 flex flex-col gap-2 pointer-events-none">
        {/* Media progress segments */}
        {mediaItems.length > 1 && (
          <div className="flex gap-1">
            {mediaItems.map((_item, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    i <= mediaIndex ? 'bg-white w-full' : 'w-0'
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Badge row */}
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Match score + popularity badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-black/45 backdrop-blur-md rounded-full px-3 py-1.5">
              <Sparkles className="w-3 h-3 text-pink-400" />
              <span className="text-white text-xs font-semibold">{compatibilityScore}% match</span>
            </div>
            {compatibilityScore >= 90 && (
              <span className="bg-rose-500/80 backdrop-blur-md rounded-full px-2.5 py-1 text-white text-xs font-bold">
                💥 Hot
              </span>
            )}
            {compatibilityScore >= 75 && compatibilityScore < 90 && (
              <span className="bg-orange-500/70 backdrop-blur-md rounded-full px-2.5 py-1 text-white text-xs font-bold">
                🔥 Popular
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Media type icons — shows what's in this person's gallery */}
            {mediaItems.length > 1 && (
              <div className="flex items-center gap-1 bg-black/45 backdrop-blur-md rounded-full px-2.5 py-1.5">
                {mediaItems.map((item, i) => (
                  <span
                    key={i}
                    className={`transition-opacity ${i === mediaIndex ? 'opacity-100' : 'opacity-30'}`}
                  >
                    {item.type === 'video'
                      ? <Video className="w-3 h-3 text-white" />
                      : item.type === 'prompt'
                      ? <span className="text-[9px] leading-none">💬</span>
                      : <Camera className="w-3 h-3 text-white" />}
                  </span>
                ))}
              </div>
            )}

            {/* Info / expand toggle */}
            <button
              className="w-8 h-8 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center"
              onClick={() => setProfileOpen(v => !v)}
            >
              <Info className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom overlay: info + action buttons ── */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-44 flex items-end gap-3 z-30">

        {/* Left: info column */}
        <div className="flex-1 min-w-0">
          {/* Name + verified + online dot */}
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <h2 className="text-white text-[22px] font-bold leading-tight drop-shadow-lg">
              {user.firstName}, {age}
            </h2>
            {user.isVerified && <BadgeCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />}
            {recentlyActive && (
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            )}
          </div>

          {/* Occupation */}
          {user.occupation && (
            <p className="text-white/65 text-sm leading-tight mb-1.5">{user.occupation}</p>
          )}

          {/* Distance */}
          <div className="flex items-center gap-1 mb-2">
            <MapPin className="w-3 h-3 text-white/40 flex-shrink-0" />
            <span className="text-white/40 text-xs">
              {distance < 1 ? '< 1 km away' : `${Math.round(distance)} km away`}
            </span>
          </div>

          {/* Tags: lookingFor + shared interests */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {lf && (
              <span className={`px-2.5 py-0.5 rounded-full text-white text-[11px] font-semibold backdrop-blur-sm ${lf.bg}`}>
                {lf.label}
              </span>
            )}
            {commonInterests.slice(0, 2).map(tag => (
              <span key={tag} className="px-2.5 py-0.5 bg-white/15 backdrop-blur-sm text-white text-[11px] rounded-full">
                #{tag}
              </span>
            ))}
          </div>

          {/* "More" toggle */}
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-1 text-white/45 text-xs hover:text-white/75 transition-colors"
          >
            <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
            {profileOpen ? 'Less' : 'More about ' + user.firstName}
          </button>
        </div>

        {/* Right: mute + pass */}
        <div className="flex flex-col items-center gap-3 pb-1 flex-shrink-0">
          {isVideoSlide && (
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={() => setMuted(v => !v)}
              className="w-10 h-10 rounded-full bg-zinc-900/80 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
            >
              {muted
                ? <VolumeX className="w-4 h-4 text-white/60" />
                : <Volume2 className="w-4 h-4 text-white" />}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.82 }}
            onClick={() => fireAction('pass', onPass)}
            className="w-12 h-12 rounded-full bg-zinc-900/80 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
          >
            <X className="w-5 h-5 text-white/70" />
          </motion.button>
        </div>
      </div>

      {/* ── Signal buttons — full-width at bottom of card ── */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-30">
        <SignalButtons onSignal={handleSignal} disabled={!!signalFeedback || isTransitioning} />
      </div>

      {/* ── Expanded profile sheet (slides up from bottom) ── */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.12 }}
            onDragEnd={(_e, info) => { if (info.offset.y > 80) setProfileOpen(false); }}
            className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl overflow-hidden"
            style={{ background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(24px)', maxHeight: '70%' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Close button */}
            <button
              onClick={() => setProfileOpen(false)}
              className="absolute top-3 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>

            <div className="overflow-y-auto px-5 pb-8 pt-2">
              {/* Name header */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-white font-bold text-xl">{user.firstName}</h3>
                <span className="text-white/40 text-lg">{age}</span>
                {user.isVerified && <BadgeCheck className="w-5 h-5 text-blue-400" />}
              </div>

              {/* Active recently */}
              {recentlyActive && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-400 text-xs font-medium">Active recently</span>
                </div>
              )}

              {/* Bio */}
              {user.bio && (
                <p className="text-white/70 text-sm leading-relaxed mb-4">{user.bio}</p>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {lf && (
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className="text-white/30 text-xs mb-0.5">Looking for</p>
                    <p className="text-white font-medium text-sm">{lf.label}</p>
                  </div>
                )}
                <div className="bg-white/5 rounded-2xl p-3">
                  <p className="text-white/30 text-xs mb-0.5">Distance</p>
                  <p className="text-white font-medium text-sm">{distance < 1 ? '< 1 km' : `${Math.round(distance)} km`}</p>
                </div>
                {user.occupation && (
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className="text-white/30 text-xs mb-0.5">Work</p>
                    <p className="text-white font-medium text-sm truncate">{user.occupation}</p>
                  </div>
                )}
                {user.education && (
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className="text-white/30 text-xs mb-0.5">Education</p>
                    <p className="text-white font-medium text-sm truncate">{user.education}</p>
                  </div>
                )}
                {user.height && (
                  <div className="bg-white/5 rounded-2xl p-3">
                    <p className="text-white/30 text-xs mb-0.5">Height</p>
                    <p className="text-white font-medium text-sm">{user.height} cm</p>
                  </div>
                )}
                <div className="bg-white/5 rounded-2xl p-3">
                  <p className="text-white/30 text-xs mb-0.5">Location</p>
                  <p className="text-white font-medium text-sm truncate">{user.location}</p>
                </div>
              </div>

              {/* All interests — shared ones highlighted */}
              {user.interests?.length > 0 && (
                <div>
                  <p className="text-white/30 text-xs mb-2">Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {user.interests.map(tag => {
                      const shared = commonInterests.includes(tag);
                      return (
                        <span
                          key={tag}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                            shared
                              ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                              : 'bg-white/5 border-white/10 text-white/55'
                          }`}
                        >
                          {shared ? '♥ ' : ''}{tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Signal feedback overlay ── */}
      <AnimatePresence>
        {signalFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: [1, 1.02, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl pointer-events-none"
            style={{ background: `${signalFeedback.color}18` }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: `${signalFeedback.color}30`, border: `2px solid ${signalFeedback.color}` }}
            >
              <span className="text-3xl">{signalFeedback.emoji}</span>
            </div>
            <p className="text-white font-semibold text-lg tracking-tight">{signalFeedback.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Signal pill feedback ── */}
      <AnimatePresence>
        {signalFeedback && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="px-6 py-3 rounded-full bg-black/60 backdrop-blur-lg border border-white/10 shadow-2xl"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <p className="text-white text-sm font-semibold tracking-wide">
                {getSignalMessage(signalFeedback.type)}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action flash overlays ── */}
      <AnimatePresence>
        {flash === 'like' && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="border-[3px] border-pink-500 rounded-2xl px-8 py-3 rotate-[-12deg] bg-black/20 backdrop-blur-sm">
              <span className="text-pink-400 text-4xl font-black tracking-wider">LIKE</span>
            </div>
          </motion.div>
        )}
        {flash === 'pass' && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="border-[3px] border-zinc-400 rounded-2xl px-8 py-3 rotate-[12deg] bg-black/20 backdrop-blur-sm">
              <span className="text-zinc-300 text-4xl font-black tracking-wider">NOPE</span>
            </div>
          </motion.div>
        )}
        {flash === 'super' && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="border-[3px] border-yellow-400 rounded-2xl px-8 py-3 bg-black/20 backdrop-blur-sm">
              <span className="text-yellow-300 text-4xl font-black tracking-wider">SUPER ⭐</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dev debug overlay ── */}
      {showDebug && (
        <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
          <div className="bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 font-mono text-[11px] leading-relaxed space-y-0.5">
            <div className="text-green-400">⏱ {debugWatchSec.toFixed(1)}s watched</div>
            <div className="text-cyan-300">
              🎯 {compatibilityScore}%
              {scoreBreakdown && (
                <span className="text-cyan-300/70 ml-1">
                  I:{scoreBreakdown.interest} A:{scoreBreakdown.age} X:{scoreBreakdown.activity}
                </span>
              )}
            </div>
            <div className="text-white/60">
              {lf?.label ?? user.lookingFor} • {distance < 1 ? '< 1 km' : `${Math.round(distance)} km`}
            </div>
            <div className="text-white/40">
              👁 {mediaIndex + 1} of {mediaItems.length} media
            </div>
            <div className="text-purple-300">
              🧠 Intent: {
                debugWatchSec > 10 ? 'Hooked' :
                debugWatchSec > 5  ? 'Interested' :
                debugWatchSec > 2  ? 'Browsing' : 'Skimming'
              }
            </div>
            <div className="text-white/40">
              🎥 {isVideoSlide
                ? (videoReady ? (muted ? 'Video · Muted' : 'Video · Sound on') : 'Video · Buffering')
                : 'Photo slide'}
            </div>
            {card.reason && (
              <div className="text-yellow-300/80">🧩 {card.reason}</div>
            )}
            {scoreBreakdown && (
              <div className="text-orange-400/80">
                📊 {
                  // dominant weighted factor: interest×0.4, age×0.35, activity×0.25
                  scoreBreakdown.interest * 0.4 >= scoreBreakdown.age * 0.35 &&
                  scoreBreakdown.interest * 0.4 >= scoreBreakdown.activity * 0.25
                    ? 'Interests'
                    : scoreBreakdown.age * 0.35 >= scoreBreakdown.activity * 0.25
                    ? 'Age Match'
                    : 'Activity'
                } → {
                  debugWatchSec > 10 ? 'Hooked' :
                  debugWatchSec > 5  ? 'Interested' :
                  debugWatchSec > 2  ? 'Browsing' : 'Skimming'
                }
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Discover Page ─────────────────────────────────────────────────────────────
export default function Discover() {
  const navigate = useNavigate();
  const { dbUser } = useAuth();
  const [cards, setCards]             = useState<SwipeCardType[]>([]);
  const [dismissed, setDismissed]     = useState<Set<string>>(new Set());
  const [viewIndex, setViewIndex]     = useState(0);
  const [direction, setDirection]     = useState<1 | -1>(1);
  const [loading, setLoading]         = useState(true);
  const [newMatch, setNewMatch]       = useState<(Match & { otherUser: User }) | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [premiumGate, setPremiumGate] = useState<{ open: boolean; reason: 'likes' | 'super_likes' }>({ open: false, reason: 'likes' });
  const [refreshing, setRefreshing]   = useState(false);
  const [debugMode, setDebugMode]     = useState(false);

  const feedAreaRef    = useRef<HTMLDivElement>(null);
  const touchStartY    = useRef(0);
  const wheelCooling   = useRef(false);
  const blockSwipeRef  = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [discoverData, profileData] = await Promise.all([
          api.get<{ matches: SwipeCardType[] }>('/users/discover'),
          api.get<{ user: User }>('/users/profile'),
        ]);
        setCards(discoverData.matches);
        setCurrentUser(profileData.user);
      } catch {
        toast.error('Could not load profiles');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const visibleCards = cards.filter(c => !dismissed.has(c.user.id));

  const goNext = useCallback(() => {
    if (blockSwipeRef.current) return;
    setDirection(1);
    setViewIndex(i => Math.min(i + 1, Math.max(0, visibleCards.length - 1)));
  }, [visibleCards.length]);

  const goPrev = useCallback(() => {
    if (blockSwipeRef.current) return;
    setDirection(-1);
    setViewIndex(i => Math.max(0, i - 1));
  }, []);

  // Wheel (desktop / trackpad)
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

  // Touch (mobile swipe up/down)
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
      const discoverData = await api.get<{ matches: SwipeCardType[] }>('/users/discover');
      setCards(discoverData.matches);
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
    setDismissed(prev => new Set([...prev, cardId]));
  }, []);

  const handleSignal = useCallback(async (card: SwipeCardType, signalType: SignalType) => {
    dismiss(card.user.id);
    try {
      const data = await api.post<{ match: (Match & { otherUser: User }) | null; isMatch: boolean }>(
        '/matches/like', { receiverId: card.user.id, signalType }
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
          {!loading && hasMore && (
            <div className="flex gap-1 items-center mr-1">
              {visibleCards.slice(0, 6).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
                  i === clampedIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/25'
                }`} />
              ))}
            </div>
          )}
          {import.meta.env.DEV && (
            <button
              onClick={() => setDebugMode(v => !v)}
              className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold transition-colors ${
                debugMode ? 'bg-green-800 text-green-300' : 'bg-zinc-900 text-zinc-600'
              }`}
            >
              DBG
            </button>
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

      {/* ── Feed area ── */}
      <div
        ref={feedAreaRef}
        className="absolute inset-x-0 flex justify-center bg-black"
        style={{ top: HEADER_H, bottom: NAV_H }}
      >
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
                    showDebug={debugMode}
                    onSignal={(type) => handleSignal(card, type)}
                    onPass={() => handlePass(card)}
                    onTransitionChange={(v) => { blockSwipeRef.current = v; }}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
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
