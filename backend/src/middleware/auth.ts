import '../lib/env';
import { Request, Response, NextFunction } from 'express';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface AuthIdentity {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}
export interface AuthenticatedRequest extends Request { user?: AuthIdentity }
export class AuthenticationUnavailable extends Error {}

export function demoAuthEnabled(): boolean {
  return ['development', 'test'].includes(process.env.NODE_ENV ?? '') &&
    process.env.DEMO_AUTH_ENABLED === 'true';
}

export async function verifyAccessToken(token: unknown): Promise<AuthIdentity> {
  if (typeof token !== 'string' || !token || token.length > 8192) throw new Error('Invalid access token');
  if (!getApps().length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!json && !projectId && !clientEmail && !rawKey) {
      if (demoAuthEnabled() && /^demo_[A-Za-z0-9_.@+-]{1,200}$/.test(token)) return { uid: token };
      throw new AuthenticationUnavailable('Authentication is not configured');
    }
    try {
      const account = json ? JSON.parse(json) : {
        projectId, clientEmail,
        privateKey: (rawKey ?? '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n'),
      };
      initializeApp({ credential: cert(account), projectId: account.project_id ?? account.projectId });
    } catch {
      // Never fall back to demo identities after a credential error.
      throw new AuthenticationUnavailable('Authentication configuration is invalid');
    }
  }
  const decoded = await getAuth(getApp()).verifyIdToken(token, true);
  return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
  if (!match) return res.status(401).json({ error: 'Access token required' });
  try {
    req.user = await verifyAccessToken(match[1]);
    next();
  } catch (error) {
    if (error instanceof AuthenticationUnavailable) {
      return res.status(503).json({ error: 'Authentication is temporarily unavailable' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
};
