import { useState } from 'react';
import { UserPlus, UserCheck } from 'lucide-react';
import { api } from '../lib/api';

interface Props {
  userId: string;
  initialIsFollowing: boolean;
  onToggle?: (isFollowing: boolean) => void;
  small?: boolean;
}

export default function FollowButton({ userId, initialIsFollowing, onToggle, small }: Props) {
  const [following, setFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      if (next) {
        await api.post(`/social/follow/${userId}`, {});
      } else {
        await api.delete(`/social/follow/${userId}`);
      }
      onToggle?.(next);
    } catch {
      setFollowing(!next);
    } finally {
      setLoading(false);
    }
  }

  if (small) {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${
          following
            ? 'bg-white/10 text-white/60 border border-white/20'
            : 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full font-semibold text-sm transition ${
        following
          ? 'bg-white/10 text-white border border-white/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30'
          : 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white shadow-lg shadow-[#ff4d8d]/25'
      }`}
    >
      {following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
