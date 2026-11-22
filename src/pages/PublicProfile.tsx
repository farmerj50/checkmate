import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Loader2, Grid, MoreVertical, Flag, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { socialService, type SocialPost } from '../services/social';
import { normalizeAssetUrl } from '../utils/helpers';
import FollowButton from '../components/FollowButton';
import ReportModal from '../components/ReportModal';
import type { FollowStatus } from '../types';

interface ProfileUser {
  id: string;
  firstName: string;
  bio?: string;
  profilePictures: string[];
  profileVideo?: string;
  isVerified: boolean;
  occupation?: string;
  age: number | null;
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser]             = useState<ProfileUser | null>(null);
  const [posts, setPosts]           = useState<SocialPost[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocking, setBlocking]     = useState(false);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      // Profile identity stays on the existing, unrelated /users route.
      api.get<{ user: ProfileUser }>(`/users/${userId}`).catch(() => null),
      socialService.getUserPosts(userId),
      socialService.getFollowStatus(userId),
    ])
      .then(([userData, postsPage, fs]) => {
        setUser(userData?.user ?? null);
        setPosts(postsPage.items);
        setPostsCursor(postsPage.nextCursor);
        setPostsHasMore(!!postsPage.nextCursor);
        setFollowStatus(fs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function loadMorePosts() {
    if (!userId || !postsCursor || loadingMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const page = await socialService.getUserPosts(userId, postsCursor);
      setPosts((prev) => [...prev, ...page.items]);
      setPostsCursor(page.nextCursor);
      setPostsHasMore(!!page.nextCursor);
    } catch {
      // silent — matches the initial-load error handling above
    } finally {
      setLoadingMorePosts(false);
    }
  }

  const avatar = normalizeAssetUrl(user?.profilePictures?.[0]);

  async function blockUser() {
    if (!userId || !user) return;
    setMenuOpen(false);
    setBlocking(true);
    try {
      await socialService.block(userId);
      toast.success(`${user.firstName} has been blocked`);
      navigate(-1);
    } catch {
      toast.error('Could not block user. Try again.');
    } finally {
      setBlocking(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050508] pb-20 lg:pl-[220px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/8 flex-none">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-semibold truncate">{user?.firstName ?? '…'}</span>
        </div>

        {user && (
          <div className="relative flex-none">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              disabled={blocking}
              className="p-2 rounded-full bg-white/8 disabled:opacity-50"
            >
              <MoreVertical className="w-5 h-5 text-white/70" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute right-0 top-12 bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-44 py-1 z-20"
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
                    >
                      <Flag className="w-4 h-4 text-red-400" /> Report user
                    </button>
                    <button
                      onClick={blockUser}
                      disabled={blocking}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Ban className="w-4 h-4" /> {blocking ? 'Blocking…' : 'Block user'}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 text-[#ff4d8d] animate-spin" /></div>
      ) : !user ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <p className="text-white/40 text-sm">Profile not found</p>
          <button onClick={() => navigate(-1)} className="text-[#ff4d8d] text-sm">Go back</button>
        </div>
      ) : (
        <>
          {/* Profile header */}
          <div className="px-4 pt-6 pb-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-full bg-white/10 overflow-hidden ring-2 ring-[#ff4d8d]/30 flex-none">
                {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-white text-lg font-bold truncate">{user.firstName}</h2>
                  {user.isVerified && <BadgeCheck className="w-5 h-5 text-[#ff4d8d] flex-none" />}
                </div>
                {user.occupation && <p className="text-white/40 text-sm truncate">{user.occupation}</p>}
                {user.age != null && <p className="text-white/30 text-xs">{user.age} years old</p>}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-8 mb-4">
              <div className="text-center">
                <p className="text-white font-bold text-lg">{posts.length}</p>
                <p className="text-white/40 text-xs">Posts</p>
              </div>
              {followStatus && (
                <>
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{followStatus.followerCount}</p>
                    <p className="text-white/40 text-xs">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{followStatus.followingCount}</p>
                    <p className="text-white/40 text-xs">Following</p>
                  </div>
                </>
              )}
            </div>

            {user.bio && <p className="text-white/60 text-sm mb-4 leading-relaxed">{user.bio}</p>}

            {userId && followStatus && (
              <FollowButton
                userId={userId}
                initialIsFollowing={followStatus.isFollowing}
                onToggle={(isF) => setFollowStatus((s) => s ? { ...s, isFollowing: isF, followerCount: s.followerCount + (isF ? 1 : -1) } : s)}
              />
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/6 mx-4 mb-0.5" />

          {/* Post grid */}
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <Grid className="w-10 h-10 text-white/15 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No posts yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {posts.map((p, i) => {
                const media = normalizeAssetUrl(p.videoUrl);
                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/post/${p.id}`)}
                    className="relative aspect-square bg-white/5 overflow-hidden"
                  >
                    <video
                      src={media ? `${media}#t=0.001` : ''}
                      className="w-full h-full object-cover"
                      muted playsInline preload="metadata"
                    />
                  </motion.button>
                );
              })}
            </div>
          )}
          {postsHasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMorePosts}
                disabled={loadingMorePosts}
                className="px-5 py-2 rounded-full bg-white/8 border border-white/10 text-white/60 text-sm font-medium hover:text-white disabled:opacity-50 transition-colors"
              >
                {loadingMorePosts ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {reportOpen && user && userId && (
        <ReportModal
          userId={userId}
          userName={user.firstName}
          onClose={() => setReportOpen(false)}
          onBlocked={() => navigate(-1)}
        />
      )}
    </div>
  );
}
