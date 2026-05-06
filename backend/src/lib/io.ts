import { Server } from 'socket.io';
export let io: Server;
export function setIo(instance: Server) { io = instance; }
