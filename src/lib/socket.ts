import { io, Socket } from 'socket.io-client';
import { auth } from './firebase';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : 'demo_user';

  socket = io('/', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
