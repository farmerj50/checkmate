import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, BadgeCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { normalizeAssetUrl } from '../utils/helpers';
import { AnimatePresence } from 'framer-motion';
import CommentSheet from './CommentSheet';
import type { Post } from '../types';

interface Props {
  post: Post;
}

export default function PostCard({ post }: Props) {
  const navigate = useNavigate();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const cardRef   = useRef<HTMLDivElement>(null);
  const [liked, setLiked]   = useState(post.isLikedByMe);
  const [count, setCount]   = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);

  // IntersectionObserver: autoplay when in viewport
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { v.play().catch(() => {}); }
        else { v.pause(); }
      },
      { threshold: 0.5 }
    );
    obs.observe(v);
    return () => obs.disconnect();
  }, []);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await api.post(`/social/posts/${post.id}/like`, {});
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  const avatar = normalizeAssetUrl(post.author.profilePictures?.[0]);
  const media  = normalizeAssetUrl(post.mediaUrl);

  return (
    <>
      <div ref={cardRef} className="bg-[#0a0a0f] border-b border-white/5">
        {/* Author row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(`/profile/${post.authorId}`)} className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex-none">
            {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
          </button>
          <button onClick={() => navigate(`/profile/${post.authorId}`)} className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-white font-semibold text-sm truncate">{post.author.firstName}</span>
            {post.author.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#ff4d8d] flex-none" />}
          </button>
        </div>

        {/* Media */}
        <div className="relative aspect-[4/5] w-full bg-black">
          {post.mediaType === 'VIDEO' ? (
            <video
              ref={videoRef}
              src={media ?? ''}
              className="w-full h-full object-contain"
              loop muted playsInline
            />
          ) : (
            <img src={media ?? ''} alt="" className="w-full h-full object-contain" />
          )}
          {post.caption && (
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
              <span className="bg-black/55 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-xl">
                {post.caption}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 px-4 py-3">
          <button onClick={toggleLike} className="flex items-center gap-1.5">
            <motion.div whileTap={{ scale: 1.3 }}>
              <Heart
                className={`w-6 h-6 transition-colors ${liked ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white/70'}`}
              />
            </motion.div>
            <span className="text-white/60 text-sm">{count > 0 ? count : ''}</span>
          </button>
          <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5">
            <MessageCircle className="w-6 h-6 text-white/70" />
            <span className="text-white/60 text-sm">{post.commentCount > 0 ? post.commentCount : ''}</span>
          </button>
        </div>

        {/* Caption below */}
        {post.caption && (
          <div className="px-4 pb-3">
            <span className="text-white/80 text-sm">
              <span className="font-semibold text-white mr-1">{post.author.firstName}</span>
              {post.caption}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showComments && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[299] bg-black/60"
              onClick={() => setShowComments(false)}
            />
            <CommentSheet postId={post.id} onClose={() => setShowComments(false)} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
