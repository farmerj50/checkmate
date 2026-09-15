import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, X, Camera, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import VideoRecorder from '../components/VideoRecorder';
import { socialService } from '../services/social';

type Step = 'pick' | 'preview';
type Mode = 'record' | 'upload';
type PublishPhase = 'idle' | 'uploading' | 'publishing';

/** XHR (not fetch) specifically so we get real upload progress events. */
function uploadVideo(file: File, token: string, onProgress: (pct: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/post-media');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: any = {};
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch { /* fall through */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data);
      else reject(new Error(data.error ?? 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    const formData = new FormData();
    formData.append('media', file);
    xhr.send(formData);
  });
}

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
  const [caption, setCaption]       = useState(promptContext ? `Responding to: "${promptContext}" — ` : '');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [publishPhase, setPublishPhase] = useState<PublishPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast.error('Please choose a video file.');
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep('preview');
  }

  function handleRecordingComplete(blob: Blob) {
    const f = new File([blob], `post-${Date.now()}.webm`, { type: 'video/webm' });
    setFile(f);
    setPreviewUrl(URL.createObjectURL(blob));
    setStep('preview');
  }

  function resetToPickStep() {
    if (publishPhase !== 'idle') return; // don't let the video get pulled out from under an in-flight upload
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
    if (!file || publishPhase !== 'idle') return;
    setPublishPhase('uploading');
    setUploadProgress(0);
    try {
      // Upload stays on the existing, stable multer endpoint — that's not part
      // of the social contract Codex is reconciling, so it isn't mocked here.
      const token = localStorage.getItem('demo_token') ?? (await auth.currentUser?.getIdToken()) ?? '';
      const { url } = await uploadVideo(file, token, setUploadProgress);
      setPublishPhase('publishing');
      await socialService.createPost({ videoUrl: url, caption: caption.trim() || undefined });
      toast.success('Post published!');
      navigate('/home');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to publish');
      setPublishPhase('idle');
    }
  }

  const isPublishing = publishPhase !== 'idle';
  const publishLabel =
    publishPhase === 'uploading' ? `Uploading video… ${uploadProgress}%`
    : publishPhase === 'publishing' ? 'Publishing…'
    : 'Share Post';

  return (
    <div className="min-h-screen bg-[#050508]">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#050508]/95 backdrop-blur-xl border-b border-white/6 flex items-center justify-between px-4 py-3">
        <button
          onClick={() => step === 'preview' ? resetToPickStep() : navigate(-1)}
          disabled={isPublishing}
          className="p-2 rounded-full bg-white/8 text-white/70 active:bg-white/15 disabled:opacity-40 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white font-semibold text-base">New Post</h1>
        {step === 'preview' ? (
          <button
            onClick={publish}
            disabled={!file || isPublishing}
            className="w-16 flex items-center justify-center px-4 py-1.5 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-bold disabled:opacity-60 transition"
          >
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* ── Content — centered, width tuned so desktop doesn't feel like a
          sliver floating in empty space; a visible container reinforces that
          without changing the mobile layout (card chrome only from sm: up) ── */}
      <div className="max-w-[600px] mx-auto px-4 py-6 sm:py-10">
        <div className="sm:bg-white/[0.03] sm:border sm:border-white/8 sm:rounded-3xl sm:p-8">
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

              {/* Upload mode — video only, per the video-first v0.1 contract */}
              {mode === 'upload' && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed border-white/12 rounded-2xl bg-white/3 hover:bg-white/5 hover:border-white/20 active:scale-[0.98] transition-all"
                  >
                    <Camera className="w-9 h-9 text-white opacity-35" />
                    <div className="text-center">
                      <p className="text-white/60 text-sm font-medium">Tap to choose</p>
                      <p className="text-white/30 text-xs mt-1">Video from your library</p>
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
                <video src={previewUrl} className="w-full h-full object-contain" muted loop autoPlay playsInline />
                <button
                  onClick={resetToPickStep}
                  disabled={isPublishing}
                  className="absolute top-4 right-4 w-9 h-9 bg-black/75 backdrop-blur-md rounded-full flex items-center justify-center disabled:opacity-40 transition"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
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
                  placeholder="Add a caption (optional)"
                  rows={3}
                  disabled={isPublishing}
                  className="w-full bg-transparent px-4 py-3 text-white text-sm placeholder-white/25 resize-none focus:outline-none disabled:opacity-60"
                />
                <div className="flex items-center justify-between px-3 pb-3">
                  <button
                    onClick={suggestCaptions}
                    disabled={aiLoading || isPublishing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff4d8d]/10 border border-[#ff4d8d]/20 text-xs font-semibold text-[#ff4d8d] hover:bg-[#ff4d8d]/15 disabled:opacity-50 transition"
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
                        disabled={isPublishing}
                        className={`w-full text-left text-sm px-4 py-3 rounded-2xl border transition disabled:opacity-50 ${
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

              {/* Publish button — carries all upload/publish state feedback
                  in place, no separate full-screen takeover, and can't be
                  double-tapped since it's disabled for the entire duration. */}
              <button
                onClick={publish}
                disabled={!file || isPublishing}
                className="w-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-[#ff4d8d]/20 disabled:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
                {publishLabel}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
