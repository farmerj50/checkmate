import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Crown, X, Heart, Star, Eye, Zap } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which limit was hit: 'likes' | 'super_likes' */
  reason?: 'likes' | 'super_likes';
}

const PERKS = [
  { icon: Heart, text: 'Unlimited daily likes' },
  { icon: Star, text: 'Unlimited super likes' },
  { icon: Eye, text: 'See who liked you' },
  { icon: Zap, text: '30-minute profile boost' },
];

export default function PremiumGate({ open, onClose, reason = 'likes' }: Props) {
  const navigate = useNavigate();

  function goToPremium() {
    onClose();
    navigate('/premium');
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl p-6 pb-10 shadow-2xl max-w-md mx-auto"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            {/* Icon */}
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-pink-500/30">
              <Crown className="w-9 h-9 text-yellow-300" />
            </div>

            {/* Headline */}
            <h2 className="text-xl font-bold text-center text-gray-900 mb-1">
              {reason === 'super_likes' ? "You're out of super likes" : "You've reached your daily limit"}
            </h2>
            <p className="text-sm text-center text-gray-500 mb-6">
              Upgrade to Premium for unlimited{reason === 'super_likes' ? ' super likes' : ' likes'} and more
            </p>

            {/* Perks */}
            <div className="space-y-3 mb-6">
              {PERKS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-pink-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-pink-500" />
                  </div>
                  <span className="text-sm text-gray-700">{text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={goToPremium}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-pink-500/25 hover:shadow-xl active:scale-[0.98] transition-all"
            >
              <Crown className="w-5 h-5 mr-2 inline-block text-yellow-300" />
              Get Premium
            </button>
            <button
              onClick={onClose}
              className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
            >
              Maybe later
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
