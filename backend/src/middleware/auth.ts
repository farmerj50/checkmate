import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthenticatedRequest extends Request {
  user?: { uid: string };
}

// Initialize Firebase Admin once, only if credentials are available
if (!admin.apps.length) {
  const projectId    = process.env.FIREBASE_PROJECT_ID;
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
      console.log('✅ Firebase Admin initialized');
    } catch (e) {
      console.warn('⚠️  Firebase Admin init failed — running in demo mode.', e);
    }
  } else {
    console.warn('⚠️  Firebase env vars not set — running in demo auth mode.');
  }
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // If Firebase Admin is initialized, verify the real token
    if (admin.apps.length && admin.app().options.projectId) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = { uid: decodedToken.uid };
    } else {
      // Demo mode: accept any token, treat it as the demo user uid
      // In demo mode the token itself is used as the uid so different
      // tokens map to different users (enables multi-user local testing)
      req.user = { uid: token.startsWith('demo_') ? token : 'demo_user' };
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
