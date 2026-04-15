import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { User } from '../types';

// ── Data ──────────────────────────────────────────────────────────────────────

const GENDERS = [
  { value: 'MALE', label: 'Man' },
  { value: 'FEMALE', label: 'Woman' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Prefer not to say' },
];

const LOOKING_FOR = [
  { value: 'RELATIONSHIP', label: 'A relationship', sub: 'Long-term commitment' },
  { value: 'CASUAL', label: 'Casual dating', sub: 'No strings attached' },
  { value: 'FRIENDSHIP', label: 'New friends', sub: 'Keep it platonic' },
  { value: 'NETWORKING', label: 'Networking', sub: 'Professional connections' },
];

const INTERESTS = [
  'Travel', 'Music', 'Fitness', 'Cooking', 'Photography', 'Art', 'Reading',
  'Gaming', 'Hiking', 'Movies', 'Dancing', 'Yoga', 'Coffee', 'Wine',
  'Dogs', 'Cats', 'Surfing', 'Cycling', 'Running', 'Tech', 'Fashion',
  'Food', 'Sports', 'Meditation', 'DIY', 'Languages', 'Volunteering',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  location: string;
  occupation: string;
  bio: string;
  interests: string[];
  lookingFor: string;
}

const INITIAL: FormData = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '',
  location: '', occupation: '', bio: '', interests: [], lookingFor: '',
};

// ── Animation variants ────────────────────────────────────────────────────────

// Container — fades out as a whole on exit
const stepContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.11, delayChildren: 0.05 } },
  exit:    { opacity: 0, y: -18, transition: { duration: 0.25, ease: 'easeIn' } },
};

// Each child element staggers in from below
const itemFade = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// ── Shared UI pieces ──────────────────────────────────────────────────────────

function Question({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2 variants={itemFade} className="text-3xl md:text-4xl font-bold text-white leading-tight mb-8">
      {children}
    </motion.h2>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <motion.p variants={itemFade} className="text-white/50 text-sm mb-6 -mt-5">
      {children}
    </motion.p>
  );
}

function NextBtn({ onClick, label = 'Continue', disabled = false }:
  { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <motion.button
      variants={itemFade}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className="mt-8 flex items-center gap-2 px-8 py-4 rounded-2xl bg-pink-600 hover:bg-pink-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors shadow-xl shadow-pink-600/30"
    >
      {label} <ArrowRight className="w-4 h-4" />
    </motion.button>
  );
}

function SkipBtn({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      variants={itemFade}
      onClick={onClick}
      className="mt-4 text-white/30 hover:text-white/60 text-sm transition-colors"
    >
      Skip for now
    </motion.button>
  );
}

function LineInput({ value, onChange, placeholder, onEnter, type = 'text', autoFocus = true }:
  { value: string; onChange: (v: string) => void; placeholder: string; onEnter?: () => void; type?: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 300); }, [autoFocus]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); }
  };

  return (
    <motion.div variants={itemFade} className="border-b-2 border-white/20 focus-within:border-pink-400 transition-colors pb-2">
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="w-full bg-transparent text-white text-2xl font-light placeholder-white/20 outline-none caret-pink-400"
      />
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const { firebaseUser, completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const TOTAL_STEPS = 9;
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const set = (key: keyof FormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const next = () => setStep((s) => s + 1);

  const advance = (check: () => boolean, msg?: string) => {
    if (!check()) { if (msg) toast.error(msg); return; }
    next();
  };

  // `lookingFor` is passed directly because setState is async —
  // reading form.lookingFor inside submit would see the stale value.
  const submit = async (lookingFor: string) => {
    if (!firebaseUser) return;
    if (form.interests.length < 3) { toast.error('Pick at least 3 interests'); return; }

    setSubmitting(true);
    try {
      const { user } = await api.post<{ user: User }>('/auth/register', {
        userData: {
          email: firebaseUser.email,
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          location: form.location,
          occupation: form.occupation || undefined,
          bio: form.bio || undefined,
          lookingFor,
          interests: form.interests,
          profilePictures: [],
          ageRangeMin: 18,
          ageRangeMax: 99,
          maxDistance: 50,
        },
      });
      completeOnboarding(user);
      navigate('/discover');
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const steps: React.ReactNode[] = [

    // 0 — First name
    <StepWrap key="fn">
      <Question>What's your first name?</Question>
      <LineInput
        value={form.firstName}
        onChange={set('firstName')}
        placeholder="First name"
        onEnter={() => advance(() => form.firstName.trim().length > 0, 'First name is required')}
      />
      <NextBtn
        onClick={() => advance(() => form.firstName.trim().length > 0, 'First name is required')}
        disabled={!form.firstName.trim()}
      />
    </StepWrap>,

    // 1 — Last name
    <StepWrap key="ln">
      <Question>Nice to meet you, {form.firstName}!<br />What's your last name?</Question>
      <LineInput
        value={form.lastName}
        onChange={set('lastName')}
        placeholder="Last name"
        onEnter={() => advance(() => form.lastName.trim().length > 0, 'Last name is required')}
      />
      <NextBtn
        onClick={() => advance(() => form.lastName.trim().length > 0, 'Last name is required')}
        disabled={!form.lastName.trim()}
      />
    </StepWrap>,

    // 2 — Date of birth
    <StepWrap key="dob">
      <Question>When were you born?</Question>
      <Sub>You must be 18 or older to join.</Sub>
      <LineInput
        value={form.dateOfBirth}
        onChange={set('dateOfBirth')}
        placeholder="YYYY-MM-DD"
        type="date"
        onEnter={() => advance(() => {
          if (!form.dateOfBirth) return false;
          const age = (Date.now() - new Date(form.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          return age >= 18;
        }, 'You must be 18 or older')}
      />
      <NextBtn
        onClick={() => advance(() => {
          if (!form.dateOfBirth) return false;
          const age = (Date.now() - new Date(form.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          return age >= 18;
        }, 'You must be 18 or older')}
        disabled={!form.dateOfBirth}
      />
    </StepWrap>,

    // 3 — Gender
    <StepWrap key="gender">
      <Question>How do you identify?</Question>
      <motion.div variants={itemFade} className="grid grid-cols-2 gap-3">
        {GENDERS.map((g) => (
          <button
            key={g.value}
            onClick={() => { set('gender')(g.value); setTimeout(next, 220); }}
            className={`py-4 px-5 rounded-2xl text-left font-medium text-base transition-all border-2 ${
              form.gender === g.value
                ? 'border-pink-500 bg-pink-500/15 text-white'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
            }`}
          >
            {g.label}
          </button>
        ))}
      </motion.div>
    </StepWrap>,

    // 4 — Location
    <StepWrap key="loc">
      <Question>Where are you based?</Question>
      <Sub>We use this to find people near you.</Sub>
      <LineInput
        value={form.location}
        onChange={set('location')}
        placeholder="City, State"
        onEnter={() => advance(() => form.location.trim().length > 0, 'Location is required')}
      />
      <NextBtn
        onClick={() => advance(() => form.location.trim().length > 0, 'Location is required')}
        disabled={!form.location.trim()}
      />
    </StepWrap>,

    // 5 — Occupation
    <StepWrap key="occ">
      <Question>What do you do for work?</Question>
      <LineInput
        value={form.occupation}
        onChange={set('occupation')}
        placeholder="Your job title"
        onEnter={next}
      />
      <NextBtn onClick={next} label="Continue" />
      <SkipBtn onClick={next} />
    </StepWrap>,

    // 6 — Bio
    <StepWrap key="bio">
      <Question>Tell people a little about you.</Question>
      <Sub>Keep it real — a short line or two works great.</Sub>
      <motion.div variants={itemFade} className="border-b-2 border-white/20 focus-within:border-pink-400 transition-colors pb-2">
        <textarea
          value={form.bio}
          onChange={(e) => set('bio')(e.target.value)}
          placeholder="I'm someone who…"
          rows={3}
          maxLength={300}
          autoFocus
          className="w-full bg-transparent text-white text-xl font-light placeholder-white/20 outline-none resize-none caret-pink-400"
        />
      </motion.div>
      <motion.p variants={itemFade} className="text-white/20 text-xs mt-1 text-right">{form.bio.length}/300</motion.p>
      <NextBtn onClick={next} label="Continue" />
      <SkipBtn onClick={next} />
    </StepWrap>,

    // 7 — Interests
    <StepWrap key="interests">
      <Question>What are you into?</Question>
      <Sub>Pick at least 3 to help us match you better.</Sub>
      <motion.div variants={itemFade} className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1 pb-2">
        {INTERESTS.map((tag) => {
          const on = form.interests.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  interests: on
                    ? f.interests.filter((i) => i !== tag)
                    : [...f.interests, tag],
                }))
              }
              className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                on
                  ? 'border-pink-500 bg-pink-500 text-white'
                  : 'border-white/15 bg-white/5 text-white/60 hover:text-white hover:border-white/30'
              }`}
            >
              {on && <Check className="w-3 h-3" />}
              {tag}
            </button>
          );
        })}
      </motion.div>
      <NextBtn
        onClick={() => advance(() => form.interests.length >= 3, 'Pick at least 3 interests')}
        label={`Continue (${form.interests.length} selected)`}
        disabled={form.interests.length < 3}
      />
    </StepWrap>,

    // 8 — Looking for
    <StepWrap key="lf">
      <Question>What are you looking for?</Question>
      <motion.div variants={itemFade} className="space-y-3">
        {LOOKING_FOR.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { set('lookingFor')(opt.value); setTimeout(() => submit(opt.value), 260); }}
            disabled={submitting}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 text-left transition-all ${
              form.lookingFor === opt.value
                ? 'border-pink-500 bg-pink-500/15'
                : 'border-white/10 bg-white/5 hover:border-white/25'
            }`}
          >
            <div>
              <p className="font-semibold text-white">{opt.label}</p>
              <p className="text-white/40 text-sm">{opt.sub}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/30 flex-shrink-0" />
          </button>
        ))}
      </motion.div>
      {submitting && (
        <motion.div variants={itemFade} className="mt-6 flex items-center gap-3 text-white/50 text-sm">
          <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          Setting up your profile…
        </motion.div>
      )}
    </StepWrap>,
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Progress bar */}
      <div className="h-0.5 bg-white/10 fixed top-0 inset-x-0 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      {/* Step counter */}
      <div className="fixed top-4 right-5 text-white/25 text-xs tabular-nums z-50">
        {step + 1} / {TOTAL_STEPS}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {steps[step]}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={stepContainer}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex flex-col"
    >
      {children}
    </motion.div>
  );
}
