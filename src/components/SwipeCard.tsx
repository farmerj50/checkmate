import { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Heart, X, MapPin, Briefcase, GraduationCap, Star, BadgeCheck } from 'lucide-react';
import { SwipeCard as SwipeCardType } from '../types';
import { calculateAge } from '../utils/helpers';

interface SwipeCardProps {
  card: SwipeCardType;
  onSwipe: (direction: 'left' | 'right') => void;
  onSuperLike: () => void;
  isTop: boolean;
  superLikesRemaining: number;
}

const SwipeCard: React.FC<SwipeCardProps> = ({
  card,
  onSwipe,
  onSuperLike,
  isTop,
  superLikesRemaining,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  // Directional overlay hints
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);
  const superOpacity = useTransform(y, [-80, 0], [1, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const THRESHOLD = 100;
    const SUPER_THRESHOLD = -120;
    if (info.offset.y < SUPER_THRESHOLD && Math.abs(info.offset.x) < 60) {
      onSuperLike();
    } else if (info.offset.x > THRESHOLD) {
      onSwipe('right');
    } else if (info.offset.x < -THRESHOLD) {
      onSwipe('left');
    }
  };

  const photos = card.user.profilePictures;
  const hasManyPhotos = photos.length > 1;

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? 'z-10' : 'z-0'}`}
      style={{ x, y, rotate, opacity }}
      drag={isTop ? true : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
    >
      <div className="w-full h-full bg-white rounded-3xl shadow-2xl overflow-hidden select-none">

        {/* ── Image area ─────────────────────────────────────── */}
        <div className="relative h-[62%]">
          <img
            src={photos[currentImageIndex] || 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg'}
            alt={card.user.firstName}
            className="w-full h-full object-cover"
            draggable={false}
          />

          {/* Tap zones to change photo */}
          {hasManyPhotos && (
            <>
              <button
                className="absolute left-0 top-0 w-1/2 h-full"
                onClick={() => setCurrentImageIndex((i) => (i === 0 ? photos.length - 1 : i - 1))}
              />
              <button
                className="absolute right-0 top-0 w-1/2 h-full"
                onClick={() => setCurrentImageIndex((i) => (i === photos.length - 1 ? 0 : i + 1))}
              />
            </>
          )}

          {/* Photo dots */}
          {hasManyPhotos && (
            <div className="absolute top-2 left-0 right-0 flex justify-center gap-1 px-4 pointer-events-none">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full flex-1 max-w-[32px] transition-all ${
                    i === currentImageIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Compatibility badge */}
          <div className="absolute top-4 right-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            {card.compatibilityScore}% Match
          </div>

          {/* Swipe direction overlays */}
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute top-6 left-5 border-4 border-green-400 rounded-xl px-3 py-1 pointer-events-none rotate-[-15deg]"
          >
            <span className="text-green-400 font-black text-2xl tracking-wide">LIKE</span>
          </motion.div>
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="absolute top-6 right-5 border-4 border-red-400 rounded-xl px-3 py-1 pointer-events-none rotate-[15deg]"
          >
            <span className="text-red-400 font-black text-2xl tracking-wide">NOPE</span>
          </motion.div>
          <motion.div
            style={{ opacity: superOpacity }}
            className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none"
          >
            <div className="border-4 border-blue-400 rounded-xl px-4 py-1">
              <span className="text-blue-400 font-black text-2xl tracking-wide">SUPER</span>
            </div>
          </motion.div>
        </div>

        {/* ── Info area ──────────────────────────────────────── */}
        <div className="px-5 pt-3 pb-4 h-[38%] flex flex-col justify-between">
          <div className="overflow-hidden">
            {/* Name row */}
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {card.user.firstName}, {calculateAge(card.user.dateOfBirth)}
              </h2>
              {card.user.isVerified && <BadgeCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />}
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500 text-xs mb-2">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {card.distance > 0 ? `${card.distance} km away` : 'Nearby'}
              </span>
              {card.user.occupation && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {card.user.occupation}
                </span>
              )}
              {card.user.education && (
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {card.user.education}
                </span>
              )}
            </div>

            {/* Common interests */}
            {card.commonInterests.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.commonInterests.slice(0, 3).map((interest) => (
                  <span
                    key={interest}
                    className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-[11px] font-medium"
                  >
                    {interest}
                  </span>
                ))}
                {card.commonInterests.length > 3 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px]">
                    +{card.commonInterests.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center items-center gap-4 mt-1">
            {/* Pass */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onSwipe('left')}
              className="w-13 h-13 w-[52px] h-[52px] bg-white border-2 border-gray-200 rounded-full flex items-center justify-center shadow-md hover:border-red-300 hover:bg-red-50 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </motion.button>

            {/* Super Like */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onSuperLike}
              disabled={superLikesRemaining === 0}
              className={`w-[44px] h-[44px] rounded-full flex items-center justify-center shadow-md transition-all ${
                superLikesRemaining > 0
                  ? 'bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-blue-300 hover:from-blue-500 hover:to-blue-700'
                  : 'bg-gray-100 border-2 border-gray-200 opacity-50 cursor-not-allowed'
              }`}
              title={superLikesRemaining > 0 ? `${superLikesRemaining} super likes left today` : 'No super likes left today'}
            >
              <Star className={`w-5 h-5 ${superLikesRemaining > 0 ? 'text-white' : 'text-gray-400'}`} />
            </motion.button>

            {/* Like */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onSwipe('right')}
              className="w-[52px] h-[52px] bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-md hover:from-pink-600 hover:to-rose-600 transition-colors"
            >
              <Heart className="w-6 h-6 text-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
