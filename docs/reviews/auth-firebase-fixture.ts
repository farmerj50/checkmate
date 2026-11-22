// Local browser tests only. Imported exclusively by auth-vite.config.mts.
type FixtureUser = { uid: string; email: string; getIdToken: () => Promise<string> };
const listeners = new Set<(user: FixtureUser | null) => void>();
function user(uid: string): FixtureUser {
  return { uid, email: 'member@example.test', getIdToken: async () => uid };
}
const restored = sessionStorage.getItem('auth-fixture-uid');
export const auth = { currentUser: restored ? user(restored) : null };
export const isDemoMode = false;
async function signIn(uid = 'fixture-google-user') {
  auth.currentUser = user(uid);
  sessionStorage.setItem('auth-fixture-uid', uid);
  const account = auth.currentUser;
  for (const listener of listeners) queueMicrotask(() => listener(account));
  return { user: account };
}
export const signInWithPopup = () => signIn();
export const signInWithEmailAndPassword = () => signIn('fixture-password-user');
export const createUserWithEmailAndPassword = () => signIn('fixture-new-password-user');
export class GoogleAuthProvider {}
export function onAuthStateChanged(_auth: unknown, listener: (user: FixtureUser | null) => void) {
  listeners.add(listener);
  queueMicrotask(() => listener(auth.currentUser));
  return () => listeners.delete(listener);
}
export async function signOut() {
  auth.currentUser = null;
  sessionStorage.removeItem('auth-fixture-uid');
  for (const listener of listeners) queueMicrotask(() => listener(null));
}
export async function sendPasswordResetEmail() {}
export function getMessaging(): never { throw new Error('Messaging disabled in local auth tests'); }
export async function getToken() { return ''; }
Object.assign(window, { authFixture: { signIn, signOut } });
