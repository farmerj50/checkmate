/**
 * 🔍 EXPLORE — TikTok desktop layout
 * Left sidebar (nav + search) | Center video feed | Right comments panel
 * Bottom nav is hidden on this route (Navigation.tsx returns null for /explore).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { Heart, MessageCircle, UserPlus, BadgeCheck, Loader2, Volume2, VolumeX, X, Send, Search, Home, PlusSquare, Bell, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { normalizeAssetUrl } from '../utils/helpers';
import EmojiCommentBar from '../components/EmojiCommentBar';
import type { Post, SocialComment } from '../types';

interface DiscoverPost extends Post {
  liked: boolean;
  count: number;
  isFollowing: boolean;
}

export default function Explore() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [posts, setPosts]             = useState<DiscoverPost[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor]           = useState<string | null>(null);
  const [hasMore, setHasMore]         = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted]             = useState(true);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [query, setQuery]             = useState('');
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (cur?: string) => {
    try {
      const params = cur ? `?discover=true&cursor=${cur}` : '?discover=true';
      const data = await api.get<{ posts: Post[]; nextCursor: string | null }>(`/social/posts/feed${params}`);
      const mapped: DiscoverPost[] = data.posts.map((p) => ({ ...p, liked: p.isLikedByMe, count: p.likeCount, isFollowing: false }));
      if (cur) setPosts((prev) => [...prev, ...mapped]);
      else setPosts(mapped);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor && data.posts.length > 0);
    } catch { /* silent */ }
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

  async function toggleLike(idx: number) {
    const post = filteredPosts[idx];
    const next = !post.liked;
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked: next, count: p.count + (next ? 1 : -1) } : p));
    try { await api.post(`/social/posts/${post.id}/like`, {}); }
    catch {
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked: !next, count: p.count + (next ? -1 : 1) } : p));
      toast.error('Failed to like');
    }
  }

  async function toggleFollow(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const next = !post.isFollowing;
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isFollowing: next } : p));
    try {
      if (next) await api.post(`/social/follow/${post.authorId}`, {});
      else await api.delete(`/social/follow/${post.authorId}`);
    } catch { setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isFollowing: !next } : p)); }
  }

  const commentPost = posts.find((p) => p.id === commentPostId);

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
              commentOpen={commentPostId === post.id}
              onMuteToggle={() => setMuted((m) => !m)}
              onLike={() => toggleLike(idx)}
              onComment={() => setCommentPostId(commentPostId === post.id ? null : post.id)}
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

      {/* ── RIGHT: COMMENTS PANEL ── */}
      <AnimatePresence>
        {commentPost && (
          <motion.aside
            key="comments"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="flex-none flex flex-col bg-[#0a0a0f] border-l border-white/8 overflow-hidden"
          >
            <CommentPanel postId={commentPost.id} onClose={() => setCommentPostId(null)} />
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
  commentOpen: boolean;
  onMuteToggle: () => void;
  onLike: () => void;
  onComment: () => void;
  onFollow: () => void;
  onProfile: () => void;
}

function VideoSlide({ post, idx, isActive, muted, commentOpen, onMuteToggle, onLike, onComment, onFollow, onProfile }: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const media = normalizeAssetUrl(post.mediaUrl);
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
          {post.mediaType === 'VIDEO' ? (
            <video ref={videoRef} src={media ?? ''} className="absolute inset-0 w-full h-full object-cover" loop muted playsInline />
          ) : (
            <img src={media ?? ''} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}

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

          <button onClick={onLike} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <Heart className={`w-5 h-5 ${post.liked ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white'}`} />
            </div>
            <span className="text-white/60 text-[11px]">{post.count > 0 ? post.count.toLocaleString() : 'Like'}</span>
          </button>

          <button onClick={onComment} className="flex flex-col items-center gap-1.5">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${commentOpen ? 'bg-[#ff4d8d]/20 ring-1 ring-[#ff4d8d]/40' : 'bg-white/10 hover:bg-white/20'}`}>
              <MessageCircle className={`w-5 h-5 ${commentOpen ? 'text-[#ff4d8d]' : 'text-white'}`} />
            </div>
            <span className="text-white/60 text-[11px]">{post.commentCount > 0 ? post.commentCount.toLocaleString() : 'Comments'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */

function CommentPanel({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [comments, setComments]   = useState<SocialComment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [burstKey, setBurstKey]   = useState(0);
  const [bursting, setBursting]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setComments([]);
    api.get<{ comments: SocialComment[] }>(`/social/posts/${postId}/comments`)
      .then((d) => setComments(d.comments))
      .catch(() => {})
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [postId]);

  async function submit(content?: string) {
    const body = content ?? text.trim();
    if (!body || submitting) return;
    if (!content) setText('');
    setSubmitting(true);
    try {
      const { comment } = await api.post<{ comment: SocialComment }>(`/social/posts/${postId}/comments`, { content: body });
      setComments((prev) => [comment, ...prev]);
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  }

  function handleEmoji(emoji: string, isBurst: boolean) {
    if (isBurst) {
      setBurstKey((k) => k + 1);
      setBursting(true);
      setTimeout(() => setBursting(false), 700);
    }
    // Append to input OR send immediately as standalone
    if (!text.trim()) {
      submit(emoji);
    } else {
      setText((t) => t + emoji);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-none">
        <span className="text-white font-semibold">Comments</span>
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/8 text-white/50 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-[#ff4d8d] animate-spin" /></div>
        ) : comments.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-12">No comments yet. Be the first!</p>
        ) : comments.map((c) => {
          const av = normalizeAssetUrl(c.author.profilePictures?.[0]);
          return (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex-none overflow-hidden">
                {av && <img src={av} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white text-xs font-semibold mr-2">{c.author.firstName}</span>
                <span className="text-white/70 text-sm">{c.content}</span>
                <p className="text-white/25 text-[10px] mt-1">
                  {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick emoji bar */}
      <div className="border-t border-white/6 flex-none relative">
        <EmojiCommentBar onEmoji={(emoji, burst) => handleEmoji(emoji, burst)} />
        <AnimatePresence>
          {bursting && (
            <motion.div
              key={burstKey}
              initial={{ scale: 0.5, opacity: 1, y: 0 }}
              animate={{ scale: 3.5, opacity: 0, y: -80 }}
              exit={{}}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="absolute left-1/2 bottom-12 -translate-x-1/2 pointer-events-none text-4xl select-none z-[999]"
            >
              💥
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-white/8 flex-none">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 bg-white/8 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#ff4d8d]/40 [color-scheme:dark]"
        />
        <button onClick={() => submit()} disabled={!text.trim() || submitting}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] flex items-center justify-center disabled:opacity-40 flex-none">
          {submitting ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
        </button>
      </div>
    </>
  );
}
