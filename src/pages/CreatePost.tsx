import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Video, ImageIcon, Sparkles, Loader2, X, Camera, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import VideoRecorder from '../components/VideoRecorder';

type Step = 'pick' | 'preview' | 'publishing';
type Mode = 'record' | 'upload';

export default function CreatePost() {
  const navigate = useNavigate();
  const location = useLocation();
  const promptContext = (location.state as { prompt?: string } | null)?.prompt;
  const { dbUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]       = useState<Step>('pick');
  const [mode, setMode]       = useState<Mode>('record');
  const [file, setFile]       = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType]   = useState<'VIDEO' | 'IMAGE'>('VIDEO');
  const [caption, setCaption]       = useState(promptContext ? `Responding to: "${promptContext}" — ` : '');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith('video/');
    setFile(f);
    setMediaType(isVideo ? 'VIDEO' : 'IMAGE');
    setPreviewUrl(URL.createObjectURL(f));
    setStep('preview');
  }

  function handleRecordingComplete(blob: Blob) {
    const f = new File([blob], `post-${Date.now()}.webm`, { type: 'video/webm' });
    setFile(f);
    setMediaType('VIDEO');
    setPreviewUrl(URL.createObjectURL(blob));
    setStep('preview');
  }

  function resetToPickStep() {
    setStep('pick');
    setPreviewUrl(null);
    setFile(null);
    setAiSuggestions([]);
  }

  async function suggestCaptions() {
    if (!dbUser) return;
    setAiLoading(true);
    try {
      const { captions } = await api.post<{ captions: string[] }>('/ai/caption', {
        firstName: dbUser.firstName,
        bio: dbUser.bio,
        interests: dbUser.interests,
      });
      setAiSuggestions(captions);
    } catch {
      toast.error('Could not get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  }

  async function publish() {
    if (!file || publishing) return;
    setPublishing(true);
    setStep('publishing');
    try {
      const token = localStorage.getItem('demo_token') ?? (await auth.currentUser?.getIdToken()) ?? '';
      const formData = new FormData();
      formData.append('media', file);
      const uploadRes = await fetch('/api/upload/post-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const { url, error: uploadError } = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadError ?? 'Upload failed');

      await api.post('/social/posts', { mediaUrl: url, mediaType, caption: caption.trim() || undefined });
      toast.success('Post published!');
      navigate('/home');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to publish');
      setStep('preview');
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050508] flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-none">
        <button
          onClick={() => step === 'preview' ? resetToPickStep() : navigate(-1)}
          className="p-2 rounded-full bg-white/8 text-white/70 active:bg-white/15 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white font-semibold text-base">New Post</h1>
        {step === 'preview' ? (
          <button
            onClick={publish}
            disabled={!file || publishing}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-bold disabled:opacity-40 transition"
          >
            Post
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Pick media ── */}
        {step === 'pick' && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col px-4 pt-5 pb-6"
          >
            {/* Mode toggle */}
            <div className="flex gap-2 mb-5 p-1 bg-white/5 rounded-2xl">
              {(['record', 'upload'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                    mode === m
                      ? 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white shadow'
                      : 'text-white/40'
                  }`}
                >
                  {m === 'record' ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  {m === 'record' ? 'Record' : 'Upload'}
                </button>
              ))}
            </div>

            {mode === 'record' ? (
              <VideoRecorder onRecordingComplete={handleRecordingComplete} isUploading={false} />
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*,image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/15 rounded-3xl bg-white/3 active:bg-white/6 transition min-h-[280px]"
                >
                  <div className="flex gap-5 opacity-40">
                    <Video className="w-10 h-10 text-white" />
                    <ImageIcon className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white/60 text-sm font-medium">Tap to choose</p>
                    <p className="text-white/30 text-xs mt-1">Video or photo from your library</p>
                  </div>
                  <div className="px-5 py-2 rounded-full bg-white/8 border border-white/10 text-white/50 text-xs font-semibold">
                    Browse files
                  </div>
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* ── Step 2: Preview + caption ── */}
        {step === 'preview' && previewUrl && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Media preview */}
            <div className="relative bg-black flex items-center justify-center flex-none" style={{ height: '44vh' }}>
              {mediaType === 'VIDEO' ? (
                <video
                  src={previewUrl}
                  className="h-full w-full object-contain"
                  muted loop autoPlay playsInline
                />
              ) : (
                <img src={previewUrl} alt="" className="h-full w-full object-contain" />
              )}
              <button
                onClick={resetToPickStep}
                className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                <span className="text-white/70 text-xs font-medium">
                  {mediaType === 'VIDEO' ? '🎥 Video' : '🖼 Photo'}
                </span>
              </div>
            </div>

            {/* Caption + AI */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-3">
              {promptContext && (
                <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#ff4d8d]/10 to-[#8b5cf6]/10 border border-white/10">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Responding to prompt</p>
                  <p className="text-white/70 text-xs italic">"{promptContext}"</p>
                </div>
              )}

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                placeholder="Write a caption…"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-white/25 resize-none focus:outline-none focus:border-[#ff4d8d]/50 transition"
              />

              <div className="flex items-center justify-between">
                <button
                  onClick={suggestCaptions}
                  disabled={aiLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#ff4d8d]/10 to-[#8b5cf6]/10 border border-[#ff4d8d]/20 rounded-2xl text-sm text-white/70 disabled:opacity-50 transition"
                >
                  {aiLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-[#ff4d8d]" />
                    : <Sparkles className="w-4 h-4 text-[#ff4d8d]" />
                  }
                  AI caption
                </button>
                <span className="text-white/25 text-xs">{caption.length}/500</span>
              </div>

              <AnimatePresence>
                {aiSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    {aiSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setCaption(s)}
                        className={`w-full text-left text-sm px-4 py-3 rounded-2xl border transition ${
                          caption === s
                            ? 'border-[#ff4d8d]/60 bg-[#ff4d8d]/10 text-white'
                            : 'border-white/8 bg-white/4 text-white/65 active:bg-white/8'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sticky publish button */}
            <div className="px-4 py-4 flex-none border-t border-white/5">
              <button
                onClick={publish}
                disabled={!file || publishing}
                className="w-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-[#ff4d8d]/20 disabled:opacity-50 transition active:scale-[0.98]"
              >
                Share Post
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Publishing ── */}
        {step === 'publishing' && (
          <motion.div
            key="publishing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-5"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ff4d8d]/20 to-[#8b5cf6]/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#ff4d8d] animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">Publishing…</p>
              <p className="text-white/40 text-sm">Uploading your {mediaType === 'VIDEO' ? 'video' : 'photo'}</p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
