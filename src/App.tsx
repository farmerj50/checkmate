import { BrowserRouter, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationCountProvider } from './contexts/NotificationCountContext';
import AppRoutes from './routes/AppRoutes';
import Navigation from './components/Navigation';
import DesktopSidebar from './components/DesktopSidebar';

const NO_NAV_PATHS = ['/', '/login', '/signup', '/forgot-password', '/onboarding'];

function AppShell() {
  const { pathname } = useLocation();
  // Hide nav on full-screen experiences
  const isInChat = /^\/chat\/.+/.test(pathname);
  const isDiscover = pathname === '/discover';
  const showNav = !NO_NAV_PATHS.includes(pathname) && !isInChat && !isDiscover;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppRoutes />
      {showNav && <Navigation />}
      {showNav && <DesktopSidebar />}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#374151',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationCountProvider>
          <AppShell />
        </NotificationCountProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
