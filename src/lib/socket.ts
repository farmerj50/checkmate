import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  const socketOrigin = apiUrl ? apiUrl.replace(/\/api$/, '') : '/';

  socket = io(socketOrigin, {
    path: '/socket.io',
    auth: callback => {
      getAccessToken().then(token => callback({ token })).catch(() => callback({ token: null }));
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
