import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isRealConfig = apiKey && apiKey !== 'demo' && !apiKey.startsWith('your_');

let app: FirebaseApp;
let auth: Auth;

if (isRealConfig) {
  const firebaseConfig = {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
} else {
  // Demo mode: initialize with a minimal valid-looking config.
  // Real auth calls will fail gracefully; the backend accepts demo tokens.
  const demoConfig = {
    apiKey: 'demo-key',
    authDomain: 'demo.firebaseapp.com',
    projectId: 'demo',
    storageBucket: 'demo.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000',
  };
  app = getApps().length === 0 ? initializeApp(demoConfig) : getApps()[0];
  auth = getAuth(app);
  console.warn(
    '[Firebase] Running in demo mode. Add real VITE_FIREBASE_* values to .env.development to enable auth.'
  );
}

export { auth };
export { isRealConfig as isFirebaseConfigured };
export const isDemoMode = !isRealConfig;
export default app;
