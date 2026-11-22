import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
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
import { errorField, errorMessage } from '../utils/errors';

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
  const [checkedUid, setCheckedUid] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<{ code: string; message: string } | null>(null);
  const profileLookup = useRef<{ uid: string; promise: Promise<User | null> } | null>(null);

  const fetchDbUser = useCallback((account?: FirebaseUser) => {
    const currentUid = () => isDemoMode ? localStorage.getItem(DEMO_TOKEN_KEY) : auth.currentUser?.uid;
    const uid = account?.uid ?? currentUid();
    if (!uid) return Promise.reject(new Error('Sign in to load your profile.'));
    // The Firebase listener and sign-in handler share one lookup for this session.
    if (profileLookup.current?.uid === uid) return profileLookup.current.promise;
    setCheckedUid(null);
    setProfileError(null);
    const lookup = { uid, promise: null as unknown as Promise<User | null> };
    profileLookup.current = lookup;
    lookup.promise = api.get<{ user: User | null }>('/auth/me').then(data => {
      if (profileLookup.current === lookup && currentUid() === uid) {
        setDbUser(data.user);
        setCheckedUid(uid);
      }
      return data.user;
    }).catch((error: unknown) => {
      if (profileLookup.current === lookup && currentUid() === uid) {
        setDbUser(null);
        setProfileError({
          code: String(errorField(error, 'code') ?? 'auth/profile-unavailable'),
          message: errorMessage(error, 'We could not check your profile. Please try again.'),
        });
      }
      throw error;
    }).finally(() => {
      if (profileLookup.current === lookup) profileLookup.current = null;
    });
    return lookup.promise;
  }, []);

  const clearDemoSession = () => {
    disconnectSocket();
    localStorage.removeItem(DEMO_TOKEN_KEY);
    localStorage.removeItem(DEMO_EMAIL_KEY);
    profileLookup.current = null;
    setCheckedUid(null);
    setProfileError(null);
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
    setDbUser(null);
    setCheckedUid(null);
    setProfileError(null);
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
          .catch(() => { /* The lookup records the recovery state. */ })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);
      if (user) {
        try {
          await fetchDbUser(user);
          registerFcmToken();
        } catch {
          // Keep the session so the profile recovery screen can offer retry/sign-out.
          // A failed lookup never means this account needs registration.
        }
      } else {
        profileLookup.current = null;
        disconnectSocket();
        setDbUser(null);
        setCheckedUid(null);
        setProfileError(null);
      }
      if (auth.currentUser?.uid === user?.uid) setLoading(false);
    });
    return unsubscribe;
  }, [fetchDbUser]);

  const signInWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      return requireExistingProfile(await fetchDbUser(startDemoSession(email)));
    }
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return requireExistingProfile(await fetchDbUser(credential.user));
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (isDemoMode) {
      return fetchDbUser(startDemoSession(email));
    }
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return fetchDbUser(credential.user);
  };

  const signInWithGoogle = async (intent: 'login' | 'signup' = 'login', emailHint?: string) => {
    if (isDemoMode) {
      const account = startDemoSession(emailHint || localStorage.getItem(DEMO_EMAIL_KEY) || 'google@vipi.demo');
      const user = await fetchDbUser(account);
      if (intent === 'login') requireExistingProfile(user);
      return user;
    }
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    setFirebaseUser(credential.user);
    const user = await fetchDbUser(credential.user);
    if (intent === 'login') requireExistingProfile(user);
    return user;
  };

  const logout = async () => {
    disconnectSocket();
    if (isDemoMode) {
      clearDemoSession();
    } else {
      await signOut(auth);
      profileLookup.current = null;
      setCheckedUid(null);
      setProfileError(null);
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
    profileLookup.current = null;
    setDbUser(user);
    setCheckedUid(firebaseUser?.uid ?? null);
    setProfileError(null);
  };

  // Onboarding requires a successful lookup for this exact sign-in identity.
  const profileChecked = !!firebaseUser && checkedUid === firebaseUser.uid;
  const needsOnboarding = profileChecked && !dbUser && !loading && !profileError;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        loading,
        needsOnboarding,
        profileChecked,
        profileError,
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
