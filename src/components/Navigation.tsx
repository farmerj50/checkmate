import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Heart, User, Compass, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getSocket } from '../lib/socket';

function useUnreadCount() {
  const { dbUser } = useAuth();
  const [count, setCount] = useState(0);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);

  useEffect(() => {
    if (!dbUser) return;

    // Initial load
    api
      .get<{ matches: Array<{ lastMessage?: { isRead: boolean; senderId: string } | null }> }>('/matches')
      .then((data) => {
        const unread = data.matches.filter(
          (m) => m.lastMessage && !m.lastMessage.isRead && m.lastMessage.senderId !== dbUser.id
        ).length;
        setCount(unread);
      })
      .catch(() => {});

    // Increment via socket when a new message arrives while on another tab
    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      // message:badge is emitted only to the receiver's personal room
      socket.on('message:badge', () => {
        setCount((n) => n + 1);
      });
    });

    return () => {
      mounted = false;
      socketRef.current?.off('message:badge');
    };
  }, [dbUser]);

  // Reset when user navigates to matches/chat
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith('/matches') || location.pathname.startsWith('/chat')) {
      // Re-fetch to get accurate count after reading messages
      if (!dbUser) return;
      api
        .get<{ matches: Array<{ lastMessage?: { isRead: boolean; senderId: string } | null }> }>('/matches')
        .then((data) => {
          const unread = data.matches.filter(
            (m) => m.lastMessage && !m.lastMessage.isRead && m.lastMessage.senderId !== dbUser.id
          ).length;
          setCount(unread);
        })
        .catch(() => {});
    }
  }, [location.pathname, dbUser]);

  return count;
}

const Navigation: React.FC = () => {
  const unread = useUnreadCount();

  const navItems = [
    { path: '/discover', icon: Compass, label: 'Discover' },
    { path: '/matches', icon: Heart, label: 'Matches', badge: unread },
    { path: '/premium', icon: Crown, label: 'Premium' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label, badge }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive ? 'text-pink-500' : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`relative p-2 rounded-full ${isActive ? 'bg-pink-100' : ''}`}
                >
                  <Icon className="w-6 h-6" />
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </motion.div>
                <span className="text-xs mt-1 font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;
