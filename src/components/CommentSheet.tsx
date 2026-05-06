import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeAssetUrl } from '../utils/helpers';
import EmojiCommentBar from './EmojiCommentBar';
import type { SocialComment } from '../types';

interface Props {
  postId: string;
  onClose: () => void;
}

export default function CommentSheet({ postId, onClose }: Props) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [bursting, setBursting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
    if (!text.trim()) {
      submit(emoji);
    } else {
      setText((t) => t + emoji);
      inputRef.current?.focus();
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      className="fixed inset-x-0 bottom-0 z-[300] bg-[#0f0f14] rounded-t-3xl border-t border-white/10 flex flex-col"
      style={{ maxHeight: '75vh' }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1 flex-none">
        <div className="w-10 h-1 bg-white/20 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-none">
        <span className="text-white font-semibold text-sm">Comments</span>
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/8 text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#ff4d8d] animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-8">No comments yet. Be the first!</p>
        ) : (
          comments.map((c) => {
            const avatar = c.author.profilePictures?.[0];
            return (
              <div key={c.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex-none overflow-hidden">
                  {avatar && <img src={normalizeAssetUrl(avatar) ?? ''} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-xs font-semibold mr-1.5">{c.author.firstName}</span>
                  <span className="text-white/70 text-sm">{c.content}</span>
                  <p className="text-white/25 text-[10px] mt-0.5">
                    {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
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

      {/* Input */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-white/8 flex-none pb-safe">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 bg-white/8 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#ff4d8d]/40 [color-scheme:dark]"
        />
        <button
          onClick={() => submit()}
          disabled={!text.trim() || submitting}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] flex items-center justify-center disabled:opacity-40"
        >
          {submitting ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
        </button>
      </div>
    </motion.div>
  );
}
