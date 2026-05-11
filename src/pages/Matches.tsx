import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, BadgeCheck, Eye, Crown, Lock, Loader2, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { normalizeAssetUrl } from '../utils/helpers';
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

interface ViewEntry {
  id: string;
  createdAt: string;
  viewer: {
    id: string;
    firstName: string;
    profilePictures: string[];
    occupation: string | null;
    dateOfBirth: string;
    isVerified: boolean;
  };
}

interface ViewsReceived {
  views: ViewEntry[];
  isPremium: boolean;
  count: number;
}

type Tab = 'matches' | 'likes' | 'viewers';

function MatchSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl animate-pulse">
      <div className="w-14 h-14 rounded-full bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/10 rounded-full w-28" />
        <div className="h-3 bg-white/6 rounded-full w-44" />
      </div>
    </div>
  );
}

function LikeSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl animate-pulse">
      <div className="w-14 h-14 rounded-full bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/10 rounded-full w-24" />
        <div className="h-3 bg-white/6 rounded-full w-36" />
      </div>
    </div>
  );
}

export default function Matches() {
  const navigate = useNavigate();
  const { dbUser } = useAuth();
  const [tab, setTab] = useState<Tab>('matches');

  const [matches, setMatches] = useState<MatchWithOther[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  const [likesData, setLikesData] = useState<LikesReceived | null>(null);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesFetched, setLikesFetched] = useState(false);

  const [viewsData, setViewsData] = useState<ViewsReceived | null>(null);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [viewsFetched, setViewsFetched] = useState(false);

  useEffect(() => {
    api
      .get<{ matches: MatchWithOther[] }>('/matches')
      .then((data) => setMatches(data.matches))
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'likes' && !likesFetched) {
      setLikesLoading(true);
      api
        .get<LikesReceived>('/premium/likes-received')
        .then((data) => setLikesData(data))
        .catch(() => setLikesData(null))
        .finally(() => { setLikesLoading(false); setLikesFetched(true); });
    }
  }, [tab, likesFetched]);

  useEffect(() => {
    if (tab === 'viewers' && !viewsFetched) {
      setViewsLoading(true);
      api
        .get<ViewsReceived>('/users/me/viewers')
        .then((data) => setViewsData(data))
        .catch(() => setViewsData(null))
        .finally(() => { setViewsLoading(false); setViewsFetched(true); });
    }
  }, [tab, viewsFetched]);

  const hasUnread = (match: MatchWithOther) =>
    match.lastMessage && !match.lastMessage.isRead && match.lastMessage.senderId !== dbUser?.id;

  const likeCount = likesData?.count ?? likesData?.likes?.length ?? 0;
  const viewCount = viewsData?.count ?? 0;

  return (
    <div className="min-h-screen bg-[#050508] pb-24">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/95 backdrop-blur-xl border-b border-white/6 px-4 pt-4 pb-0">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-[#ff4d8d]/15 flex items-center justify-center">
            <Heart className="w-4 h-4 text-[#ff4d8d] fill-[#ff4d8d]" />
          </div>
          <h1 className="text-xl font-bold text-white">Matches</h1>
        </div>

        {/* Tabs */}
        <div className="flex">
          <button
            onClick={() => setTab('matches')}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'matches'
                ? 'border-[#ff4d8d] text-[#ff4d8d]'
                : 'border-transparent text-white/35 hover:text-white/60'
            }`}
          >
            Matches
            {matches.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-[#ff4d8d]/20 text-[#ff4d8d] rounded-full px-1.5 py-0.5 font-bold">
                {matches.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('likes')}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'likes'
                ? 'border-[#ff4d8d] text-[#ff4d8d]'
                : 'border-transparent text-white/35 hover:text-white/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Liked You
            {likeCount > 0 && (
              <span className="text-[10px] bg-[#ff4d8d]/20 text-[#ff4d8d] rounded-full px-1.5 py-0.5 font-bold">
                {likeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('viewers')}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'viewers'
                ? 'border-[#8b5cf6] text-[#8b5cf6]'
                : 'border-transparent text-white/35 hover:text-white/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Viewed Me
            {viewCount > 0 && (
              <span className="text-[10px] bg-[#8b5cf6]/20 text-[#8b5cf6] rounded-full px-1.5 py-0.5 font-bold">
                {viewCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-2.5">
        <AnimatePresence mode="wait">

          {/* ── Matches tab ── */}
          {tab === 'matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-2.5"
            >
              {matchesLoading ? (
                Array.from({ length: 4 }).map((_, i) => <MatchSkeleton key={i} />)
              ) : matches.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-28 text-center"
                >
                  <div className="w-20 h-20 bg-[#ff4d8d]/15 rounded-full flex items-center justify-center mb-4 ring-1 ring-[#ff4d8d]/20">
                    <Heart className="w-9 h-9 text-[#ff4d8d]" />
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-2">No matches yet</h2>
                  <p className="text-white/40 text-sm">Keep swiping to find your perfect match!</p>
                  <button
                    onClick={() => navigate('/dating')}
                    className="mt-6 bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-semibold px-6 py-3 rounded-full shadow-lg shadow-pink-600/20"
                  >
                    Go to Dating
                  </button>
                </motion.div>
              ) : (
                matches.map((match, i) => {
                  const other = match.otherUser;
                  const avatar = normalizeAssetUrl(other.profilePictures?.[0]);
                  const unread = hasUnread(match);

                  return (
                    <motion.button
                      key={match.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/chat/${match.id}`)}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/8 active:scale-[0.98] rounded-2xl border border-white/6 transition-all text-left"
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {avatar ? (
                          <img src={avatar} alt={other.firstName} className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff4d8d]/40 to-[#8b5cf6]/40 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white/10">
                            {other.firstName?.[0]}
                          </div>
                        )}
                        {other.isVerified && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#ff4d8d] rounded-full flex items-center justify-center border-2 border-[#050508]">
                            <BadgeCheck className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {unread && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#ff4d8d] rounded-full border-2 border-[#050508]" />
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold text-sm truncate ${unread ? 'text-white' : 'text-white/80'}`}>
                            {other.firstName}
                          </span>
                          <span className="text-[11px] text-white/30 flex-shrink-0 ml-2">
                            {formatDistanceToNow(new Date(match.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${unread ? 'text-white/80 font-medium' : 'text-white/40'}`}>
                            {match.lastMessage
                              ? match.lastMessage.senderId === dbUser?.id
                                ? `You: ${match.lastMessage.content}`
                                : match.lastMessage.content
                              : 'Say hello! 👋'}
                          </p>
                          <MessageCircle className={`w-4 h-4 flex-shrink-0 ${unread ? 'text-[#ff4d8d]' : 'text-white/20'}`} />
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ── Liked You tab ── */}
          {tab === 'likes' && (
            <motion.div
              key="likes"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="space-y-2.5"
            >
              {likesLoading ? (
                <>
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-[#ff4d8d] animate-spin" />
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => <LikeSkeleton key={i} />)}
                </>
              ) : !likesData || likesData.likes.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-28 text-center"
                >
                  <div className="w-20 h-20 bg-[#8b5cf6]/15 rounded-full flex items-center justify-center mb-4 ring-1 ring-[#8b5cf6]/20">
                    <Eye className="w-9 h-9 text-[#8b5cf6]" />
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-2">No likes yet</h2>
                  <p className="text-white/40 text-sm">People who like your profile will appear here</p>
                </motion.div>
              ) : (
                <>
                  {/* Premium upsell banner */}
                  {!likesData.isPremium && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-[#ff4d8d]/20 to-[#8b5cf6]/20 border border-[#ff4d8d]/20 rounded-2xl p-4 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-[#ff4d8d]/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Crown className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">
                          {likeCount} {likeCount === 1 ? 'person' : 'people'} liked you
                        </p>
                        <p className="text-white/50 text-xs mt-0.5">Upgrade to see who they are</p>
                      </div>
                      <button
                        onClick={() => navigate('/premium')}
                        className="bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-xs font-bold px-4 py-2 rounded-full flex-shrink-0 active:scale-95 transition-transform"
                      >
                        Unlock
                      </button>
                    </motion.div>
                  )}

                  {likesData.likes.map((like, i) => {
                    const isBlurred = !likesData.isPremium;
                    const avatar = normalizeAssetUrl(like.sender.profilePictures?.[0]);

                    return (
                      <motion.div
                        key={like.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/6"
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          {isBlurred ? (
                            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                              <Lock className="w-5 h-5 text-white/30" />
                            </div>
                          ) : (
                            avatar
                              ? <img src={avatar} alt={like.sender.firstName} className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10" />
                              : <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff4d8d]/40 to-[#8b5cf6]/40 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white/10">
                                  {like.sender.firstName?.[0]}
                                </div>
                          )}
                          {like.sender.isVerified && !isBlurred && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#ff4d8d] rounded-full flex items-center justify-center border-2 border-[#050508]">
                              <BadgeCheck className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm text-white ${isBlurred ? 'blur-sm select-none' : ''}`}>
                            {isBlurred ? '•••••••' : like.sender.firstName}
                          </p>
                          <p className={`text-sm text-white/40 truncate mt-0.5 ${isBlurred ? 'blur-sm select-none' : ''}`}>
                            {isBlurred ? '••••••••••' : (like.sender.occupation ?? 'No occupation listed')}
                          </p>
                          <p className="text-[11px] text-white/25 mt-1">
                            {formatDistanceToNow(new Date(like.createdAt), { addSuffix: true })}
                          </p>
                        </div>

                        {isBlurred && (
                          <button
                            onClick={() => navigate('/premium')}
                            className="flex-shrink-0 w-9 h-9 bg-[#ff4d8d]/15 rounded-full flex items-center justify-center"
                          >
                            <Crown className="w-4 h-4 text-[#ff4d8d]" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </>
              )}
            </motion.div>
          )}

          {/* ── Viewed Me tab ── */}
          {tab === 'viewers' && (
            <motion.div
              key="viewers"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="space-y-2.5"
            >
              {viewsLoading ? (
                <>
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-[#8b5cf6] animate-spin" />
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl animate-pulse">
                      <div className="w-14 h-14 rounded-full bg-white/10 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-white/10 rounded-full w-24" />
                        <div className="h-3 bg-white/6 rounded-full w-36" />
                      </div>
                    </div>
                  ))}
                </>
              ) : !viewsData || viewsData.views.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-28 text-center"
                >
                  <div className="w-20 h-20 bg-[#8b5cf6]/15 rounded-full flex items-center justify-center mb-4 ring-1 ring-[#8b5cf6]/20">
                    <UserCheck className="w-9 h-9 text-[#8b5cf6]" />
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-2">No profile views yet</h2>
                  <p className="text-white/40 text-sm">People who open your profile will appear here</p>
                </motion.div>
              ) : (
                <>
                  {!viewsData.isPremium && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-[#8b5cf6]/20 to-[#ff4d8d]/20 border border-[#8b5cf6]/20 rounded-2xl p-4 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-[#8b5cf6]/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Crown className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">
                          {viewCount} {viewCount === 1 ? 'person' : 'people'} viewed your profile
                        </p>
                        <p className="text-white/50 text-xs mt-0.5">Upgrade to see who they are</p>
                      </div>
                      <button
                        onClick={() => navigate('/premium')}
                        className="bg-gradient-to-r from-[#8b5cf6] to-[#ff4d8d] text-white text-xs font-bold px-4 py-2 rounded-full flex-shrink-0 active:scale-95 transition-transform"
                      >
                        Unlock
                      </button>
                    </motion.div>
                  )}

                  {viewsData.views.map((view, i) => {
                    const isBlurred = !viewsData.isPremium;
                    const avatar = normalizeAssetUrl(view.viewer.profilePictures?.[0]);
                    return (
                      <motion.div
                        key={view.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/6"
                      >
                        <div className="relative flex-shrink-0">
                          {isBlurred ? (
                            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                              <Lock className="w-5 h-5 text-white/30" />
                            </div>
                          ) : (
                            avatar
                              ? <img src={avatar} alt={view.viewer.firstName} className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10" />
                              : <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#8b5cf6]/40 to-[#ff4d8d]/40 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white/10">
                                  {view.viewer.firstName?.[0]}
                                </div>
                          )}
                          {view.viewer.isVerified && !isBlurred && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#8b5cf6] rounded-full flex items-center justify-center border-2 border-[#050508]">
                              <BadgeCheck className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm text-white ${isBlurred ? 'blur-sm select-none' : ''}`}>
                            {isBlurred ? '•••••••' : view.viewer.firstName}
                          </p>
                          <p className={`text-sm text-white/40 truncate mt-0.5 ${isBlurred ? 'blur-sm select-none' : ''}`}>
                            {isBlurred ? '••••••••••' : (view.viewer.occupation ?? 'No occupation listed')}
                          </p>
                          <p className="text-[11px] text-white/25 mt-1">
                            {formatDistanceToNow(new Date(view.createdAt), { addSuffix: true })}
                          </p>
                        </div>

                        {isBlurred && (
                          <button
                            onClick={() => navigate('/premium')}
                            className="flex-shrink-0 w-9 h-9 bg-[#8b5cf6]/15 rounded-full flex items-center justify-center"
                          >
                            <Crown className="w-4 h-4 text-[#8b5cf6]" />
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
