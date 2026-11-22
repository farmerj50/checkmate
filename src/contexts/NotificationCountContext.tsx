import { useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { getSocket } from '../lib/socket';
import { socialService } from '../services/social';

import { NotificationCountContext } from './notificationCount';

export function NotificationCountProvider({ children }: { children: ReactNode }) {
  const { dbUser } = useAuth();
  const [count, setCount] = useState(0);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  const location = useLocation();

  useEffect(() => {
    setCount(0);
    if (!dbUser) return;
    let mounted = true;
    const onNotification = () => setCount(n => n + 1);
    socialService.getUnreadNotificationCount().then(value => { if (mounted) setCount(value); }).catch(() => {});
    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      socket.on('notification:new', onNotification);
    }).catch(() => {});
    return () => { mounted = false; socketRef.current?.off('notification:new', onNotification); };
  }, [dbUser]);

  useEffect(() => {
    if (location.pathname === '/notifications') setCount(0);
  }, [location.pathname]);

  return (
    <NotificationCountContext.Provider value={count}>
      {children}
    </NotificationCountContext.Provider>
  );
}
