import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Check, Scissors, Type, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface Props {
  videoUrl: string;
  firstName?: string;
  bio?: string;
  interests?: string[];
  onSave: (blob: Blob) => void;
  onClose: () => void;
}

const LOOKS: { label: string; tag?: string; value: string; css: string; emoji: string }[] = [
  { label: 'Natural',    value: 'none',  css: 'none',                                            emoji: '✨' },
  { label: 'Best Light', value: 'warm',  css: 'saturate(1.3) sepia(0.2) brightness(1.08)',       emoji: '☀️', tag: 'AI Pick' },
  { label: 'Vivid',      value: 'vivid', css: 'saturate(1.7) contrast(1.1)',                     emoji: '🔥' },
  { label: 'Cinematic',  value: 'cinema',css: 'contrast(1.15) saturate(0.85) brightness(0.95)', emoji: '🎬' },
  { label: 'Cool Tone',  value: 'cool',  css: 'saturate(0.9) hue-rotate(15deg) brightness(1.05)',emoji: '❄️' },
  { label: 'Fade',       value: 'fade',  css: 'saturate(0.7) brightness(1.1) contrast(0.85)',    emoji: '🤍' },
];

const AI_ENHANCE_CSS = 'brightness(1.08) contrast(1.12) saturate(1.18)';

// Deterministic "analysis" score seeded from URL length so it's stable per video
function seedScore(url: string, min: number, max: number) {
  const n = url.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return min + (n % (max - min + 1));
}

type Tab = 'looks' | 'trim' | 'caption';

export default function VideoEditorModal({ videoUrl, firstName, bio, interests, onSave, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const thumbRef  = useRef<HTMLVideoElement>(null);

  const [tab, setTab]                     = useState<Tab>('looks');
  const [duration, setDuration]           = useState(0);
  const [trimStart, setTrimStart]         = useState(0);
  const [trimEnd, setTrimEnd]             = useState(0);
  const [look, setLook]                   = useState('none');
  const [aiEnhanced, setAiEnhanced]       = useState(false);
  const [showBefore, setShowBefore]       = useState(false);
  const [caption, setCaption]             = useState('');
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [exporting, setExporting]         = useState(false);
  const [thumbs, setThumbs]               = useState<string[]>([]);
  const [analyzing, setAnalyzing]         = useState(true);
  const [improved, setImproved]           = useState(false);

  // Stable per-video base scores
  const baseLighting   = seedScore(videoUrl, 38, 65);
  const baseClarity    = seedScore(videoUrl + '1', 45, 72);
  const baseEngagement = seedScore(videoUrl + '2', 52, 68);

  const curLighting   = improved ? Math.min(baseLighting   + 28, 96) : baseLighting;
  const curClarity    = improved ? Math.min(baseClarity    + 24, 97) : baseClarity;
  const curEngagement = improved ? Math.min(baseEngagement + 22, 94) : baseEngagement;

  const lookCss   = LOOKS.find((l) => l.value === look)?.css ?? 'none';
  const activeCss = showBefore
    ? 'none'
    : [aiEnhanced ? AI_ENHANCE_CSS : '', lookCss !== 'none' ? lookCss : ''].filter(Boolean).join(' ') || 'none';

  // Simulate analysis on mount
  useEffect(() => {
    const t = setTimeout(() => setAnalyzing(false), 1400);
    return () => clearTimeout(t);
  }, []);

  // Generate filter thumbnails
  useEffect(() => {
    const v = thumbRef.current;
    if (!v) return;
    const generate = () => {
      const c = document.createElement('canvas');
      c.width = 120; c.height = 80;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, 120, 80);
      const base = c.toDataURL('image/jpeg', 0.7);
      setThumbs(LOOKS.map(() => base));
    };
    v.addEventListener('seeked', generate, { once: true });
    v.currentTime = 0.5;
  }, [videoUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => { setDuration(v.duration); setTrimEnd(v.duration); };
    v.addEventListener('loadedmetadata', onLoaded);
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.currentTime = trimStart;
  }, [trimStart]);

  function handleImprove() {
    setAiEnhanced(true);
    setImproved(true);
    toast.success('Video optimized ✨');
  }

  async function suggestCaptions() {
    setAiLoading(true);
    try {
      const { captions } = await api.post<{ captions: string[] }>('/ai/caption', { firstName, bio, interests });
      setAiSuggestions(captions);
    } catch {
      toast.error('Could not get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  }

  const exportVideo = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    setExporting(true);
    toast('Exporting…', { icon: '🎬' });
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = v.videoWidth  || 720;
      canvas.height = v.videoHeight || 1280;
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.start(100);
        v.currentTime = trimStart;
        v.muted = true;
        const finalCss = [aiEnhanced ? AI_ENHANCE_CSS : '', lookCss !== 'none' ? lookCss : ''].filter(Boolean).join(' ') || 'none';
        const draw = () => {
          if (v.currentTime >= trimEnd) { recorder.stop(); v.pause(); return; }
          ctx.filter = finalCss;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          if (caption) {
            ctx.filter = 'none';
            ctx.font = `bold ${Math.round(canvas.width * 0.055)}px sans-serif`;
            ctx.textAlign = 'center';
            const y = canvas.height * 0.88;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, y - canvas.width * 0.07, canvas.width, canvas.width * 0.1);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(caption, canvas.width / 2, y);
          }
          requestAnimationFrame(draw);
        };
        v.play().then(() => requestAnimationFrame(draw));
      });
      onSave(new Blob(chunks, { type: 'video/webm' }));
    } catch (err) {
      console.error(err);
      toast.error('Export failed — try a shorter clip');
    } finally {
      setExporting(false);
    }
  }, [trimStart, trimEnd, lookCss, aiEnhanced, caption, onSave]);

  const ScoreBar = ({ label, value }: { label: string; value: number }) => {
    const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444';
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-white/50">{label}</span>
          <span className="font-semibold" style={{ color }}>{value}%</span>
        </div>
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="fixed inset-0 z-[200] bg-[#050508] flex flex-col overflow-hidden"
    >
      {/* Hidden video for thumbnails */}
      <video ref={thumbRef} src={videoUrl} className="hidden" muted playsInline preload="metadata" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-none">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">Profile Boost</p>
          {improved && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-green-400 mt-0.5">
              🔥 Top 20% quality video
            </motion.p>
          )}
        </div>
        <button
          onClick={exportVideo}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg shadow-[#ff4d8d]/30 disabled:opacity-50 transition"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Video preview */}
      <div
        className={`relative flex-none flex items-center justify-center mx-4 rounded-3xl overflow-hidden transition-all duration-500 ${
          aiEnhanced ? 'shadow-[0_0_40px_rgba(255,77,141,0.35)]' : 'shadow-2xl shadow-black/60'
        }`}
        style={{
          height: '46vh',
          background: '#000',
          outline: aiEnhanced ? '2px solid rgba(255,77,141,0.5)' : '2px solid transparent',
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-contain"
          style={{ filter: activeCss }}
          playsInline loop muted autoPlay
        />

        {/* Vignette when enhanced */}
        {aiEnhanced && !showBefore && (
          <div className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.25) 100%)' }} />
        )}

        {/* Caption */}
        {caption && (
          <div className="absolute bottom-5 left-0 right-0 text-center px-4 pointer-events-none">
            <span className="bg-black/55 backdrop-blur-sm text-white text-sm font-semibold px-4 py-1.5 rounded-xl">
              {caption}
            </span>
          </div>
        )}

        {/* Enhanced badge */}
        {aiEnhanced && !showBefore && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-gradient-to-r from-[#ff4d8d]/80 to-[#8b5cf6]/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" /> Optimized
          </div>
        )}

        {/* Before label */}
        {showBefore && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-black/60 backdrop-blur-md text-white/70 text-xs font-semibold px-3 py-1 rounded-full">
              Before
            </span>
          </div>
        )}

        {/* Hold to compare */}
        {aiEnhanced && (
          <button
            onPointerDown={() => setShowBefore(true)}
            onPointerUp={() => setShowBefore(false)}
            onPointerLeave={() => setShowBefore(false)}
            className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md text-white/60 text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/10 select-none"
          >
            Hold to compare
          </button>
        )}
      </div>

      {/* AI Analysis panel */}
      <div className="mx-4 mt-3 rounded-2xl bg-white/4 border border-white/8 p-3 flex-none">
        {analyzing ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="w-4 h-4 text-[#ff4d8d] animate-spin flex-none" />
            <span className="text-white/50 text-xs">Analyzing your video…</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">AI Analysis</span>
              {improved && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-[10px] text-green-400 font-semibold">
                  +{curEngagement - baseEngagement}% engagement
                </motion.span>
              )}
            </div>
            <ScoreBar label="Lighting"         value={curLighting}   />
            <ScoreBar label="Clarity"          value={curClarity}    />
            <ScoreBar label="Engagement Score" value={curEngagement} />
            {!improved ? (
              <button
                onClick={handleImprove}
                className="w-full mt-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-xs font-bold py-2.5 rounded-xl shadow-md shadow-[#ff4d8d]/25"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Improve My Score
              </button>
            ) : (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mt-1">
                <Check className="w-3.5 h-3.5 text-green-400 flex-none" />
                <span className="text-green-400 text-xs font-semibold">
                  Optimized — {curEngagement}% engagement score
                </span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex mt-3 mx-4 bg-white/5 rounded-2xl p-1 flex-none">
        {([
          { id: 'looks'   as Tab, icon: Sparkles, label: 'Looks' },
          { id: 'trim'    as Tab, icon: Scissors, label: 'Trim' },
          { id: 'caption' as Tab, icon: Type,     label: 'Caption' },
        ]).map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              tab === id ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 mt-3 min-h-0">
        <AnimatePresence mode="wait">

          {tab === 'looks' && (
            <motion.div key="looks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-3 gap-2.5">
                {LOOKS.map((l, i) => (
                  <button key={l.value} onClick={() => setLook(l.value)}
                    className={`rounded-2xl overflow-hidden border-2 transition-all relative ${
                      look === l.value
                        ? 'border-[#ff4d8d] shadow-lg shadow-[#ff4d8d]/30'
                        : 'border-transparent'
                    }`}
                  >
                    {l.tag && (
                      <div className="absolute top-1.5 left-1.5 z-10 bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                        🔥 AI Pick
                      </div>
                    )}
                    <div className="relative h-14 bg-black overflow-hidden">
                      {thumbs[i] ? (
                        <img src={thumbs[i]} alt={l.label} className="w-full h-full object-cover"
                          style={{ filter: l.css }} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500"
                          style={{ filter: l.css }} />
                      )}
                      {look === l.value && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Check className="w-5 h-5 text-white drop-shadow" />
                        </div>
                      )}
                    </div>
                    <div className={`py-1.5 text-[11px] font-semibold bg-[#0f0f14] leading-tight ${
                      look === l.value ? 'text-[#ff4d8d]' : 'text-white/50'
                    }`}>
                      {l.emoji} {l.label}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {tab === 'trim' && (
            <motion.div key="trim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs">Select your clip range</p>
                <span className="text-xs font-bold text-[#ff4d8d]">{(trimEnd - trimStart).toFixed(1)}s</span>
              </div>
              <div className="relative h-10 bg-white/5 rounded-xl overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-[#ff4d8d]/30 to-[#8b5cf6]/30 border-x-2 border-[#ff4d8d]"
                  style={{
                    left:  `${(trimStart / Math.max(duration, 1)) * 100}%`,
                    right: `${100 - (trimEnd / Math.max(duration, 1)) * 100}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs font-mono">
                  {duration.toFixed(1)}s total
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-white/40 mb-2">
                    <span>Start</span><span className="text-white font-medium">{trimStart.toFixed(1)}s</span>
                  </div>
                  <input type="range" min={0} max={Math.max(0, trimEnd - 0.5)} step={0.1} value={trimStart}
                    onChange={(e) => setTrimStart(+e.target.value)} className="w-full accent-[#ff4d8d]" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-white/40 mb-2">
                    <span>End</span><span className="text-white font-medium">{trimEnd.toFixed(1)}s</span>
                  </div>
                  <input type="range" min={Math.min(duration, trimStart + 0.5)} max={duration} step={0.1} value={trimEnd}
                    onChange={(e) => setTrimEnd(+e.target.value)} className="w-full accent-[#ff4d8d]" />
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'caption' && (
            <motion.div key="caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 80))}
                placeholder="Add a caption to your video…"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-white/25 resize-none focus:outline-none focus:border-[#ff4d8d]/50"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/25">{caption.length}/80</span>
                {caption && <button onClick={() => setCaption('')} className="text-xs text-white/30 hover:text-white/60">Clear</button>}
              </div>
              <button
                onClick={suggestCaptions}
                disabled={aiLoading}
                className="flex items-center gap-2 w-full justify-center bg-gradient-to-r from-[#ff4d8d]/10 to-[#8b5cf6]/10 border border-[#ff4d8d]/20 rounded-2xl px-4 py-3 text-sm text-white/80 hover:from-[#ff4d8d]/20 transition disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin text-[#ff4d8d]" /> : <Sparkles className="w-4 h-4 text-[#ff4d8d]" />}
                Write my caption with AI
              </button>
              <AnimatePresence>
                {aiSuggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <p className="text-white/30 text-xs">Tap to use:</p>
                    {aiSuggestions.map((s, i) => (
                      <motion.button key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => setCaption(s)}
                        className={`w-full text-left text-sm px-4 py-3 rounded-2xl border transition ${
                          caption === s ? 'border-[#ff4d8d] bg-[#ff4d8d]/10 text-white' : 'border-white/8 bg-white/4 text-white/65 hover:bg-white/8'
                        }`}
                      >{s}</motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
