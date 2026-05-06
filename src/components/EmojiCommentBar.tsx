import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  {
    label: 'Like',
    default: '👍',
    burst: false,
    variants: ['👍', '👍🏻', '👍🏼', '👍🏽', '👍🏾', '👍🏿', '🤟', '🤟🏻', '🤟🏼', '🤟🏽', '🤟🏾', '🤟🏿', '✌️', '🤞', '💪', '💪🏻', '💪🏼', '💪🏽', '💪🏾', '💪🏿'],
  },
  {
    label: 'Fire',
    default: '🔥',
    burst: false,
    variants: ['🔥', '⚡', '💫', '✨', '🌊', '🌪️', '☄️', '🌟', '💎', '🎯', '🌈', '❄️', '🌸', '🍀', '⭐'],
  },
  {
    label: 'Boom',
    default: '💥',
    burst: true,
    variants: ['💥', '🎆', '🎇', '🌠', '🎉', '🎊', '🎈', '🥳', '🎁', '🪅', '🎀', '🎑', '🧨', '🪄', '🎭'],
  },
  {
    label: 'Vibes',
    default: '🎸',
    burst: false,
    variants: ['🎸', '🎵', '🎶', '🎤', '🎺', '🎻', '🥁', '🎹', '🎷', '🪗', '🪘', '🪈', '🎼', '🕺', '🕺🏽', '💃', '💃🏾', '🧑‍🎤', '👨🏾‍🎤', '👩🏻‍🎤'],
  },
];

interface Props {
  onEmoji: (emoji: string, burst: boolean) => void;
}

export default function EmojiCommentBar({ onEmoji }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenIdx(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={barRef} className="relative flex items-center gap-2 px-4 py-2">
      {CATEGORIES.map((cat, idx) => (
        <div key={cat.label} className="relative">
          {/* Variant picker popup */}
          <AnimatePresence>
            {openIdx === idx && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a24] border border-white/12 rounded-2xl p-2 shadow-2xl z-50"
                style={{ width: 220 }}
              >
                <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2 px-1">{cat.label} variants</p>
                <div className="grid grid-cols-5 gap-1">
                  {cat.variants.map((v) => (
                    <motion.button
                      key={v}
                      whileTap={{ scale: 0.8 }}
                      onClick={() => {
                        onEmoji(v, cat.burst);
                        setOpenIdx(null);
                      }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xl hover:bg-white/10 transition-colors"
                    >
                      {v}
                    </motion.button>
                  ))}
                </div>
                {/* Arrow */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a24] border-r border-b border-white/12 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${openIdx === idx ? 'bg-white/15' : 'bg-white/6 hover:bg-white/12'}`}
          >
            <span className="text-xl leading-none">{cat.default}</span>
            <span className="text-white/30 text-[9px]">{cat.label}</span>
          </motion.button>
        </div>
      ))}
    </div>
  );
}
