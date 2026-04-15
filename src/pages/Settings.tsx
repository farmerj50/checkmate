import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, LogOut, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { UserPreference } from '../types';

// ── Reusable toggle ───────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-pink-500' : 'bg-gray-200'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow ${value ? 'left-[26px]' : 'left-0.5'}`}
      />
    </button>
  );
}

function Row({
  label,
  sublabel,
  right,
  onClick,
}: {
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick && !right}
      className="w-full flex items-center justify-between py-3.5 disabled:cursor-default"
    >
      <div className="text-left">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      {right ?? (onClick && <ChevronRight className="w-4 h-4 text-gray-300" />)}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl px-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-4 pb-1">{title}</p>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();
  const { dbUser, logout } = useAuth();

  const [prefs, setPrefs] = useState<Partial<UserPreference>>({
    showAge: true,
    showDistance: true,
    showLastActive: true,
    emailNotifications: true,
    pushNotifications: true,
    matchNotifications: true,
    messageNotifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ preferences: UserPreference | null }>('/users/preferences')
      .then((d) => { if (d.preferences) setPrefs(d.preferences); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = async (patch: Partial<UserPreference>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      await api.put('/users/preferences', patch);
    } catch {
      toast.error('Failed to save setting');
      setPrefs(prefs); // rollback
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDeleteAccount = () => {
    toast.error('Account deletion — contact support to proceed.');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 text-lg">Settings</h1>
          {saving && (
            <div className="ml-auto w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center pt-20">
          <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">

          {/* Account */}
          <Section title="Account">
            <Row
              label="Edit Profile"
              sublabel={dbUser ? `${dbUser.firstName} ${dbUser.lastName}` : ''}
              onClick={() => navigate('/profile')}
            />
            <Row label="Email" sublabel={dbUser?.email} />
          </Section>

          {/* Privacy */}
          <Section title="Privacy">
            <Row
              label="Show my age"
              sublabel="Let others see how old you are"
              right={<Toggle value={!!prefs.showAge} onChange={(v) => update({ showAge: v })} />}
            />
            <Row
              label="Show distance"
              sublabel="Let others see how far away you are"
              right={<Toggle value={!!prefs.showDistance} onChange={(v) => update({ showDistance: v })} />}
            />
            <Row
              label="Show last active"
              sublabel="Let matches see when you were last online"
              right={<Toggle value={!!prefs.showLastActive} onChange={(v) => update({ showLastActive: v })} />}
            />
          </Section>

          {/* Notifications */}
          <Section title="Notifications">
            <Row
              label="Push notifications"
              sublabel="Alerts on your device"
              right={<Toggle value={!!prefs.pushNotifications} onChange={(v) => update({ pushNotifications: v })} />}
            />
            <Row
              label="New matches"
              sublabel="When someone likes you back"
              right={<Toggle value={!!prefs.matchNotifications} onChange={(v) => update({ matchNotifications: v })} />}
            />
            <Row
              label="New messages"
              sublabel="When a match sends you a message"
              right={<Toggle value={!!prefs.messageNotifications} onChange={(v) => update({ messageNotifications: v })} />}
            />
            <Row
              label="Email digests"
              sublabel="Weekly summary emails"
              right={<Toggle value={!!prefs.emailNotifications} onChange={(v) => update({ emailNotifications: v })} />}
            />
          </Section>

          {/* Discovery */}
          <Section title="Discovery">
            <Row
              label="Preferences & filters"
              sublabel="Age range, distance, gender"
              onClick={() => navigate('/profile')}
            />
          </Section>

          {/* Support */}
          <Section title="Support">
            <Row label="Help & FAQ" onClick={() => {}} />
            <Row label="Report a problem" onClick={() => {}} />
            <Row label="Terms of Service" onClick={() => {}} />
            <Row label="Privacy Policy" onClick={() => {}} />
          </Section>

          {/* Danger zone */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white shadow-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
            <button
              onClick={handleDeleteAccount}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-red-500 font-medium hover:bg-red-50 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete account
            </button>
          </div>

          <p className="text-center text-xs text-gray-300 pb-4">CheckMate v0.1.0</p>
        </div>
      )}
    </div>
  );
}
