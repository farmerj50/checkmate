import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
import type { User } from '../types';

// Minimal fake FirebaseUser for demo mode — the app only reads .uid and .email
const DEMO_FIREBASE_USER = {
  uid: 'demo_user',
  email: 'demo@checkmate.app',
  displayName: 'Demo User',
  getIdToken: async () => 'demo_user',
} as unknown as FirebaseUser;

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

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: User | null;
  loading: boolean;
  needsOnboarding: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshDbUser: () => Promise<void>;
  /** Call after onboarding registration succeeds — sets dbUser immediately so
   *  PrivateRoute sees it before navigation, avoiding the redirect-to-onboarding race. */
  completeOnboarding: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDbUser = async () => {
    try {
      const data = await api.get<{ user: User | null }>('/auth/me');
      setDbUser(data.user);
    } catch {
      setDbUser(null);
    }
  };

  useEffect(() => {
    if (isDemoMode) {
      // Demo mode: restore session from localStorage, skip Firebase listener
      const token = localStorage.getItem('demo_token');
      if (token) {
        setFirebaseUser(DEMO_FIREBASE_USER);
        fetchDbUser().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchDbUser();
        registerFcmToken();
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      localStorage.setItem('demo_token', 'demo_user');
      setFirebaseUser(DEMO_FIREBASE_USER);
      await fetchDbUser();
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
    await fetchDbUser();
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      localStorage.setItem('demo_token', 'demo_user');
      setFirebaseUser(DEMO_FIREBASE_USER);
      setDbUser(null); // triggers onboarding
      return;
    }
    await createUserWithEmailAndPassword(auth, email, password);
    setDbUser(null);
  };

  const signInWithGoogle = async () => {
    if (isDemoMode) {
      localStorage.setItem('demo_token', 'demo_user');
      setFirebaseUser(DEMO_FIREBASE_USER);
      await fetchDbUser();
      return;
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    await fetchDbUser();
  };

  const logout = async () => {
    if (isDemoMode) {
      localStorage.removeItem('demo_token');
    } else {
      await signOut(auth);
    }
    setFirebaseUser(null);
    setDbUser(null);
  };

  const resetPassword = async (email: string) => {
    if (isDemoMode) {
      // No-op in demo mode — show a friendly message instead
      throw Object.assign(new Error('Password reset requires real Firebase credentials.'), { code: 'demo/not-supported' });
    }
    await sendPasswordResetEmail(auth, email);
  };

  const refreshDbUser = async () => {
    await fetchDbUser();
  };

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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
