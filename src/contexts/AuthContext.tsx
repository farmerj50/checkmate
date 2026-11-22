import { useCallback, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, isDemoMode } from '../lib/firebase';
import { api } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import type { User } from '../types';
import { AuthContext } from './auth';

// Minimal fake FirebaseUser for demo mode — the app only reads .uid and .email
const DEMO_TOKEN_KEY = 'demo_token';
const DEMO_EMAIL_KEY = 'demo_email';

function normalizeDemoEmail(email?: string | null) {
  return email?.trim().toLowerCase() || 'demo@vipi.app';
}

function demoUidForEmail(email?: string | null) {
  const normalized = normalizeDemoEmail(email);
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `demo_${slug || 'user'}`;
}

function makeDemoFirebaseUser(token: string, email?: string | null) {
  const normalizedEmail = normalizeDemoEmail(email);
  return {
    uid: token,
    email: normalizedEmail,
    displayName: normalizedEmail.split('@')[0] || 'Demo User',
    getIdToken: async () => token,
  } as unknown as FirebaseUser;
}

// Register FCM token after login — fire-and-forget
async function registerFcmToken() {
  try {
    // Dynamic import so the app works even without Firebase Messaging configured
    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });
    if (token) {
      await api.put('/safety/fcm-token', { token });
    }
  } catch {
    // Messaging not configured or permission denied — silent no-op
  }
}



export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDbUser = useCallback(async () => {
    const data = await api.get<{ user: User | null }>('/auth/me');
    setDbUser(data.user);
    return data.user;
  }, []);

  const clearDemoSession = () => {
    disconnectSocket();
    localStorage.removeItem(DEMO_TOKEN_KEY);
    localStorage.removeItem(DEMO_EMAIL_KEY);
    setFirebaseUser(null);
    setDbUser(null);
  };

  const startDemoSession = (email?: string | null) => {
    const normalizedEmail = normalizeDemoEmail(email);
    const token = demoUidForEmail(normalizedEmail);
    localStorage.setItem(DEMO_TOKEN_KEY, token);
    localStorage.setItem(DEMO_EMAIL_KEY, normalizedEmail);
    const demoUser = makeDemoFirebaseUser(token, normalizedEmail);
    setFirebaseUser(demoUser);
    return demoUser;
  };

  const requireExistingProfile = (user: User | null) => {
    if (!user) {
      throw Object.assign(new Error('No Vipi profile found for this account. Create an account first.'), {
        code: 'auth/no-profile',
      });
    }
    return user;
  };

  useEffect(() => {
    if (isDemoMode) {
      // Demo mode: restore session from localStorage, skip Firebase listener
      const token = localStorage.getItem(DEMO_TOKEN_KEY);
      if (token) {
        setFirebaseUser(makeDemoFirebaseUser(token, localStorage.getItem(DEMO_EMAIL_KEY)));
        fetchDbUser()
          .then((user) => setDbUser(user))
          .catch(() => {
            setDbUser(null);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await fetchDbUser();
          registerFcmToken();
        } catch {
          await signOut(auth).catch(() => null);
          setFirebaseUser(null);
          setDbUser(null);
        }
      } else {
        disconnectSocket();
        setDbUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [fetchDbUser]);

  const signInWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      startDemoSession(email);
      try {
        return requireExistingProfile(await fetchDbUser());
      } catch (err) {
        if ((err as { code?: string })?.code !== 'auth/no-profile') {
          clearDemoSession();
        }
        throw err;
      }
    }
    await signInWithEmailAndPassword(auth, email, password);
    try {
      return requireExistingProfile(await fetchDbUser());
    } catch (err) {
      if ((err as { code?: string })?.code !== 'auth/no-profile') {
        await signOut(auth).catch(() => null);
        setFirebaseUser(null);
        setDbUser(null);
      }
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      startDemoSession(email);
      setDbUser(null); // triggers onboarding
      return;
    }
    await createUserWithEmailAndPassword(auth, email, password);
    setDbUser(null);
  };

  const signInWithGoogle = async (intent: 'login' | 'signup' = 'login', emailHint?: string) => {
    if (isDemoMode) {
      startDemoSession(emailHint || localStorage.getItem(DEMO_EMAIL_KEY) || 'google@vipi.demo');
      try {
        const user = await fetchDbUser();
        if (intent === 'login') requireExistingProfile(user);
        return user;
      } catch (err) {
        if ((err as { code?: string })?.code !== 'auth/no-profile') {
          clearDemoSession();
        }
        throw err;
      }
    }
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    setFirebaseUser(credential.user);
    try {
      const user = await fetchDbUser();
      if (intent === 'login') requireExistingProfile(user);
      return user;
    } catch (err) {
      if ((err as { code?: string })?.code !== 'auth/no-profile') {
        await signOut(auth).catch(() => null);
        setFirebaseUser(null);
        setDbUser(null);
      }
      throw err;
    }
  };

  const logout = async () => {
    disconnectSocket();
    if (isDemoMode) {
      clearDemoSession();
    } else {
      await signOut(auth);
      setFirebaseUser(null);
      setDbUser(null);
    }
  };

  const resetPassword = async (email: string) => {
    if (isDemoMode) {
      // No-op in demo mode — show a friendly message instead
      throw Object.assign(new Error('Password reset requires real Firebase credentials.'), { code: 'demo/not-supported' });
    }
    await sendPasswordResetEmail(auth, email);
  };

  const refreshDbUser = fetchDbUser;

  const completeOnboarding = (user: User) => {
    setDbUser(user);
  };

  // True when logged in via Firebase but no DB profile yet
  const needsOnboarding = !!firebaseUser && !dbUser && !loading;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        loading,
        needsOnboarding,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        logout,
        resetPassword,
        refreshDbUser,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
