import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Crown, Zap, Heart, Star, Eye, Check, X, Loader2, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';

interface PremiumStatus {
  isPremium: boolean;
  isBoosted: boolean;
  boostedUntil: string | null;
  hasSubscription: boolean;
  likesToday: number;
  likesRemaining: number;
  stripeEnabled: boolean;
}

const FEATURES = [
  { icon: Heart, label: 'Unlimited likes', free: false, premium: true },
  { icon: Star, label: 'Unlimited super likes', free: '3/day', premium: true },
  { icon: Eye, label: 'See who liked you', free: false, premium: true },
  { icon: Zap, label: 'Profile boost (30 min)', free: false, premium: true },
  { icon: Crown, label: 'Priority in discover', free: false, premium: true },
  { icon: Check, label: 'No ads', free: false, premium: true },
];

export default function Premium() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshDbUser } = useAuth();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    api
      .get<PremiumStatus>('/premium/status')
      .then(setStatus)
      .catch(() => toast.error('Could not load premium status'))
      .finally(() => setLoading(false));
  }, []);

  // Handle return from Stripe Checkout
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Welcome to Premium! 🎉');
      refreshDbUser?.();
      api.get<PremiumStatus>('/premium/status').then(setStatus).catch(() => {});
    } else if (searchParams.get('canceled') === 'true') {
      toast('Checkout canceled.', { icon: 'ℹ️' });
    }
  }, [searchParams]);

  async function handleCheckout() {
    setCheckoutLoading(true);
    try {
      const data = await api.post<{ url: string; error?: string }>('/premium/checkout', {});
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? 'Could not start checkout');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel your premium subscription? You keep access until the end of your billing period.')) return;
    setCancelLoading(true);
    try {
      await api.post('/premium/cancel', {});
      toast.success('Subscription will cancel at end of billing period');
      const updated = await api.get<PremiumStatus>('/premium/status');
      setStatus(updated);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel');
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <Crown className="w-6 h-6 text-yellow-500" />
          <h1 className="text-xl font-bold text-gray-900">Premium</h1>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-md mx-auto space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl bg-gradient-to-br from-pink-500 to-rose-600 p-6 text-white shadow-xl shadow-pink-500/25 text-center"
            >
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Crown className="w-9 h-9 text-yellow-300" />
              </div>
              {status?.isPremium ? (
                <>
                  <h2 className="text-2xl font-bold mb-1">You're Premium ✨</h2>
                  <p className="text-pink-100 text-sm">Enjoy all the perks below</p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-1">Upgrade to Premium</h2>
                  <p className="text-pink-100 text-sm">
                    {status?.likesRemaining === 0
                      ? "You've hit your daily like limit — go unlimited"
                      : 'Get more matches, faster'}
                  </p>
                </>
              )}
            </motion.div>

            {/* Feature comparison */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="grid grid-cols-3 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span>Feature</span>
                <span className="text-center">Free</span>
                <span className="text-center text-pink-600">Premium</span>
              </div>
              {FEATURES.map(({ icon: Icon, label, free, premium }) => (
                <div key={label} className="grid grid-cols-3 px-4 py-3 border-t border-gray-50 items-center">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                  <div className="flex justify-center">
                    {free === false ? (
                      <X className="w-4 h-4 text-gray-300" />
                    ) : free === true ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-gray-400">{free}</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {premium === true ? (
                      <Check className="w-4 h-4 text-pink-500" />
                    ) : (
                      <span className="text-xs text-pink-600 font-medium">{premium}</span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Status card for premium users */}
            {status?.isPremium && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="bg-white rounded-2xl shadow-sm p-4 space-y-3"
              >
                <h3 className="font-semibold text-gray-900">Your plan</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
                {status.isBoosted && status.boostedUntil && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Boost active until</span>
                    <span className="font-medium text-pink-600">
                      {new Date(status.boostedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Likes remaining for free users */}
            {!status?.isPremium && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="bg-white rounded-2xl shadow-sm p-4"
              >
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Likes used today</span>
                  <span className="font-semibold text-gray-900">
                    {status?.likesToday ?? 0} / 20
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((status?.likesToday ?? 0) / 20) * 100)}%` }}
                  />
                </div>
              </motion.div>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              {!status?.isPremium ? (
                <div className="space-y-3">
                  {!status?.stripeEnabled && (
                    <p className="text-center text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
                      Payments are in test mode — add STRIPE_SECRET_KEY &amp; STRIPE_PRICE_ID to backend/.env.dev to enable
                    </p>
                  )}
                  <Button
                    className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-4 text-base font-bold rounded-2xl shadow-lg shadow-pink-500/30 hover:shadow-xl disabled:opacity-60"
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      <>
                        <Crown className="w-5 h-5 mr-2 inline-block text-yellow-300" />
                        Get Premium
                      </>
                    )}
                  </Button>
                  <p className="text-center text-xs text-gray-400">
                    Cancel anytime. Secure payment via Stripe.
                  </p>
                </div>
              ) : (
                status.hasSubscription && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
                  >
                    {cancelLoading ? 'Canceling...' : 'Cancel subscription'}
                  </button>
                )
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
