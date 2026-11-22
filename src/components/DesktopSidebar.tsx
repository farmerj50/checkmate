import { NavLink } from 'react-router-dom';
import { Home, Search, Flame, PlusSquare, Film, PartyPopper, ShoppingBag, Heart, User as UserIcon, Bell, Settings as SettingsIcon } from 'lucide-react';
import { useNotificationCount } from '../contexts/notificationCount';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-[#ff4d8d]/12 text-[#ff4d8d]' : 'text-white/50 hover:text-white hover:bg-white/5'
  }`;

const DesktopSidebar: React.FC = () => {
  const notifCount = useNotificationCount();

  const navItems = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/explore', icon: Search, label: 'Explore' },
    { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
    { to: '/night-out', icon: PartyPopper, label: 'Night Out' },
    { to: '/create', icon: PlusSquare, label: 'Create' },
    { to: '/studio', icon: Film, label: 'Studio' },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: notifCount },
    { to: '/dating', icon: Flame, label: 'Dating' },
    { to: '/matches', icon: Heart, label: 'Matches' },
    { to: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-50 flex-col bg-[#0a0a0f] border-r border-white/8" style={{ width: 220 }}>
      <div className="px-6 py-5 flex-none">
        <span className="text-white font-bold text-lg tracking-tight">Vipi</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} end={to === '/profile'} className={linkClass}>
            <span className="relative flex-none">
              <Icon className="w-5 h-5" />
              {!!badge && badge > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] bg-[#ff4d8d] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 flex-none">
        <NavLink to="/settings" className={linkClass}>
          <SettingsIcon className="w-5 h-5 flex-none" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
