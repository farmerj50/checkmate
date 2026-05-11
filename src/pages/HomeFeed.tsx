import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Heart, MessageCircle, BadgeCheck, Loader2, PlusSquare, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getSocket } from '../lib/socket';
import { normalizeAssetUrl } from '../utils/helpers';
import CommentSheet from '../components/CommentSheet';
import type { Post, DailyPrompt } from '../types';

interface FeedPost extends Post {
  liked: boolean;
  count: number;
}

function useNotificationCount() {
  const { dbUser } = useAuth();
  const [count, setCount] = useState(0);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!dbUser) return;
    api.get<{ count: number }>('/social/notifications/unread-count').then((d) => setCount(d.count)).catch(() => {});
    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      socket.on('notification:new', () => setCount((n) => n + 1));
    });
    return () => { mounted = false; socketRef.current?.off('notification:new'); };
  }, [dbUser]);

  useEffect(() => {
    if (location.pathname === '/notifications') setCount(0);
  }, [location.pathname]);

  return count;
}

export default function HomeFeed() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [dailyPrompt, setDailyPrompt] = useState<DailyPrompt | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const notifCount = useNotificationCount();

  const fetchFeed = useCallback(async (cur?: string) => {
    try {
      const params = cur ? `?cursor=${cur}` : '';
      const data = await api.get<{ posts: Post[]; nextCursor: string | null }>(`/social/posts/feed${params}`);
      const mapped: FeedPost[] = data.posts.map((p) => ({ ...p, liked: p.isLikedByMe, count: p.likeCount }));
      if (cur) setPosts((prev) => [...prev, ...mapped]);
      else setPosts(mapped);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor && data.posts.length > 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchFeed().finally(() => setLoading(false));
    api.get<{ prompt: DailyPrompt | null }>('/users/daily-prompt')
      .then((d) => setDailyPrompt(d.prompt))
      .catch(() => {});
  }, [fetchFeed]);

  // Track active slide for video autoplay
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slides = container.querySelectorAll('[data-slide]');
    if (!slides.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setActiveIndex(Number((e.target as HTMLElement).dataset.slide));
          }
        });
      },
      { threshold: 0.6 }
    );
    slides.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [posts, dailyPrompt]);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          fetchFeed(cursor ?? undefined).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, hasMore, loadingMore, fetchFeed]);

  async function toggleLike(postIdx: number) {
    const post = posts[postIdx];
    const next = !post.liked;
    setPosts((prev) => prev.map((p, i) => i === postIdx ? { ...p, liked: next, count: p.count + (next ? 1 : -1) } : p));
    try {
      await api.post(`/social/posts/${post.id}/like`, {});
    } catch {
      setPosts((prev) => prev.map((p, i) => i === postIdx ? { ...p, liked: !next, count: p.count + (next ? -1 : 1) } : p));
      toast.error('Failed to like');
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff4d8d] animate-spin" />
      </div>
    );
  }

  const promptOffset = dailyPrompt ? 1 : 0;

  return (
    <div className="relative h-screen bg-[#050508] overflow-hidden">

      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
        <span className="text-white font-bold text-lg tracking-tight">CheckMate</span>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/notifications')} className="relative p-2">
            <Bell className="w-5 h-5 text-white/80" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-[#ff4d8d] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/create')} className="p-2">
            <PlusSquare className="w-5 h-5 text-white/80" />
          </button>
        </div>
      </div>

      {/* Snap-scroll container — accounts for fixed header (52px) and bottom nav (64px) */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* Daily prompt slide */}
        {dailyPrompt && <PromptSlide prompt={dailyPrompt} slideIndex={0} />}

        {/* Post slides */}
        {posts.length === 0 ? (
          <div
            data-slide={promptOffset}
            className="flex flex-col items-center justify-center gap-4 px-8 text-center"
            style={{ scrollSnapAlign: 'start', height: '100dvh' }}
          >
            <p className="text-white/50 text-sm">No posts yet. Follow people or create your first post.</p>
            <button
              onClick={() => navigate('/create')}
              className="bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-semibold px-6 py-3 rounded-full"
            >
              Create your first post
            </button>
          </div>
        ) : (
          posts.map((post, idx) => (
            <PostSlide
              key={post.id}
              post={post}
              slideIndex={idx + promptOffset}
              isActive={activeIndex === idx + promptOffset}
              onLike={() => toggleLike(idx)}
              onComment={() => setCommentPostId(post.id)}
              onNavigateProfile={() => navigate(`/profile/${post.authorId}`)}
            />
          ))
        )}

        {/* Infinite scroll trigger */}
        <div ref={loaderRef} style={{ scrollSnapAlign: 'none', height: '4px' }}>
          {loadingMore && (
            <div className="h-16 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Comment Sheet */}
      <AnimatePresence>
        {commentPostId && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[299] bg-black/60"
              onClick={() => setCommentPostId(null)}
            />
            <CommentSheet postId={commentPostId} onClose={() => setCommentPostId(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Prompt Slide ──────────────────────────────────────────────────────────────
function PromptSlide({ prompt, slideIndex }: { prompt: DailyPrompt; slideIndex: number }) {
  const navigate = useNavigate();
  return (
    <div
      data-slide={slideIndex}
      className="w-full flex items-center justify-center bg-[#050508]"
      style={{ scrollSnapAlign: 'start', height: '100dvh' }}
    >
      {/* Same card dimensions as PostSlide */}
      <div
        className="flex items-end gap-3 px-4"
        style={{ height: 'min(80dvh, calc((100dvw - 92px) * 16 / 9))', maxHeight: 680 }}
      >
        <div
          className="relative flex-none rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-[#1a0533] via-[#0d0520] to-[#050508] flex flex-col items-center justify-center px-8 text-center"
          style={{ aspectRatio: '9/16', height: '100%' }}
        >
          <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-5">Today's Prompt</p>
          <p className="text-white text-xl font-bold leading-snug mb-8">"{prompt.question}"</p>
          <button
            onClick={() => navigate('/create', { state: { prompt: prompt.question } })}
            className="bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-bold px-6 py-3 rounded-full text-sm shadow-xl shadow-pink-600/20"
          >
            Respond →
          </button>
        </div>

        {/* Placeholder to keep alignment consistent */}
        <div className="flex-none w-12" />
      </div>
    </div>
  );
}

// ── Post Slide ────────────────────────────────────────────────────────────────
function PostSlide({
  post, slideIndex, isActive, onLike, onComment, onNavigateProfile,
}: {
  post: FeedPost;
  slideIndex: number;
  isActive: boolean;
  onLike: () => void;
  onComment: () => void;
  onNavigateProfile: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const media  = normalizeAssetUrl(post.mediaUrl);
  const avatar = normalizeAssetUrl(post.author.profilePictures?.[0]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) v.play().catch(() => {});
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  return (
    <div
      data-slide={slideIndex}
      className="w-full flex items-center justify-center bg-[#050508]"
      style={{ scrollSnapAlign: 'start', height: '100dvh' }}
    >
      {/* Card + action buttons row — same layout as Explore */}
      <div
        className="flex items-end gap-3 px-4"
        style={{ height: 'min(80dvh, calc((100dvw - 92px) * 16 / 9))', maxHeight: 680 }}
      >
        {/* Portrait video card */}
        <div
          className="relative flex-none bg-black rounded-2xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: '9/16', height: '100%' }}
        >
          {post.mediaType === 'VIDEO' ? (
            <video
              ref={videoRef}
              src={media ?? ''}
              className="absolute inset-0 w-full h-full object-cover"
              loop
              muted
              playsInline
            />
          ) : (
            <img src={media ?? ''} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}

          {/* Bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

          {/* Author + caption */}
          <div className="absolute bottom-5 left-4 right-4 z-10">
            <button onClick={onNavigateProfile} className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-white/20 overflow-hidden ring-2 ring-white/30 flex-none">
                {avatar
                  ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white/50 text-sm font-bold">{post.author.firstName?.[0]}</div>
                }
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
        <div className="flex flex-col items-center gap-5 pb-5 flex-none">
          <button onClick={onLike} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <motion.div whileTap={{ scale: 1.25 }}>
                <Heart className={`w-5 h-5 ${post.liked ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white'}`} />
              </motion.div>
            </div>
            <span className="text-white/60 text-[11px]">{post.count > 0 ? post.count.toLocaleString() : 'Like'}</span>
          </button>

          <button onClick={onComment} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/60 text-[11px]">{post.commentCount > 0 ? post.commentCount.toLocaleString() : 'Comments'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
