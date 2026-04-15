import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, BadgeCheck, Eye, Crown, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Match, User } from '../types';

type MatchWithOther = Match & { otherUser: User };

interface LikeEntry {
  id: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    profilePictures: string[];
    occupation: string | null;
    dateOfBirth: string;
    isVerified: boolean;
  };
}

interface LikesReceived {
  likes: LikeEntry[];
  isPremium: boolean;
  count?: number;
}

type Tab = 'matches' | 'likes';

function MatchSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-100 rounded w-48" />
      </div>
    </div>
  );
}

function LikeSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-28" />
        <div className="h-3 bg-gray-100 rounded w-40" />
      </div>
    </div>
  );
}

export default function Matches() {
  const navigate = useNavigate();
  const { dbUser } = useAuth();
  const [tab, setTab] = useState<Tab>('matches');

  // Matches tab
  const [matches, setMatches] = useState<MatchWithOther[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  // Likes tab
  const [likesData, setLikesData] = useState<LikesReceived | null>(null);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesFetched, setLikesFetched] = useState(false);

  useEffect(() => {
    api
      .get<{ matches: MatchWithOther[] }>('/matches')
      .then((data) => setMatches(data.matches))
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false));
  }, []);

  // Lazy-load likes when tab is first opened
  useEffect(() => {
    if (tab === 'likes' && !likesFetched) {
      setLikesLoading(true);
      api
        .get<LikesReceived>('/premium/likes-received')
        .then((data) => setLikesData(data))
        .catch(() => setLikesData(null))
        .finally(() => {
          setLikesLoading(false);
          setLikesFetched(true);
        });
    }
  }, [tab, likesFetched]);

  const unreadCount = (match: MatchWithOther) =>
    match.lastMessage && !match.lastMessage.isRead && match.lastMessage.senderId !== dbUser?.id;

  const likeCount = likesData?.count ?? likesData?.likes?.length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10">
        <div className="px-4 pt-4 pb-0 flex items-center gap-2">
          <Heart className="w-6 h-6 text-pink-500" />
          <h1 className="text-xl font-bold text-gray-900">Matches</h1>
        </div>

        {/* Tabs */}
        <div className="flex px-4 mt-3">
          <button
            onClick={() => setTab('matches')}
            className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'matches'
                ? 'border-pink-500 text-pink-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Matches
            {matches.length > 0 && (
              <span className="ml-1.5 text-xs bg-pink-100 text-pink-600 rounded-full px-1.5 py-0.5">
                {matches.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('likes')}
            className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'likes'
                ? 'border-pink-500 text-pink-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Eye className="w-4 h-4" />
            Liked You
            {likeCount > 0 && (
              <span className="text-xs bg-pink-100 text-pink-600 rounded-full px-1.5 py-0.5">
                {likeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <AnimatePresence mode="wait">
          {tab === 'matches' ? (
            <motion.div
              key="matches"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {matchesLoading ? (
                Array.from({ length: 4 }).map((_, i) => <MatchSkeleton key={i} />)
              ) : matches.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-pink-500/30">
                    <Heart className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">No matches yet</h2>
                  <p className="text-gray-500 text-sm">Keep swiping to find your perfect match!</p>
                </motion.div>
              ) : (
                matches.map((match, i) => {
                  const other = match.otherUser;
                  const hasUnread = unreadCount(match);

                  return (
                    <motion.button
                      key={match.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/chat/${match.id}`)}
                      className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={
                            other.profilePictures?.[0] ||
                            `https://ui-avatars.com/api/?name=${other.firstName}&background=ec4899&color=fff`
                          }
                          alt={other.firstName}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                        {other.isVerified && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                            <BadgeCheck className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`font-semibold truncate ${hasUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                            {other.firstName}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                            {formatDistanceToNow(new Date(match.createdAt), { addSuffix: true })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                            {match.lastMessage
                              ? match.lastMessage.senderId === dbUser?.id
                                ? `You: ${match.lastMessage.content}`
                                : match.lastMessage.content
                              : 'Say hello! 👋'}
                          </p>
                          {hasUnread ? (
                            <span className="ml-2 w-2.5 h-2.5 bg-pink-500 rounded-full flex-shrink-0" />
                          ) : (
                            <MessageCircle className="ml-2 w-4 h-4 text-gray-300 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </motion.div>
          ) : (
            <motion.div
              key="likes"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {likesLoading ? (
                Array.from({ length: 3 }).map((_, i) => <LikeSkeleton key={i} />)
              ) : !likesData || likesData.likes.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
                    <Eye className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">No likes yet</h2>
                  <p className="text-gray-500 text-sm">People who like your profile will appear here</p>
                </motion.div>
              ) : (
                <>
                  {!likesData.isPremium && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl p-4 text-white flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Crown className="w-5 h-5 text-yellow-300" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">
                          {likeCount} {likeCount === 1 ? 'person' : 'people'} liked you
                        </p>
                        <p className="text-white/80 text-xs mt-0.5">Upgrade to see who they are</p>
                      </div>
                      <button
                        onClick={() => navigate('/premium')}
                        className="bg-white text-pink-600 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 hover:bg-pink-50 active:scale-95 transition-all"
                      >
                        Unlock
                      </button>
                    </motion.div>
                  )}

                  {likesData.likes.map((like, i) => {
                    const isBlurred = !likesData.isPremium;
                    return (
                      <motion.div
                        key={like.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm"
                      >
                        <div className="relative flex-shrink-0">
                          {isBlurred ? (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                              <Lock className="w-6 h-6 text-gray-400" />
                            </div>
                          ) : (
                            <img
                              src={
                                like.sender.profilePictures?.[0] ||
                                `https://ui-avatars.com/api/?name=${like.sender.firstName}&background=ec4899&color=fff`
                              }
                              alt={like.sender.firstName}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                          )}
                          {like.sender.isVerified && !isBlurred && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                              <BadgeCheck className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-gray-900 ${isBlurred ? 'blur-sm select-none' : ''}`}>
                            {isBlurred ? '••••••' : like.sender.firstName}
                          </p>
                          <p className={`text-sm text-gray-500 truncate ${isBlurred ? 'blur-sm select-none' : ''}`}>
                            {isBlurred ? '••••••••••' : (like.sender.occupation ?? 'No occupation listed')}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDistanceToNow(new Date(like.createdAt), { addSuffix: true })}
                          </p>
                        </div>

                        {isBlurred && (
                          <button
                            onClick={() => navigate('/premium')}
                            className="flex-shrink-0 p-2 bg-pink-50 rounded-full"
                          >
                            <Crown className="w-4 h-4 text-pink-500" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
