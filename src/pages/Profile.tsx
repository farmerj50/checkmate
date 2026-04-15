import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  Edit3, Settings, MapPin, Briefcase, GraduationCap,
  Heart, X, ChevronRight, Ruler, BadgeCheck,
  LogOut, ShieldCheck, Clock, Crown, Zap, Video, Trash2, Play, Star,
  Plus, Camera, Users, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';
import type { User } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import VideoRecorder from '../components/VideoRecorder';
import { calculateAge, normalizeAssetUrl } from '../utils/helpers';

const INTERESTS = [
  'Travel', 'Music', 'Fitness', 'Cooking', 'Photography', 'Art', 'Reading',
  'Gaming', 'Hiking', 'Movies', 'Dancing', 'Yoga', 'Coffee', 'Wine',
  'Dogs', 'Cats', 'Surfing', 'Cycling', 'Running', 'Tech', 'Fashion',
  'Food', 'Sports', 'Meditation', 'DIY', 'Languages', 'Volunteering',
];

const LOOKING_FOR_OPTIONS = {
  RELATIONSHIP: {
    title: 'Relationship',
    description: 'Looking for something serious',
    icon: <Heart className="w-4 h-4" />,
  },
  CASUAL: {
    title: 'Casual',
    description: 'Keep it fun and light',
    icon: <Zap className="w-4 h-4" />,
  },
  FRIENDSHIP: {
    title: 'Friendship',
    description: 'Meet people who want to hang out',
    icon: <Users className="w-4 h-4" />,
  },
  NETWORKING: {
    title: 'Networking',
    description: 'Connect with like-minded professionals',
    icon: <Sparkles className="w-4 h-4" />,
  },
} as const;

const INTEREST_ICONS: Record<string, string> = {
  Travel: '✈️',
  Music: '🎧',
  Fitness: '💪',
  Cooking: '🍳',
  Photography: '📸',
  Art: '🎨',
  Reading: '📚',
  Gaming: '🎮',
  Hiking: '🥾',
  Movies: '🎬',
  Dancing: '💃',
  Yoga: '🧘',
  Coffee: '☕',
  Wine: '🍷',
  Dogs: '🐶',
  Cats: '🐱',
  Surfing: '🏄',
  Cycling: '🚴',
  Running: '🏃',
  Tech: '💻',
  Fashion: '👗',
  Food: '🍕',
  Sports: '🏀',
  Meditation: '🧘‍♂️',
  DIY: '🔧',
  Languages: '🗣️',
  Volunteering: '🤝',
};

interface EditForm {
  firstName: string;
  lastName: string;
  bio: string;
  occupation: string;
  education: string;
  location: string;
  height: string;
  lookingFor: string;
  ageRangeMin: number;
  ageRangeMax: number;
  maxDistance: number;
}

// ── Video Manager ────────────────────────────────────────────────────────────
function VideoManager({
  videos,
  activeVideo,
  onUpload,
  onDelete,
  onSetActive,
  uploading,
  initialMode,
}: {
  videos: string[];
  activeVideo: string | undefined;
  onUpload: (file: File) => void;
  onDelete: (url: string) => void;
  onSetActive: (url: string) => void;
  uploading: boolean;
  initialMode?: 'record' | 'upload';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [mode, setMode] = useState<'record' | 'upload'>(initialMode ?? 'record');

  const handleRecordingComplete = (blob: Blob) => {
    // Convert blob to File
    const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
    onUpload(file);
  };

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="grid grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-[#0f172a]/70 p-1 shadow-inner shadow-black/30 backdrop-blur-xl">
        <button
          onClick={() => setMode('record')}
          className={`rounded-3xl py-3 text-sm font-semibold transition ${
            mode === 'record'
              ? 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white shadow-lg'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4 inline mr-2" />
          Record
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`rounded-3xl py-3 text-sm font-semibold transition ${
            mode === 'upload'
              ? 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white shadow-lg'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Upload
        </button>
      </div>

      {/* Record mode */}
      {mode === 'record' && (
        <div className="rounded-3xl border border-white/10 bg-[#0f172a]/80 p-4 shadow-2xl shadow-[#000000]/40 backdrop-blur-xl">
          <VideoRecorder
            onRecordingComplete={handleRecordingComplete}
            isUploading={uploading}
          />
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="rounded-3xl border border-dashed border-white/15 bg-[#0f172a]/80 p-4 shadow-inner shadow-black/30 backdrop-blur-xl">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-white/60">Uploading…</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-white/60" />
                <span className="text-sm text-white/80">Upload a new video</span>
              </>
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Video list */}
      {videos.length === 0 && (
        <p className="text-center text-white/40 text-sm py-6">
          {mode === 'record' ? 'Record your first video!' : 'No videos yet. Upload your first one!'}
        </p>
      )}

      {videos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/40 font-semibold">
            Your videos ({videos.length}/4 slots)
          </p>
          {videos.map((url, i) => {
            const isActive = url === activeVideo;
            return (
              <div
                key={url}
                className={`relative rounded-3xl overflow-hidden border-2 transition-all ${
                  isActive ? 'border-[#ff4d8d] shadow-[0_0_30px_rgba(255,77,141,0.24)]' : 'border-white/10'
                } bg-[#0f172a]/70`}
              >
                <div className="aspect-[9/16] max-h-48 bg-black relative group overflow-hidden">
                  <video
                    src={url}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    muted
                    playsInline
                    onClick={() => setPreviewing(url)}
                  />
                  {/* Play overlay */}
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 cursor-pointer"
                    onClick={() => setPreviewing(url)}
                  >
                    <div className="w-12 h-12 bg-white/10 rounded-full border border-white/20 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  {/* Active badge */}
                  {isActive && (
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-[#ff4d8d]/20">
                      FEED
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 text-white/60 text-xs bg-black/40 rounded-full px-2 py-1">
                    Video {i + 1}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 bg-[#111827] px-3 py-3">
                  {!isActive && (
                    <button
                      onClick={() => onSetActive(url)}
                      className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-[#ff4d8d]/10 transition"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Set active
                    </button>
                  )}
                  {isActive && (
                    <span className="flex items-center gap-1.5 rounded-full bg-[#ff4d8d]/10 px-3 py-2 text-xs text-[#ff4d8d] font-semibold">
                      <Star className="w-3.5 h-3.5 fill-[#ff4d8d]" />
                      Active
                    </span>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => onDelete(url)}
                    className="rounded-full p-2 text-white/60 hover:bg-red-500/20 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-screen preview modal */}
      <AnimatePresence>
        {previewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setPreviewing(null)}
          >
            <button
              className="absolute top-5 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
              onClick={() => setPreviewing(null)}
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <video
              src={previewing}
              className="max-h-[90vh] max-w-[90vw] rounded-3xl bg-black"
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────────
function EditSheet({
  user,
  initialMode,
  onClose,
  onSaved,
}: {
  user: User;
  initialMode?: 'record' | 'upload';
  onClose: () => void;
  onSaved: (updated: User) => void;
}) {
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user.interests);
  const [profileVideos, setProfileVideos] = useState<string[]>(
    (user.profileVideos ?? []).map(normalizeAssetUrl).filter(Boolean) as string[]
  );
  const [activeVideo, setActiveVideo] = useState<string | undefined>(
    normalizeAssetUrl(user.profileVideo)
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EditForm>({
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio ?? '',
      occupation: user.occupation ?? '',
      education: user.education ?? '',
      location: user.location,
      height: user.height ? String(user.height) : '',
      lookingFor: user.lookingFor,
      ageRangeMin: user.ageRangeMin,
      ageRangeMax: user.ageRangeMax,
      maxDistance: user.maxDistance,
    },
  });

  const toggleInterest = (interest: string) =>
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );

  const getAuthToken = async () =>
    localStorage.getItem('demo_token') ?? (await auth.currentUser?.getIdToken()) ?? '';

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('video', file);
      const token = await getAuthToken();
      const res = await fetch('/api/upload/video', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfileVideos(data.profileVideos.map(normalizeAssetUrl).filter(Boolean) as string[]);
      setActiveVideo((current) =>
        current || normalizeAssetUrl(data.profileVideo)
      );
      toast.success('Video uploaded');
    } catch (err: any) {
      toast.error(err.message ?? 'Video upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVideo = async (url: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/upload/video', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfileVideos(data.profileVideos.map(normalizeAssetUrl).filter(Boolean) as string[]);
      setActiveVideo(normalizeAssetUrl(data.profileVideo ?? undefined));
      toast.success('Video removed');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove video');
    }
  };

  const handleSetActive = async (url: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/upload/video/active', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveVideo(normalizeAssetUrl(data.profileVideo));
      toast.success('Active video updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update active video');
    }
  };

  const onSubmit = async (data: EditForm) => {
    setSaving(true);
    try {
      const res = await api.put<{ user: User }>('/users/profile', {
        userData: {
          ...data,
          height: data.height ? Number(data.height) : undefined,
          interests: selectedInterests,
          profileVideos,
          profileVideo: activeVideo ?? null,
          ageRangeMin: Number(data.ageRangeMin),
          ageRangeMax: Number(data.ageRangeMax),
          maxDistance: Number(data.maxDistance),
        },
      });
      toast.success('Profile saved');
      onSaved(res.user);
      onClose();
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const [initialVideoMode, setInitialVideoMode] = useState<'record' | 'upload'>(initialMode ?? 'record');

  useEffect(() => {
    setInitialVideoMode(initialMode ?? 'record');
  }, [initialMode]);

  const ageMin = watch('ageRangeMin');
  const ageMax = watch('ageRangeMax');
  const maxDist = watch('maxDistance');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        className="relative flex h-full w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-[2rem] bg-[#0f172a] shadow-2xl shadow-black/60 border border-white/10"
      >
        <div className="flex flex-col w-full">
          {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <button onClick={onClose} className="rounded-full p-2 bg-white/5 hover:bg-white/10 transition">
            <X className="w-6 h-6 text-white/70" />
          </button>
          <h2 className="font-bold text-white text-lg">Edit Profile</h2>
          <Button variant="primary" size="sm" onClick={handleSubmit(onSubmit)} isLoading={saving}>
            Save
          </Button>
        </div>

      {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7 pb-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Videos */}
        <section>
          <h3 className="font-semibold text-white mb-1">My Videos</h3>
          <p className="text-xs text-white/40 mb-3">
            Upload as many videos as you like. One is shown in the feed — tap "Set as active" to choose it.
          </p>
          <VideoManager
            videos={profileVideos}
            activeVideo={activeVideo}
            onUpload={handleVideoUpload}
            onDelete={handleDeleteVideo}
            onSetActive={handleSetActive}
            uploading={uploading}
            initialMode={initialVideoMode}
          />
        </section>

        {/* Basics */}
        <section className="space-y-4 rounded-3xl border border-white/10 bg-[#0f172a]/80 px-5 py-5 shadow-2xl shadow-[#000000]/40 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white text-lg">Basics</h3>
              <p className="text-sm text-white/40">Make your profile feel premium with a polished intro.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              error={errors.firstName?.message}
              {...register('firstName', { required: 'Required' })}
            />
            <Input
              label="Last name"
              error={errors.lastName?.message}
              {...register('lastName', { required: 'Required' })}
            />
          </div>
          <Input
            label="Location"
            icon={<MapPin className="w-4 h-4 text-white/60" />}
            {...register('location', { required: 'Required' })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Occupation"
              icon={<Briefcase className="w-4 h-4 text-white/60" />}
              {...register('occupation')}
            />
            <Input
              label="Education"
              icon={<GraduationCap className="w-4 h-4 text-white/60" />}
              {...register('education')}
            />
          </div>
          <Input
            label="Height (cm)"
            icon={<Ruler className="w-4 h-4 text-white/60" />}
            type="number"
            {...register('height')}
          />
        </section>

        {/* Bio */}
        <section>
          <h3 className="font-semibold text-white mb-2">About me</h3>
          <div className="relative">
            <textarea
              rows={4}
              maxLength={500}
              placeholder="Tell people a little about yourself..."
              className="w-full px-4 py-4 rounded-3xl border border-white/10 bg-[#0f172a] text-white focus:outline-none focus:border-[#ff4d8d] focus:ring-2 focus:ring-[#ff4d8d]/20 resize-none text-sm placeholder-white/30 shadow-inner shadow-black/20"
              {...register('bio')}
            />
            <div className="absolute right-4 bottom-4 text-xs text-white/40">
              {watch('bio')?.length ?? 0}/500
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-white/40">Make it real and memorable.</div>
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 hover:opacity-90 transition"
            >
              ✨ Help me write this
            </button>
          </div>
        </section>

        {/* Interests */}
        <section className="rounded-3xl border border-white/10 bg-[#0f172a]/70 p-4 shadow-inner shadow-black/20 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Interests</h3>
            <span className="text-xs text-white/40">{selectedInterests.length} selected</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {INTERESTS.map((interest) => {
              const selected = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`group flex items-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-all border ${
                    selected
                      ? 'border-transparent bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white shadow-lg shadow-[#ff4d8d]/20'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <span className="text-base">{INTEREST_ICONS[interest] ?? '✨'}</span>
                  <span>{interest}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Looking for */}
        <section className="rounded-3xl border border-white/10 bg-[#0f172a]/70 p-4 shadow-inner shadow-black/20 backdrop-blur-xl">
          <h3 className="font-semibold text-white mb-4">Looking for</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(LOOKING_FOR_OPTIONS).map(([value, option]) => (
              <label
                key={value}
                className={`group block rounded-3xl border p-4 transition-all cursor-pointer ${
                  watch('lookingFor') === value
                    ? 'border-transparent bg-gradient-to-br from-[#ff4d8d] to-[#8b5cf6] text-white shadow-xl'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <input type="radio" value={value} className="sr-only" {...register('lookingFor')} />
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80 group-hover:bg-white/20">
                    {option.icon}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{option.title}</div>
                    <div className="text-xs text-white/40">{option.description}</div>
                  </div>
                </div>
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
                  {watch('lookingFor') === value ? 'Selected' : 'Select'}
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Discovery preferences */}
        <section className="space-y-5">
          <h3 className="font-semibold text-white">Discovery</h3>

          <div>
            <div className="flex justify-between text-sm text-white/50 mb-2">
              <span>Age range</span>
              <span className="font-medium text-pink-400">{ageMin} – {ageMax}</span>
            </div>
            <div className="space-y-2">
              <input type="range" min={18} max={99} className="w-full accent-pink-500" {...register('ageRangeMin', { valueAsNumber: true })} />
              <input type="range" min={18} max={99} className="w-full accent-pink-500" {...register('ageRangeMax', { valueAsNumber: true })} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-white/50 mb-2">
              <span>Maximum distance</span>
              <span className="font-medium text-pink-400">{maxDist} km</span>
            </div>
            <input type="range" min={1} max={500} className="w-full accent-pink-500" {...register('maxDistance', { valueAsNumber: true })} />
          </div>
        </section>
      </div>
    </div>
    </motion.div>
  </motion.div>
  );
}

// ── Profile Page ──────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<'record' | 'upload'>('record');
  const [boosting, setBoosting] = useState(false);
  const [boostedUntil, setBoostedUntil] = useState<Date | null>(null);
  const [verifying, setVerifying] = useState(false);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ user: User }>('/users/profile')
      .then((d) => setUser(d.user))
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const videos = (user.profileVideos ?? []).map(normalizeAssetUrl).filter(Boolean) as string[];

  const handleVerificationPhoto = async (_file: File) => {
    setVerifying(true);
    try {
      const data = await api.post<{ isVerified: boolean }>('/safety/verify', {});
      if (data.isVerified) {
        toast.success('Profile verified!');
        setUser((u) => u ? { ...u, isVerified: true } : u);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] pb-24 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#8b5cf6]/10 rounded-full blur-3xl" />
        <div className="absolute top-10 left-10 w-44 h-44 bg-[#f472b6]/10 rounded-full blur-3xl" />
        <div className="absolute top-32 right-10 w-72 h-72 bg-[#38bdf8]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-56 h-56 bg-[#f9a8d4]/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2 relative z-10">
        <div>
          <h1 className="text-xl font-bold text-white">My Profile</h1>
          <p className="text-sm text-white/50 mt-1">Keep your profile feeling fresh with a modern video intro.</p>
        </div>
        <button onClick={() => navigate('/settings')} className="p-2 rounded-full hover:bg-white/10">
          <Settings className="w-5 h-5 text-white/60" />
        </button>
      </div>

      <div className="px-4 mx-auto max-w-6xl space-y-4 relative z-10">
        {/* Active video placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mx-auto w-full max-w-4xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#020617] shadow-2xl shadow-[#000000]/50 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1"
        >
          <div className="relative overflow-hidden rounded-[2rem] bg-[#020617]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff4d8d]/10 via-transparent to-[#8b5cf6]/10" />
            <div className="relative min-h-[280px] flex flex-col items-center justify-center gap-4 px-6 text-center py-16">
              <Video className="w-16 h-16 text-white/40" />
              <h2 className="text-xl font-semibold text-white">Your active video is hidden</h2>
              <p className="text-white/40 text-sm max-w-2xl">
                We no longer auto-play your stored profile clip. Open the video manager to record, upload, or choose which clip appears on your feed.
              </p>
              <button
                onClick={() => {
                  setEditTab('record');
                  setEditOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 hover:scale-[1.02] transition-transform"
              >
                <Camera className="w-4 h-4" />
                Record or manage videos
              </button>
            </div>
          </div>

          {/* Video count badge */}
          {videos.length > 1 && (
            <div className="absolute top-4 right-4 bg-black/70 text-white text-xs font-medium px-3 py-1 rounded-full backdrop-blur-xl flex items-center gap-1.5 border border-white/10">
              <Video className="w-3 h-3" />
              {videos.length} videos
            </div>
          )}

          {/* Premium badge */}
          {user.isPremium && (
            <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md shadow-orange-500/20">
              ✦ Premium
            </div>
          )}

          {/* Edit button */}
          <button
            onClick={() => setEditOpen(true)}
            className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl border border-white/10 transition-transform hover:-translate-y-0.5"
          >
            <Edit3 className="w-5 h-5 text-gray-700" />
          </button>

          {/* Manage videos CTA */}
          <button
            onClick={() => {
              setEditTab('record');
              setEditOpen(true);
            }}
            className="absolute bottom-4 left-4 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-white/90 text-xs font-semibold backdrop-blur-xl border border-white/10 hover:bg-white/15 transition"
          >
            <Video className="w-3.5 h-3.5" />
            Record / manage videos
          </button>
        </motion.div>

        <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#0f172a]/80 p-4 shadow-2xl shadow-[#000000]/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between lg:px-6 lg:py-5">
          <div>
            <p className="text-sm text-white/70">
              Want a fresh clip? Open the video manager to record a new video or upload a different one.
            </p>
          </div>
          <button
            onClick={() => {
              setEditTab('record');
              setEditOpen(true);
            }}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#8b5cf6]/20 hover:scale-[1.02] transition-transform"
          >
            <Camera className="w-4 h-4" />
            Record a new video
          </button>
        </div>

        {/* Info card */}
        <div className="bg-gray-900 rounded-3xl p-5 border border-white/5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">
                  {user.firstName} {user.lastName}
                </h2>
                <span className="text-white/40 text-xl">{calculateAge(user.dateOfBirth)}</span>
              </div>
              {user.isVerified && (
                <div className="flex items-center gap-1 mt-0.5">
                  <BadgeCheck className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400 font-medium">Verified</span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setEditTab('record');
                setEditOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/15 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          </div>

          <div className="space-y-2 text-sm text-white/50 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-white/30" />
              {user.location}
            </div>
            {user.occupation && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-white/30" />
                {user.occupation}
              </div>
            )}
            {user.education && (
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-white/30" />
                {user.education}
              </div>
            )}
            {user.height && (
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-white/30" />
                {user.height} cm
              </div>
            )}
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-white/30" />
              {LOOKING_FOR_OPTIONS[user.lookingFor].title}
            </div>
          </div>

          {user.bio && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white/60 mb-1">About</h3>
              <p className="text-white/70 text-sm leading-relaxed">{user.bio}</p>
            </div>
          )}

          {user.interests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/60 mb-2">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest) => (
                  <span
                    key={interest}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
                  >
                    <span>{INTEREST_ICONS[interest] ?? '✨'}</span>
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Verification */}
        {user.isVerified ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-5 flex items-center gap-3">
            <BadgeCheck className="w-8 h-8 text-blue-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-300">Profile Verified</p>
              <p className="text-xs text-blue-400/70">Your verification badge is visible to everyone.</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-3xl p-5 border border-white/5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white mb-0.5">Get verified</p>
                <p className="text-xs text-white/40 mb-3">Show others your profile is real. Takes 30 seconds.</p>
                <button
                  onClick={() => verifyInputRef.current?.click()}
                  disabled={verifying}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  {verifying ? (
                    <><Clock className="w-4 h-4 animate-spin" /> Verifying…</>
                  ) : (
                    <><Camera className="w-4 h-4" /> Take verification selfie</>
                  )}
                </button>
              </div>
            </div>
            <input
              ref={verifyInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVerificationPhoto(file);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* Discovery range */}
        <div className="bg-gray-900 rounded-3xl p-5 border border-white/5">
          <h3 className="font-semibold text-white/70 mb-3 text-sm">Discovery settings</h3>
          <div className="space-y-2 text-sm text-white/50">
            <div className="flex justify-between">
              <span>Age range</span>
              <span className="font-medium text-pink-400">{user.ageRangeMin} – {user.ageRangeMax}</span>
            </div>
            <div className="flex justify-between">
              <span>Max distance</span>
              <span className="font-medium text-pink-400">{user.maxDistance} km</span>
            </div>
          </div>
        </div>

        {/* Premium / Boost */}
        {user.isPremium ? (
          <div className="bg-gray-900 rounded-3xl p-5 border border-white/5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold text-white">Premium active</span>
            </div>

            {boostedUntil && boostedUntil > new Date() ? (
              <div className="flex items-center gap-2 text-sm text-pink-400 bg-pink-500/10 rounded-xl p-3">
                <Zap className="w-4 h-4 flex-shrink-0" />
                <span>
                  Boost active until{' '}
                  {boostedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : (
              <button
                disabled={boosting}
                onClick={async () => {
                  setBoosting(true);
                  try {
                    const data = await api.post<{ boostedUntil: string }>('/premium/boost', {});
                    setBoostedUntil(new Date(data.boostedUntil));
                    toast.success('Profile boosted for 30 minutes!');
                  } catch (err: any) {
                    toast.error(err.message ?? 'Could not activate boost');
                  } finally {
                    setBoosting(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold text-sm shadow-md shadow-pink-500/25 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {boosting ? <Clock className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Boost my profile
              </button>
            )}

            <button
              onClick={() => navigate('/premium')}
              className="w-full text-sm text-white/30 hover:text-white/60 transition-colors py-1"
            >
              Manage subscription
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/premium')}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-pink-500 to-rose-600 rounded-3xl text-white shadow-lg shadow-pink-500/25 hover:shadow-xl active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-yellow-300" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Upgrade to Premium</p>
                <p className="text-white/70 text-xs">Unlimited likes, boosts &amp; more</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60" />
          </button>
        )}

        {/* Logout */}
        <button
          onClick={async () => { await logout(); navigate('/login'); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-red-400 font-medium hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Edit sheet */}
      <AnimatePresence>
        {editOpen && (
          <EditSheet
            user={user}
            initialMode={editTab}
            onClose={() => setEditOpen(false)}
            onSaved={(updated) => setUser(updated)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
