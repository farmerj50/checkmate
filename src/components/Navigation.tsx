import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Flame, PlusSquare, Heart, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getSocket } from '../lib/socket';

function useUnreadCount() {
  const { dbUser } = useAuth();
  const [count, setCount] = useState(0);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  const location = useLocation();

  useEffect(() => {
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

    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      socket.on('message:badge', () => setCount((n) => n + 1));
    });
    return () => { mounted = false; socketRef.current?.off('message:badge'); };
  }, [dbUser]);

  useEffect(() => {
    if (!dbUser) return;
    if (location.pathname.startsWith('/matches') || location.pathname.startsWith('/chat')) {
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
  const navigate  = useNavigate();
  const location  = useLocation();
  const unread = useUnreadCount();

  // These pages use their own full-screen layout
  if (location.pathname === '/explore' || location.pathname === '/studio' || location.pathname === '/dating') return null;

  const navItems = [
    { path: '/home',    icon: Home,   label: 'Home',    badge: 0 },
    { path: '/explore', icon: Search, label: 'Explore', badge: 0 },
    { path: '/dating',  icon: Flame,  label: 'Dating',  badge: 0 },
    { path: '/matches', icon: Heart,  label: 'Matches', badge: unread },
    { path: '/profile', icon: User,   label: 'Profile', badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#050508]/95 backdrop-blur-xl border-t border-white/8 px-2 py-2 z-50">
      <div className="flex justify-around items-center max-w-[720px] mx-auto">
        {/* First 2 tabs */}
        {navItems.slice(0, 2).map(({ path, icon: Icon, label, badge }) => (
          <NavLink key={path} to={path} className={({ isActive }) =>
            `flex flex-col items-center py-1.5 px-4 rounded-2xl transition-all ${isActive ? 'text-[#ff4d8d]' : 'text-white/40 hover:text-white/70'}`
          }>
            {({ isActive }) => (
              <>
                <motion.div whileTap={{ scale: 0.85 }} className={`relative p-2 rounded-xl ${isActive ? 'bg-[#ff4d8d]/15' : ''}`}>
                  <Icon className="w-5 h-5" />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-[#ff4d8d] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </motion.div>
                <span className="text-[10px] font-medium mt-0.5">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Center Create button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/create')}
          className={`flex flex-col items-center py-1.5 px-3 rounded-2xl transition-all ${location.pathname === '/create' ? 'text-[#ff4d8d]' : 'text-white/40 hover:text-white/70'}`}
        >
          <div className={`relative p-2 rounded-xl ${location.pathname === '/create' ? 'bg-[#ff4d8d]/15' : ''}`}>
            <PlusSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">Create</span>
        </motion.button>

        {/* Last 2 tabs */}
        {navItems.slice(2).map(({ path, icon: Icon, label, badge }) => (
          <NavLink key={path} to={path} className={({ isActive }) =>
            `flex flex-col items-center py-1.5 px-4 rounded-2xl transition-all ${isActive ? 'text-[#ff4d8d]' : 'text-white/40 hover:text-white/70'}`
          }>
            {({ isActive }) => (
              <>
                <motion.div whileTap={{ scale: 0.85 }} className={`relative p-2 rounded-xl ${isActive ? 'bg-[#ff4d8d]/15' : ''}`}>
                  <Icon className="w-5 h-5" />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-[#ff4d8d] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </motion.div>
                <span className="text-[10px] font-medium mt-0.5">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;
