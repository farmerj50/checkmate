import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Loader2, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { normalizeAssetUrl } from '../utils/helpers';
import type { Post, SocialComment } from '../types';

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate   = useNavigate();
  const inputRef   = useRef<HTMLInputElement>(null);

  const [post]                    = useState<Post | null>(null);
  const [comments, setComments]   = useState<SocialComment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [liked, setLiked]         = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [text, setText]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!postId) return;
    Promise.all([
      api.get<{ posts: Post[] }>(`/social/posts/user/placeholder`).catch(() => null),
      api.get<{ count: number; isLikedByMe: boolean }>(`/social/posts/${postId}/likes`),
      api.get<{ comments: SocialComment[] }>(`/social/posts/${postId}/comments`),
    ]).then(([, likesData, commentsData]) => {
      setLiked(likesData.isLikedByMe);
      setLikeCount(likesData.count);
      setComments(commentsData.comments);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  async function toggleLike() {
    if (!postId) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try { await api.post(`/social/posts/${postId}/like`, {}); }
    catch { setLiked(!next); setLikeCount((c) => c + (next ? -1 : 1)); }
  }

  async function submit() {
    if (!text.trim() || submitting || !postId) return;
    setSubmitting(true);
    try {
      const { comment } = await api.post<{ comment: SocialComment }>(`/social/posts/${postId}/comments`, { content: text.trim() });
      setComments((prev) => [comment, ...prev]);
      setText('');
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#ff4d8d] animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050508] flex flex-col pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/8">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold">Post</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Media */}
        <div className="bg-black flex items-center justify-center" style={{ height: '50vh' }}>
          {post?.mediaType === 'VIDEO' ? (
            <video src={normalizeAssetUrl(post.mediaUrl) ?? ''} className="h-full w-full object-contain" autoPlay loop muted playsInline />
          ) : post ? (
            <img src={normalizeAssetUrl(post.mediaUrl) ?? ''} alt="" className="h-full w-full object-contain" />
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 px-4 py-3 border-b border-white/5">
          <button onClick={toggleLike} className="flex items-center gap-1.5">
            <motion.div whileTap={{ scale: 1.3 }}>
              <Heart className={`w-6 h-6 transition-colors ${liked ? 'text-[#ff4d8d] fill-[#ff4d8d]' : 'text-white/70'}`} />
            </motion.div>
            <span className="text-white/60 text-sm">{likeCount > 0 ? likeCount : ''}</span>
          </button>
          <button onClick={() => inputRef.current?.focus()} className="flex items-center gap-1.5">
            <MessageCircle className="w-6 h-6 text-white/70" />
            <span className="text-white/60 text-sm">{comments.length > 0 ? comments.length : ''}</span>
          </button>
        </div>

        {/* Comments */}
        <div className="px-4 py-3 space-y-4">
          {comments.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">No comments yet</p>
          )}
          {comments.map((c) => {
            const avatar = normalizeAssetUrl(c.author.profilePictures?.[0]);
            return (
              <div key={c.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex-none overflow-hidden">
                  {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <span className="text-white text-xs font-semibold mr-1.5">{c.author.firstName}</span>
                  <span className="text-white/70 text-sm">{c.content}</span>
                  <p className="text-white/25 text-[10px] mt-0.5">
                    {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comment input */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-white/8 flex-none">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 bg-white/8 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#ff4d8d]/40"
        />
        <button onClick={submit} disabled={!text.trim() || submitting}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] flex items-center justify-center disabled:opacity-40">
          {submitting ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
        </button>
      </div>
    </div>
  );
}
