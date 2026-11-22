import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth';

export default function AuthProfileIssue() {
  const { profileError, refreshDbUser, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const conflict = profileError?.code === 'auth/profile-conflict';

  const retry = async () => {
    setBusy(true);
    try { await refreshDbUser(); } catch { /* The auth context displays the new lookup error. */ }
    finally { setBusy(false); }
  };
  const backToSignIn = async () => {
    setBusy(true);
    setSignOutFailed(false);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch { setSignOutFailed(true); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-md" aria-labelledby="profile-access-title">
        <h1 id="profile-access-title" className="text-3xl font-bold mb-4">
          {conflict ? 'Your profile needs reconnecting' : 'We could not load your profile'}
        </h1>
        <p role="alert" className="text-white/70 leading-relaxed mb-6">
          {conflict
            ? 'Your email already belongs to a profile, but this sign-in is not connected to it. Use your original sign-in, or contact support to reconnect your existing profile.'
            : 'Please try again. We need to check your existing profile before continuing.'}
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={backToSignIn} disabled={busy}
            className="rounded-xl px-5 py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 font-semibold">
            Back to sign in
          </button>
          <button onClick={retry} disabled={busy}
            className="rounded-xl px-5 py-3 border border-white/20 hover:bg-white/10 disabled:opacity-50">
            Check again
          </button>
        </div>
        {signOutFailed && <p role="alert" className="mt-4 text-rose-300">Could not sign out. Please try again.</p>}
      </section>
    </main>
  );
}
