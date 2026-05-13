import { createServer } from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Server as SocketServer } from 'socket.io';
import { prisma } from './lib/prisma';
import { initSocket } from './socket/chat';

dotenv.config({ path: '.env.dev' }); // Railway injects real env vars; this is a local dev fallback only

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import matchRoutes from './routes/matches';
import messageRoutes from './routes/messages';
import uploadRoutes from './routes/upload';
import safetyRoutes from './routes/safety';
import premiumRoutes, { handleStripeWebhook } from './routes/premium';
import aiRoutes from './routes/ai';
import socialRoutes from './routes/social';
import judgeRoutes from './routes/judge';
import { setIo } from './lib/io';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ALLOWLIST_JSON
  ? (JSON.parse(process.env.CORS_ALLOWLIST_JSON) as string[])
  : [process.env.FRONTEND_URL || 'http://localhost:5173'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet());

// Stripe webhook needs raw body — must be before express.json()
app.post(
  '/api/premium/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (photos + videos)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/matches', judgeRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.io — separate from Vite's WS, so use a distinct path
const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
  path: '/socket.io',
});

initSocket(io);
setIo(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⚡ Socket.io ready`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
