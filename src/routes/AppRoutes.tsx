import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import ForgotPassword from '../pages/ForgotPassword';
import Onboarding from '../pages/Onboarding';
import Discover from '../pages/Discover';
import Matches from '../pages/Matches';
import Chat from '../pages/Chat';
import MatchProfile from '../pages/MatchProfile';
import Profile from '../pages/Profile';
import Settings from '../pages/Settings';
import Premium from '../pages/Premium';

// Show a blank screen while auth state is resolving
function AuthLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
    </div>
  );
}

// Redirect logged-in users away from auth pages
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (firebaseUser) return <Navigate to="/discover" replace />;
  return <>{children}</>;
}

// Redirect unauthenticated users to login; redirect users who haven't finished onboarding
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading, needsOnboarding } = useAuth();
  if (loading) return <AuthLoading />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

// Only accessible when logged in but profile not yet created
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, dbUser: _dbUser, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (_dbUser) return <Navigate to="/discover" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

      {/* Onboarding */}
      <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />

      {/* Protected */}
      <Route path="/discover" element={<PrivateRoute><Discover /></PrivateRoute>} />
      <Route path="/matches" element={<PrivateRoute><Matches /></PrivateRoute>} />
      <Route path="/chat/:id" element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="/match/:matchId" element={<PrivateRoute><MatchProfile /></PrivateRoute>} />
      <Route path="/chat" element={<Navigate to="/matches" replace />} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/premium" element={<PrivateRoute><Premium /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
