/**
 * 🏠 SOCIAL FEED — TikTok-style full-screen vertical snap scroll
 * Route: /home
 * Each post is 100dvh. Videos autoplay on snap. Infinite scroll at bottom.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, PlusSquare, BadgeCheck, Loader2, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { normalizeAssetUrl } from '../utils/helpers';
import CommentSheet from '../components/CommentSheet';
import type { Post, DailyPrompt } from '../types';

interface FeedPost extends Post {
  liked: boolean;
  count: number;
}

export default function HomeFeed() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [posts, setPosts]           = useState<FeedPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor]         = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(true);
  const [dailyPrompt, setDailyPrompt] = useState<DailyPrompt | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted]           = useState(true);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (cur?: string) => {
    try {
      const params = cur ? `?cursor=${cur}` : '';
      const data = await api.get<{ posts: Post[]; nextCursor: string | null }>(`/social/posts/feed${params}`);
      const mapped: FeedPost[] = data.posts.map((p) => ({ ...p, liked: p.isLikedByMe, count: p.likeCount }));
      if (cur) {
        setPosts((prev) => [...prev, ...mapped]);
      } else {
        setPosts(mapped);
      }
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

  // Track active slide via IntersectionObserver on each post slot
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slides = container.querySelectorAll('[data-slide]');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.slide);
            setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.6 }
    );
    slides.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [posts.length]);

  async function toggleLike(idx: number) {
    const post = posts[idx];
    const next = !post.liked;
    setPosts((prev) => prev.map((p, i) => i === idx ? { ...p, liked: next, count: p.count + (next ? 1 : -1) } : p));
    try {
      await api.post(`/social/posts/${post.id}/like`, {});
    } catch {
      setPosts((prev) => prev.map((p, i) => i === idx ? { ...p, liked: !next, count: p.count + (next ? -1 : 1) } : p));
      toast.error('Failed to like');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff4d8d] animate-spin" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
          <PlusSquare className="w-8 h-8 text-white/30" />
        </div>
        <p className="text-white/50 text-sm">No posts yet.</p>
        <button
          onClick={() => navigate('/create')}
          className="bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-semibold px-6 py-3 rounded-full"
        >
          Create your first post
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black" style={{ paddingBottom: '56px' }}>
      {/* Top create button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => navigate('/create')}
          className="p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80"
        >
          <PlusSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Mute toggle */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => setMuted((m) => !m)}
          className="p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Snap scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
      >
        {/* Daily prompt banner — first item */}
        {dailyPrompt && (
          <div
            className="relative flex flex-col items-center justify-center px-8 text-center"
            style={{ height: 'calc(100dvh - 56px)', scrollSnapAlign: 'start', flexShrink: 0, background: 'linear-gradient(135deg, #1a0520 0%, #050508 60%, #0a0515 100%)' }}
          >
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-4">Today's Prompt</p>
            <p className="text-white text-2xl font-bold leading-snug mb-6 max-w-xs">"{dailyPrompt.question}"</p>
            {(dailyPrompt as any).responseCount > 0 && (
              <p className="text-white/30 text-sm mb-6">{((dailyPrompt as any).responseCount as number).toLocaleString()} people responded</p>
            )}
            <button
              onClick={() => navigate('/create', { state: { prompt: dailyPrompt.question } })}
              className="bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-bold px-8 py-3 rounded-full text-sm"
            >
              Respond →
            </button>
            {/* Swipe hint */}
            <p className="absolute bottom-8 text-white/20 text-xs">Swipe up to see posts ↑</p>
          </div>
        )}

        {/* Posts */}
        {posts.map((post, idx) => (
          <VideoPost
            key={post.id}
            post={post}
            idx={idx}
            isActive={idx === activeIndex}
            muted={muted}
            onLike={() => toggleLike(idx)}
            onComment={() => setCommentPostId(post.id)}
          />
        ))}

        {/* Infinite scroll loader */}
        <div ref={loaderRef} className="flex justify-center items-center" style={{ height: 80, scrollSnapAlign: 'none' }}>
          {loadingMore && <Loader2 className="w-5 h-5 text-white/30 animate-spin" />}
          {!hasMore && posts.length > 0 && (
            <p className="text-white/20 text-xs">You're all caught up</p>
          )}
        </div>
      </div>

      {/* Comment sheet */}
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

interface VideoPostProps {
  post: FeedPost;
  idx: number;
  isActive: boolean;
  muted: boolean;
  onLike: () => void;
  onComment: () => void;
}

function VideoPost({ post, idx, isActive, muted, onLike, onComment }: VideoPostProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const media = normalizeAssetUrl(post.mediaUrl);
  const avatar = normalizeAssetUrl(post.author.profilePictures?.[0]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  return (
    <div
      data-slide={idx}
      className="relative w-full bg-black"
      style={{ height: 'calc(100dvh - 56px)', scrollSnapAlign: 'start', flexShrink: 0 }}
    >
      {/* Media */}
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

      {/* Gradient overlay bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

      {/* Bottom-left: author + caption */}
      <div className="absolute bottom-6 left-4 right-20 z-10">
        <button
          onClick={() => navigate(`/profile/${post.authorId}`)}
          className="flex items-center gap-2 mb-2"
        >
          <div className="w-9 h-9 rounded-full bg-white/20 overflow-hidden ring-2 ring-white/30 flex-none">
            {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white font-semibold text-sm drop-shadow-md">{post.author.firstName}</span>
            {post.author.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#ff4d8d]" />}
          </div>
        </button>
        {post.caption && (
          <p className="text-white/90 text-sm leading-snug drop-shadow-md line-clamp-2">{post.caption}</p>
        )}
      </div>

      {/* Right side: like + comment */}
      <div className="absolute bottom-6 right-3 z-10 flex flex-col items-center gap-5">
        <button onClick={onLike} className="flex flex-col items-center gap-1">
          <motion.div whileTap={{ scale: 1.4 }}>
            <Heart
              className={`w-7 h-7 drop-shadow-md transition-colors ${post.liked ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white'}`}
            />
          </motion.div>
          {post.count > 0 && <span className="text-white text-xs font-semibold drop-shadow-md">{post.count}</span>}
        </button>
        <button onClick={onComment} className="flex flex-col items-center gap-1">
          <MessageCircle className="w-7 h-7 text-white drop-shadow-md" />
          {post.commentCount > 0 && <span className="text-white text-xs font-semibold drop-shadow-md">{post.commentCount}</span>}
        </button>
      </div>
    </div>
  );
}
