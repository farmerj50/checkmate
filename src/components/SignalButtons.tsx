import { motion } from 'framer-motion';
import type { SignalType } from '../types';

interface Signal {
  type: SignalType;
  emoji: string;
  label: string;
  color: string;
}

const SIGNALS: Signal[] = [
  { type: 'INTRIGUED',   emoji: '🔥', label: 'Intrigued',   color: '#ff4d8d' },
  { type: 'STIMULATING', emoji: '🧠', label: 'Stimulating', color: '#06b6d4' },
  { type: 'HIGH_VALUE',  emoji: '💎', label: 'High Value',  color: '#f59e0b' },
  { type: 'ALIGNED',     emoji: '🎯', label: 'Aligned',     color: '#22c55e' },
];

interface Props {
  onSignal: (type: SignalType) => void;
  disabled?: boolean;
}

export default function SignalButtons({ onSignal, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SIGNALS.map(({ type, emoji, label, color }) => (
        <motion.button
          key={type}
          whileTap={{ scale: 0.92 }}
          disabled={disabled}
          onClick={() => onSignal(type)}
          className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 disabled:opacity-40 transition-colors active:border-white/40"
          style={{ '--signal-color': color } as React.CSSProperties}
        >
          <span className="text-xl leading-none">{emoji}</span>
          <span className="text-white/80 text-[11px] font-semibold tracking-wide">{label}</span>
        </motion.button>
      ))}
    </div>
  );
}
