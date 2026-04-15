import { useState, KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../lib/firebase';

export default function Login() {
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) { toast.error('Enter your email'); return; }
    if (!password) { toast.error('Enter your password'); return; }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      navigate('/discover');
    } catch (err: any) {
      const code = err.code ?? '';
      toast.error(
        code === 'auth/invalid-credential' || code === 'auth/user-not-found'
          ? 'Invalid email or password.'
          : code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : err.message ?? 'Sign in failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate('/discover');
    } catch {
      toast.error('Google sign in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
      {/* Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-10 h-10 rounded-2xl bg-pink-600 grid place-items-center shadow-lg shadow-pink-600/40">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-semibold tracking-tight">CheckMate</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-1">Welcome back</h1>
        <p className="text-white/40 text-sm mb-10">Sign in to continue</p>

        {isDemoMode && (
          <div className="mb-8 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-amber-300/80 text-xs">
            <strong className="text-amber-300">Demo mode</strong> — any email &amp; password will sign you in.
          </div>
        )}

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all disabled:opacity-50 mb-6"
        >
          {googleLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-white/25 text-xs">or</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Email */}
        <div className="space-y-5">
          <div className="border-b border-white/15 focus-within:border-pink-400 transition-colors pb-2">
            <label className="block text-white/35 text-xs mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKey}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-transparent text-white text-base placeholder-white/20 outline-none caret-pink-400"
            />
          </div>

          <div className="border-b border-white/15 focus-within:border-pink-400 transition-colors pb-2">
            <label className="block text-white/35 text-xs mb-1.5 uppercase tracking-wider">Password</label>
            <div className="flex items-center gap-2">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKey}
                placeholder="••••••••"
                autoComplete="current-password"
                className="flex-1 bg-transparent text-white text-base placeholder-white/20 outline-none caret-pink-400"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-3 mb-8">
          <Link to="/forgot-password" className="text-xs text-white/30 hover:text-pink-400 transition-colors">
            Forgot password?
          </Link>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-semibold shadow-xl shadow-pink-600/30 transition-colors"
        >
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>
          }
        </motion.button>

        <p className="text-center text-white/30 text-sm mt-8">
          New here?{' '}
          <Link to="/signup" className="text-pink-400 hover:text-pink-300 font-medium transition-colors">
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
