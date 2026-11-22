import { lazy, Suspense } from 'react';
/**
 * ROUTING STRUCTURE
 * SOCIAL (primary): /home, /explore, /create, /notifications, /profile/:userId, /post/:postId
 * MARKETPLACE (new, frontend-only mock backend): /marketplace, /marketplace/:listingId,
 *   /marketplace/seller/:userId, /marketplace/create
 * NIGHT OUT (new, frontend-only mock backend): /night-out, /night-out/:eventId,
 *   /night-out/host/:hostId, /night-out/create
 * DATING (secondary): /dating  (Discover.tsx — DO NOT rewrite)
 * /discover redirects → /dating
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import AuthProfileIssue from '../components/AuthProfileIssue';
const Landing = lazy(() => import('../pages/Landing'));
const Login = lazy(() => import('../pages/Login'));
const Signup = lazy(() => import('../pages/Signup'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const Onboarding = lazy(() => import('../pages/Onboarding'));
const Discover = lazy(() => import('../pages/Discover'));
const Matches = lazy(() => import('../pages/Matches'));
const Chat = lazy(() => import('../pages/Chat'));
const MatchProfile = lazy(() => import('../pages/MatchProfile'));
const Profile = lazy(() => import('../pages/Profile'));
const Settings = lazy(() => import('../pages/Settings'));
const Premium = lazy(() => import('../pages/Premium'));
const HomeFeed = lazy(() => import('../pages/HomeFeed'));
const Explore = lazy(() => import('../pages/Explore'));
const CreatePost = lazy(() => import('../pages/CreatePost'));
const Notifications = lazy(() => import('../pages/Notifications'));
const PublicProfile = lazy(() => import('../pages/PublicProfile'));
const PostDetail = lazy(() => import('../pages/PostDetail'));
const Studio = lazy(() => import('../pages/Studio'));
const Marketplace = lazy(() => import('../pages/Marketplace'));
const MarketplaceDetail = lazy(() => import('../pages/MarketplaceDetail'));
const MarketplaceSeller = lazy(() => import('../pages/MarketplaceSeller'));
const MarketplaceCreate = lazy(() => import('../pages/MarketplaceCreate'));
const NightOut = lazy(() => import('../pages/NightOut'));
const NightOutDetail = lazy(() => import('../pages/NightOutDetail'));
const NightOutHost = lazy(() => import('../pages/NightOutHost'));
const NightOutCreate = lazy(() => import('../pages/NightOutCreate'));

function AuthLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading, dbUser, profileChecked, profileError } = useAuth();
  if (loading) return <AuthLoading />;
  if (firebaseUser && profileError) return <AuthProfileIssue />;
  if (firebaseUser && !profileChecked) return <AuthLoading />;
  if (firebaseUser && dbUser) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading, needsOnboarding, profileChecked, profileError } = useAuth();
  if (loading) return <AuthLoading />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (profileError) return <AuthProfileIssue />;
  if (!profileChecked) return <AuthLoading />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, dbUser: _dbUser, loading, profileChecked, profileError } = useAuth();
  if (loading) return <AuthLoading />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (profileError) return <AuthProfileIssue />;
  if (!profileChecked) return <AuthLoading />;
  if (_dbUser) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<AuthLoading />}>
    <Routes>
      {/* Public */}
      <Route path="/"               element={<Landing />} />
      <Route path="/login"          element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup"         element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

      {/* Onboarding */}
      <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />

      {/* Social (primary) */}
      <Route path="/home"           element={<PrivateRoute><HomeFeed /></PrivateRoute>} />
      <Route path="/explore"        element={<PrivateRoute><Explore /></PrivateRoute>} />
      <Route path="/create"         element={<PrivateRoute><CreatePost /></PrivateRoute>} />
      <Route path="/notifications"  element={<PrivateRoute><Notifications /></PrivateRoute>} />
      <Route path="/profile/:userId" element={<PrivateRoute><PublicProfile /></PrivateRoute>} />
      <Route path="/post/:postId"   element={<PrivateRoute><PostDetail /></PrivateRoute>} />
      <Route path="/studio"         element={<PrivateRoute><Studio /></PrivateRoute>} />

      {/* Marketplace (new vertical, frontend-only mock backend) */}
      <Route path="/marketplace"                element={<PrivateRoute><Marketplace /></PrivateRoute>} />
      <Route path="/marketplace/create"         element={<PrivateRoute><MarketplaceCreate /></PrivateRoute>} />
      <Route path="/marketplace/seller/:userId" element={<PrivateRoute><MarketplaceSeller /></PrivateRoute>} />
      <Route path="/marketplace/:listingId"     element={<PrivateRoute><MarketplaceDetail /></PrivateRoute>} />

      {/* Night Out (new vertical, frontend-only mock backend) */}
      <Route path="/night-out"              element={<PrivateRoute><NightOut /></PrivateRoute>} />
      <Route path="/night-out/create"       element={<PrivateRoute><NightOutCreate /></PrivateRoute>} />
      <Route path="/night-out/host/:hostId" element={<PrivateRoute><NightOutHost /></PrivateRoute>} />
      <Route path="/night-out/:eventId"     element={<PrivateRoute><NightOutDetail /></PrivateRoute>} />

      {/* Dating (secondary — Discover stays at /dating, never rewritten) */}
      <Route path="/dating"         element={<PrivateRoute><Discover /></PrivateRoute>} />
      <Route path="/discover"       element={<Navigate to="/dating" replace />} />

      {/* Existing protected */}
      <Route path="/matches"        element={<PrivateRoute><Matches /></PrivateRoute>} />
      <Route path="/chat/:id"       element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="/match/:matchId" element={<PrivateRoute><MatchProfile /></PrivateRoute>} />
      <Route path="/chat"           element={<Navigate to="/matches" replace />} />
      <Route path="/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/settings"       element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/premium"        element={<PrivateRoute><Premium /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
