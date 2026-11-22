import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile } from 'lucide-react';
import toast from 'react-hot-toast';
import { socialService, type SocialPost } from '../../services/social';
import ReactionPicker from './ReactionPicker';

interface Props {
  post: SocialPost;
  onChange: (updated: SocialPost) => void;
  /** 'rail' = vertical icon+count (HomeFeed side rail); 'inline' = horizontal (PostCard). */
  variant?: 'rail' | 'inline';
}

export default function ReactionBar({ post, onChange, variant = 'inline' }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  async function toggle(emoji: string) {
    const before = post;
    const reacted = post.viewerReactions.includes(emoji);
    try {
      const updated = reacted
        ? await socialService.clearReaction(post.id, emoji)
        : await socialService.setReaction(post.id, emoji);
      onChange(updated);
    } catch {
      onChange(before);
      toast.error(reacted ? 'Could not remove reaction — try again' : 'Could not react — try again');
    }
  }

  const primaryEmoji = post.viewerReactions[0] ?? '👍';
  const isRail = variant === 'rail';
  const hasReacted = post.viewerReactions.length > 0;

  return (
    <div className="relative">
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={`absolute z-50 ${isRail ? 'right-14 bottom-0' : 'bottom-full mb-2 left-0'}`}
          >
            <ReactionPicker
              activeEmojis={post.viewerReactions}
              onToggle={toggle}
              onClose={() => setPickerOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {isRail ? (
        <button onClick={() => setPickerOpen((o) => !o)} className="flex flex-col items-center gap-1.5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${hasReacted ? 'bg-[#ff4d8d]/20' : 'bg-white/10 hover:bg-white/20'}`}>
            <motion.span whileTap={{ scale: 1.25 }} className="text-xl leading-none">
              {hasReacted ? primaryEmoji : <Smile className="w-5 h-5 text-white" />}
            </motion.span>
          </div>
          <span className="text-white/60 text-[11px]">{post.reactionCount > 0 ? post.reactionCount.toLocaleString() : 'React'}</span>
        </button>
      ) : (
        <button onClick={() => setPickerOpen((o) => !o)} className="flex items-center gap-1.5">
          <motion.span whileTap={{ scale: 1.25 }} className="text-xl leading-none w-6 h-6 flex items-center justify-center">
            {hasReacted ? primaryEmoji : <Smile className="w-5 h-5 text-white/70" />}
          </motion.span>
          <span className="text-white/60 text-sm">{post.reactionCount > 0 ? post.reactionCount : ''}</span>
        </button>
      )}
    </div>
  );
}
