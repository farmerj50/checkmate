/**
 * 🔍 EXPLORE — TikTok desktop layout
 * Left sidebar (nav + search) | Center video feed | Right video-replies panel
 * Bottom nav is hidden on this route (Navigation.tsx returns null for /explore).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { Heart, UserPlus, BadgeCheck, Loader2, Volume2, VolumeX, X, Search, Home, PlusSquare, Bell, Film, User, Video as VideoIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { normalizeAssetUrl } from '../utils/helpers';
import { socialService, type SocialPost } from '../services/social';
import { useAsync } from '../hooks/useAsync';
import AsyncState from '../components/ui/AsyncState';
import ReactionBar from '../components/social/ReactionBar';
import ReplyRecorderModal from '../components/social/ReplyRecorderModal';

interface DiscoverPost extends SocialPost {
  isFollowing: boolean;
}

export default function Explore() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [posts, setPosts]             = useState<DiscoverPost[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState<Error | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor]           = useState<string | null>(null);
  const [hasMore, setHasMore]         = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted]             = useState(true);
  const [repliesPostId, setRepliesPostId] = useState<string | null>(null);
  const [query, setQuery]             = useState('');
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (cur?: string) => {
    try {
      setLoadError(null);
      const { items, nextCursor } = await socialService.getFeed(cur);
      const mapped: DiscoverPost[] = items.map((p) => ({ ...p, isFollowing: false }));
      if (cur) setPosts((prev) => [...prev, ...mapped]);
      else setPosts(mapped);
      setCursor(nextCursor);
      setHasMore(!!nextCursor && items.length > 0);
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  useEffect(() => { fetchFeed().finally(() => setLoading(false)); }, [fetchFeed]);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore) {
        setLoadingMore(true);
        fetchFeed(cursor ?? undefined).finally(() => setLoadingMore(false));
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, hasMore, loadingMore, fetchFeed]);

  // Track active slide
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slides = container.querySelectorAll('[data-slide]');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          setActiveIndex(Number((e.target as HTMLElement).dataset.slide));
        }
      });
    }, { threshold: 0.6 });
    slides.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [posts.length]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredPosts = query.trim()
    ? posts.filter((p) => p.author.firstName.toLowerCase().includes(query.toLowerCase()))
    : posts;

  function handlePostChange(updated: SocialPost) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }

  async function toggleFollow(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const next = !post.isFollowing;
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isFollowing: next } : p));
    try {
      if (next) await socialService.follow(post.authorId);
      else await socialService.unfollow(post.authorId);
    } catch {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isFollowing: !next } : p));
      toast.error('Failed to update follow');
    }
  }

  const repliesPost = posts.find((p) => p.id === repliesPostId);

  return (
    <div className="fixed inset-0 bg-[#050508] flex">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="flex-none flex flex-col bg-[#0a0a0f] relative z-10" style={{ width: 220 }}>
        {/* Logo */}
        <div className="px-6 py-5 flex-none">
          <span className="text-white font-bold text-lg tracking-tight">CheckMate</span>
        </div>

        {/* Rectangular search bar — clicking opens nav */}
        <div className="px-4 pb-3 flex-none relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSidebarOpen(true)}
              onBlur={() => setTimeout(() => setSidebarOpen(false), 150)}
              placeholder="Search…"
              autoComplete="off"
              className="w-full bg-white/6 border border-white/10 rounded-md pl-9 pr-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#ff4d8d]/40 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Nav links — always visible */}
        <AnimatePresence>
          {(sidebarOpen || !query) && (
            <motion.nav
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex-1 px-3 space-y-1"
            >
              {[
                { to: '/home',          icon: Home,       label: 'Home' },
                { to: '/explore',       icon: Search,     label: 'Explore' },
                { to: '/create',        icon: PlusSquare, label: 'Create' },
                { to: '/matches',       icon: Heart,      label: 'Matches' },
                { to: '/notifications', icon: Bell,       label: 'Alerts' },
                { to: '/studio',        icon: Film,       label: 'Studio' },
                { to: '/profile',       icon: User,       label: 'Profile' },
              ].map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[#ff4d8d]/12 text-[#ff4d8d]' : 'text-white/50 hover:text-white hover:bg-white/5'}`
                }>
                  <Icon className="w-5 h-5 flex-none" />
                  {label}
                </NavLink>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </aside>

      {/* ── CENTER: SNAP VIDEO FEED ── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-scroll"
          style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
        >
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#ff4d8d] animate-spin" />
            </div>
          ) : loadError ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <p className="text-white/40 text-sm">Couldn't load posts.</p>
              <button onClick={() => { setLoading(true); fetchFeed().finally(() => setLoading(false)); }} className="text-[#ff4d8d] text-sm font-semibold">
                Try again
              </button>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
              <p className="text-white/40 text-sm">{query ? `No results for "${query}"` : 'No posts yet.'}</p>
            </div>
          ) : filteredPosts.map((post, idx) => (
            <VideoSlide
              key={post.id}
              post={post}
              idx={idx}
              isActive={idx === activeIndex}
              muted={muted}
              repliesOpen={repliesPostId === post.id}
              onMuteToggle={() => setMuted((m) => !m)}
              onChange={handlePostChange}
              onReply={() => setRepliesPostId(repliesPostId === post.id ? null : post.id)}
              onFollow={() => toggleFollow(post.id)}
              onProfile={() => navigate(`/profile/${post.authorId}`)}
            />
          ))}

          <div ref={loaderRef} className="flex justify-center items-center py-6" style={{ scrollSnapAlign: 'none' }}>
            {loadingMore && <Loader2 className="w-5 h-5 text-white/30 animate-spin" />}
            {!hasMore && filteredPosts.length > 0 && <p className="text-white/20 text-xs">You've seen it all</p>}
          </div>
        </div>
      </div>

      {/* ── RIGHT: VIDEO REPLIES PANEL ── */}
      <AnimatePresence>
        {repliesPost && (
          <motion.aside
            key="replies"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="flex-none flex flex-col bg-[#0a0a0f] border-l border-white/8 overflow-hidden"
          >
            <RepliesPanel postId={repliesPost.id} onClose={() => setRepliesPostId(null)} />
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  );
}

/* ─────────────────────────────────────────── */

interface VideoSlideProps {
  post: DiscoverPost;
  idx: number;
  isActive: boolean;
  muted: boolean;
  repliesOpen: boolean;
  onMuteToggle: () => void;
  onChange: (updated: SocialPost) => void;
  onReply: () => void;
  onFollow: () => void;
  onProfile: () => void;
}

function VideoSlide({ post, idx, isActive, muted, repliesOpen, onMuteToggle, onChange, onReply, onFollow, onProfile }: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const media = normalizeAssetUrl(post.videoUrl);
  const avatar = normalizeAssetUrl(post.author.profilePictures?.[0]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) v.play().catch(() => {});
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  return (
    <div
      data-slide={idx}
      className="w-full h-full flex items-center justify-center bg-[#050508]"
      style={{ scrollSnapAlign: 'start', flexShrink: 0, height: '100dvh' }}
    >
      {/* Card + actions row */}
      <div className="flex items-end gap-4" style={{ height: '90dvh', maxHeight: 780 }}>

        {/* Portrait video card */}
        <div
          className="relative bg-black rounded-2xl overflow-hidden flex-none shadow-2xl group"
          style={{ aspectRatio: '9/16', height: '100%' }}
        >
          <video ref={videoRef} src={media ?? ''} className="absolute inset-0 w-full h-full object-cover" loop muted playsInline />

          {/* Bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

          {/* Mute — inside card, fades in on hover */}
          <button
            onClick={onMuteToggle}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Author + caption */}
          <div className="absolute bottom-5 left-4 right-4 z-10">
            <button onClick={onProfile} className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-white/20 overflow-hidden ring-2 ring-white/30 flex-none">
                {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-semibold text-sm drop-shadow">{post.author.firstName}</span>
                {post.author.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#ff4d8d]" />}
              </div>
            </button>
            {post.caption && (
              <p className="text-white/85 text-sm leading-snug drop-shadow line-clamp-2">{post.caption}</p>
            )}
          </div>
        </div>

        {/* Action buttons — RIGHT of card, bottom-aligned */}
        <div className="flex flex-col items-center gap-6 pb-5 flex-none">
          <button onClick={onFollow} className={`flex flex-col items-center gap-1.5 ${post.isFollowing ? 'text-[#ff4d8d]' : 'text-white'}`}>
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-white/60 text-[11px]">{post.isFollowing ? 'Following' : 'Follow'}</span>
          </button>

          <ReactionBar post={post} onChange={onChange} variant="rail" />

          <button onClick={onReply} className="flex flex-col items-center gap-1.5">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${repliesOpen ? 'bg-[#ff4d8d]/20 ring-1 ring-[#ff4d8d]/40' : 'bg-white/10 hover:bg-white/20'}`}>
              <VideoIcon className={`w-5 h-5 ${repliesOpen ? 'text-[#ff4d8d]' : 'text-white'}`} />
            </div>
            <span className="text-white/60 text-[11px]">{post.replyCount > 0 ? post.replyCount.toLocaleString() : 'Reply'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */

/** Desktop sidebar panel version of the video-reply thread — same data, different chrome than ReplyThread's mobile sheet. */
function RepliesPanel({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [localReplies, setLocalReplies] = useState<SocialPost[] | null>(null);

  const { data, status, error, reload } = useAsync(() => socialService.getReplies(postId), [postId]);
  const replies = localReplies ?? data?.items ?? [];

  function handleCreated(reply: SocialPost) {
    setLocalReplies([...(localReplies ?? data?.items ?? []), reply]);
  }

  function handleChange(updated: SocialPost) {
    setLocalReplies(replies.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-none">
        <span className="text-white font-semibold">Video replies</span>
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/8 text-white/50 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
        <AsyncState
          loading={status === 'loading'}
          error={error}
          empty={status === 'success' && replies.length === 0}
          emptyMessage="No video replies yet. Be the first."
          errorMessage="Couldn't load replies."
          onRetry={reload}
        >
          {replies.map((r) => {
            const av = normalizeAssetUrl(r.author.profilePictures?.[0]);
            const media = normalizeAssetUrl(r.videoUrl);
            return (
              <div key={r.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex-none overflow-hidden">
                  {av && <img src={av} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-xs font-semibold">{r.author.firstName}</span>
                  <div className="mt-1.5 rounded-xl overflow-hidden bg-black aspect-[9/16] max-w-[140px]">
                    <video src={media ?? ''} className="w-full h-full object-cover" muted loop playsInline controls />
                  </div>
                  <div className="mt-1.5">
                    <ReactionBar post={r} onChange={handleChange} variant="inline" />
                  </div>
                </div>
              </div>
            );
          })}
        </AsyncState>
      </div>

      <div className="p-4 border-t border-white/8 flex-none">
        <button
          onClick={() => setRecorderOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-semibold text-sm"
        >
          <VideoIcon className="w-4 h-4" />
          Reply with video
        </button>
      </div>

      {recorderOpen && (
        <ReplyRecorderModal
          parentPostId={postId}
          onClose={() => setRecorderOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
