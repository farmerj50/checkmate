import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Loader2, Grid } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { normalizeAssetUrl, calculateAge } from '../utils/helpers';
import FollowButton from '../components/FollowButton';
import type { Post, FollowStatus } from '../types';

interface ProfileUser {
  id: string;
  firstName: string;
  bio?: string;
  profilePictures: string[];
  profileVideo?: string;
  isVerified: boolean;
  occupation?: string;
  dateOfBirth: string;
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser]             = useState<ProfileUser | null>(null);
  const [posts, setPosts]           = useState<Post[]>([]);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      api.get<{ user: ProfileUser }>(`/users/${userId}`),
      api.get<{ posts: Post[] }>(`/social/posts/user/${userId}`),
      api.get<FollowStatus>(`/social/users/${userId}/follow-status`),
    ])
      .then(([userData, postsData, fs]) => {
        setUser(userData.user);
        setPosts(postsData.posts);
        setFollowStatus(fs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const avatar = normalizeAssetUrl(user?.profilePictures?.[0]);

  return (
    <div className="min-h-screen bg-[#050508] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/8">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold">{user?.firstName ?? '…'}</span>
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
                {user.dateOfBirth && <p className="text-white/30 text-xs">{calculateAge(user.dateOfBirth)} years old</p>}
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
                const media = normalizeAssetUrl(p.mediaUrl);
                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/post/${p.id}`)}
                    className="relative aspect-square bg-white/5 overflow-hidden"
                  >
                    {p.mediaType === 'VIDEO' ? (
                      <video
                        src={media ? `${media}#t=0.001` : ''}
                        className="w-full h-full object-cover"
                        muted playsInline preload="metadata"
                      />
                    ) : (
                      <img src={media ?? ''} alt="" className="w-full h-full object-cover" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
