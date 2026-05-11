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

  const [step, setStep]             = useState<Step>('pick');
  const [mode, setMode]             = useState<Mode>('record');
  const [file, setFile]             = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType]   = useState<'VIDEO' | 'IMAGE'>('VIDEO');
  const [caption, setCaption]       = useState(promptContext ? `Responding to: "${promptContext}" — ` : '');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setMediaType(f.type.startsWith('video/') ? 'VIDEO' : 'IMAGE');
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
    <div className="min-h-screen bg-[#050508]">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#050508]/95 backdrop-blur-xl border-b border-white/6 flex items-center justify-between px-4 py-3">
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

      {/* ── Content — centered, max-width constrained ── */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Pick media ── */}
          {step === 'pick' && (
            <motion.div
              key="pick"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Mode toggle */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/6">
                {(['record', 'upload'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      mode === m
                        ? 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white shadow-lg shadow-pink-600/20'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    {m === 'record' ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    {m === 'record' ? 'Record' : 'Upload'}
                  </button>
                ))}
              </div>

              {/* Prompt context badge */}
              {promptContext && (
                <div className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4d8d]/10 to-[#8b5cf6]/10 border border-white/10">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Responding to prompt</p>
                  <p className="text-white/70 text-xs italic">"{promptContext}"</p>
                </div>
              )}

              {/* Record mode — constrained VideoRecorder */}
              {mode === 'record' && (
                <div className="rounded-2xl overflow-hidden border border-white/8 bg-[#0a0a0f]">
                  <VideoRecorder onRecordingComplete={handleRecordingComplete} isUploading={false} />
                </div>
              )}

              {/* Upload mode */}
              {mode === 'upload' && (
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
                    className="w-full flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed border-white/12 rounded-2xl bg-white/3 hover:bg-white/5 hover:border-white/20 active:scale-[0.98] transition-all"
                  >
                    <div className="flex gap-5 opacity-35">
                      <Video className="w-9 h-9 text-white" />
                      <ImageIcon className="w-9 h-9 text-white" />
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
              className="space-y-4"
            >
              {/* Media preview — 9:16 card */}
              <div className="relative rounded-2xl overflow-hidden bg-black border border-white/8" style={{ aspectRatio: '9/16', maxHeight: '52vh' }}>
                {mediaType === 'VIDEO' ? (
                  <video src={previewUrl} className="w-full h-full object-contain" muted loop autoPlay playsInline />
                ) : (
                  <img src={previewUrl} alt="" className="w-full h-full object-contain" />
                )}
                <button
                  onClick={resetToPickStep}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                  <span className="text-white/70 text-xs font-medium">
                    {mediaType === 'VIDEO' ? '🎥 Video' : '🖼 Photo'}
                  </span>
                </div>
              </div>

              {/* Prompt context */}
              {promptContext && (
                <div className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4d8d]/10 to-[#8b5cf6]/10 border border-white/10">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Responding to prompt</p>
                  <p className="text-white/70 text-xs italic">"{promptContext}"</p>
                </div>
              )}

              {/* Caption */}
              <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                  placeholder="Write a caption…"
                  rows={3}
                  className="w-full bg-transparent px-4 py-3 text-white text-sm placeholder-white/25 resize-none focus:outline-none"
                />
                <div className="flex items-center justify-between px-4 pb-3">
                  <button
                    onClick={suggestCaptions}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 text-sm text-[#ff4d8d]/80 hover:text-[#ff4d8d] disabled:opacity-50 transition"
                  >
                    {aiLoading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Sparkles className="w-3.5 h-3.5" />
                    }
                    AI caption
                  </button>
                  <span className="text-white/25 text-xs">{caption.length}/500</span>
                </div>
              </div>

              {/* AI suggestions */}
              <AnimatePresence>
                {aiSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-white/35 text-xs px-1 font-medium">Tap a suggestion to use it</p>
                    {aiSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setCaption(s)}
                        className={`w-full text-left text-sm px-4 py-3 rounded-2xl border transition ${
                          caption === s
                            ? 'border-[#ff4d8d]/50 bg-[#ff4d8d]/8 text-white'
                            : 'border-white/8 bg-white/4 text-white/60 hover:bg-white/8'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Publish button */}
              <button
                onClick={publish}
                disabled={!file || publishing}
                className="w-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-[#ff4d8d]/20 disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                Share Post
              </button>
            </motion.div>
          )}

          {/* ── Step 3: Publishing ── */}
          {step === 'publishing' && (
            <motion.div
              key="publishing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-5 py-24"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ff4d8d]/20 to-[#8b5cf6]/20 flex items-center justify-center ring-1 ring-[#ff4d8d]/20">
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
    </div>
  );
}
