import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2, Heart, UserPlus, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { normalizeAssetUrl } from '../utils/helpers';
import { getSocket } from '../lib/socket';
import { useAuth } from '../contexts/AuthContext';
import type { SocialNotification } from '../types';

const TYPE_META: Record<SocialNotification['type'], { icon: typeof Heart; color: string; label: string }> = {
  NEW_FOLLOWER:   { icon: UserPlus,       color: '#8b5cf6', label: 'started following you' },
  POST_LIKED:     { icon: Heart,          color: '#ff4d8d', label: 'liked your post' },
  POST_COMMENTED: { icon: MessageCircle,  color: '#06b6d4', label: 'commented on your post' },
  NEW_MATCH:      { icon: Heart,          color: '#f59e0b', label: 'matched with you 💕' },
};

export default function Notifications() {
  const navigate = useNavigate();
  useAuth();
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);

  useEffect(() => {
    api.get<{ notifications: SocialNotification[] }>('/social/notifications')
      .then((d) => setNotifications(d.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Mark all read
    api.put('/social/notifications/read-all', {}).catch(() => {});

    // Real-time
    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      socket.on('notification:new', (notif: SocialNotification) => {
        setNotifications((prev) => [notif, ...prev]);
      });
    });
    return () => {
      mounted = false;
      socketRef.current?.off('notification:new');
    };
  }, []);

  function handleTap(n: SocialNotification) {
    if (n.matchId) navigate('/matches');
    else if (n.postId) navigate(`/post/${n.postId}`);
    else if (n.actor?.id) navigate(`/profile/${n.actor.id}`);
  }

  return (
    <div className="min-h-screen bg-[#050508] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">Notifications</h1>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={() => {
              api.put('/social/notifications/read-all', {}).catch(() => {});
              setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            }}
            className="text-xs text-[#ff4d8d] font-semibold"
          >
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-7 h-7 text-[#ff4d8d] animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Bell className="w-12 h-12 text-white/15" />
          <p className="text-white/40 text-sm">No notifications yet</p>
        </div>
      ) : (
        <div>
          {notifications.map((n, i) => {
            const meta   = TYPE_META[n.type];
            const Icon   = meta.icon;
            const avatar = normalizeAssetUrl(n.actor?.profilePictures?.[0]);

            return (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleTap(n)}
                className={`w-full flex items-center gap-3 px-4 py-4 border-b border-white/5 hover:bg-white/3 transition ${!n.isRead ? 'bg-white/4' : ''}`}
              >
                {/* Avatar */}
                <div className="relative flex-none">
                  <div className="w-11 h-11 rounded-full bg-white/10 overflow-hidden">
                    {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm leading-snug">
                    <span className="font-semibold">{n.actor?.firstName ?? 'Someone'}</span>
                    {' '}{meta.label}
                  </p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-[#ff4d8d] flex-none" />
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
