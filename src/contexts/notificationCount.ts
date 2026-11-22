import { createContext, useContext } from 'react';

export const NotificationCountContext = createContext<number>(0);

export function useNotificationCount() {
  return useContext(NotificationCountContext);
}
