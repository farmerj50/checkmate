import { createContext, useContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: User | null;
  loading: boolean;
  needsOnboarding: boolean;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (intent?: 'login' | 'signup', emailHint?: string) => Promise<User | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshDbUser: () => Promise<User | null>;
  /** Call after onboarding registration succeeds — sets dbUser immediately so
   *  PrivateRoute sees it before navigation, avoiding the redirect-to-onboarding race. */
  completeOnboarding: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
