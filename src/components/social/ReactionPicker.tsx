import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { label: 'Like', default: '👍', variants: ['👍', '🤟', '✌️', '🤞', '💪'] },
  { label: 'Fire', default: '🔥', variants: ['🔥', '⚡', '💫', '✨', '🌟'] },
  { label: 'Boom', default: '💥', variants: ['💥', '🎉', '🎊', '🥳', '🎆'] },
  { label: 'Vibes', default: '🎸', variants: ['🎸', '🎵', '🎶', '🎤', '💃'] },
];

interface Props {
  /** Emojis this viewer has already reacted with — multi-select, tapping one toggles it off. */
  activeEmojis: string[];
  onToggle: (emoji: string) => void;
  onClose: () => void;
}

/**
 * Emoji reaction picker — video-first replacement for EmojiCommentBar's
 * quick-emoji row. No text path: selecting an emoji reacts directly via
 * SocialService. Multi-select, matching Codex's `viewerReactions: string[]` —
 * picking a second emoji adds to the set rather than replacing the first.
 */
export default function ReactionPicker({ activeEmojis, onToggle, onClose }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function pick(emoji: string) {
    onToggle(emoji);
    setOpenIdx(null);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2 bg-[#1a1a24] border border-white/12 rounded-2xl p-2 shadow-2xl">
      {CATEGORIES.map((cat, idx) => {
        const categoryActive = cat.variants.some((v) => activeEmojis.includes(v));
        return (
          <div key={cat.label} className="relative">
            <AnimatePresence>
              {openIdx === idx && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a24] border border-white/12 rounded-2xl p-2 shadow-2xl z-50"
                  style={{ width: 180 }}
                >
                  <div className="grid grid-cols-5 gap-1">
                    {cat.variants.map((v) => (
                      <button
                        key={v}
                        onClick={() => pick(v)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-white/10 transition-colors ${activeEmojis.includes(v) ? 'bg-white/15' : ''}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${categoryActive ? 'bg-white/20' : 'bg-white/6 hover:bg-white/12'}`}
            >
              {cat.default}
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}
