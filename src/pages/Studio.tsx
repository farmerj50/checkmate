import { errorMessage } from '../utils/errors';
/**
 * 🎬 STUDIO — Video upload + AI content creation assistant
 * Layout: Left sidebar | Center tabs (Video / Script) | Right AI panel
 * Video-only for v0.1 — Codex's finalized Post contract has no image-post path.
 */
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Sparkles,
  Send, Loader2, X, Video, Wand2, Hash, FileText,
  Image as ImageIcon, Zap, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api, getAccessToken } from '../lib/api';
import { socialService } from '../services/social';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  scriptContent?: string;
}

type CenterTab = 'video' | 'script';

const QUICK_PROMPTS = [
  { icon: Sparkles,  label: 'Create concept', msg: 'Create a complete video concept for my Vipi dating profile video. Include: a powerful hook for the first 3 seconds, main content idea, and CTA. Make it authentic and engaging.' },
  { icon: FileText,  label: 'Write script',   msg: 'Write a complete 30-second video script with timing marks (e.g. [0-3s]), dialogue or voiceover text, and visual directions for each segment.' },
  { icon: ImageIcon, label: 'Picture ideas',  msg: 'Suggest 6 specific photo or B-roll scene ideas I should capture to complement my video. Be specific about angles, lighting, and what to show.' },
  { icon: Zap,       label: 'Improve it',     msg: 'Analyze my current content and caption, then give me 5 specific, actionable improvements I can make right now to get more engagement.' },
  { icon: Wand2,     label: 'Hook ideas',     msg: 'Give me 5 powerful hook ideas for the first 3 seconds of my video to stop the scroll and make people want to keep watching.' },
  { icon: Hash,      label: 'Hashtags',       msg: 'Suggest 10 relevant hashtags for my Vipi dating profile video that will maximize reach.' },
];

function isScriptLike(text: string): boolean {
  return (
    text.length > 250 &&
    (text.includes('[') || /\b(HOOK|CTA|Scene|Second|0s|3s)\b/.test(text) ||
      text.toLowerCase().includes('script') || text.toLowerCase().includes('voiceover'))
  );
}

export default function Studio() {
  const navigate    = useNavigate();
  const fileRef     = useRef<HTMLInputElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  /* video — v0.1 is video-only, no image-post path (Codex's finalized Post
     contract has no way to represent one: videoUrl, no mediaType field) */
  const [videoFile, setVideoFile]   = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption]       = useState('');
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);

  /* script */
  const [script, setScript]         = useState('');
  const [savedMsg, setSavedMsg]     = useState<number | null>(null);

  /* tabs */
  const [activeTab, setActiveTab]   = useState<CenterTab>('video');

  /* AI */
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: "Hey! I'm your AI content creator. I can write scripts, create video concepts, suggest improvements, plan your shots, and more. What would you like to make? 🎬" },
  ]);
  const [aiInput, setAiInput]     = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModel, setAiModel]     = useState<'claude' | 'gpt4'>('claude');

  /* ── helpers ── */
  function pickVideo(f: File) {
    if (!f.type.startsWith('video/')) { toast.error('Please select a video file'); return; }
    setVideoFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  const onVideoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickVideo(f);
  }, []);

  function saveToScript(content: string, idx: number) {
    setScript(content);
    setActiveTab('script');
    setSavedMsg(idx);
    setTimeout(() => setSavedMsg(null), 2000);
    toast.success('Saved to Script tab');
  }

  async function sendMessage(text: string) {
    const msg = text.trim();
    if (!msg || aiLoading) return;
    setAiInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setAiLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const { reply } = await api.post<{ reply: string }>('/ai/studio', {
        message: msg,
        caption: caption || undefined,
        hasVideo: !!videoFile,
        script: script || undefined,
        model: aiModel,
      });
      const scriptContent = isScriptLike(reply) ? reply : undefined;
      setMessages(prev => [...prev, { role: 'ai', text: reply, scriptContent }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't reach the AI. Try again!" }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  async function publish() {
    if (!videoFile) return;
    setUploading(true);
    try {
      const token = (await getAccessToken()) ?? '';
      const formData = new FormData();
      // Field name must be 'media' — matches postMediaUpload.single('media')
      // in backend/src/routes/upload.ts. Pre-existing bug fixed in passing:
      // this previously sent 'video', which that route doesn't accept.
      formData.append('media', videoFile);

      const res = await fetch('/api/upload/post-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const { url, error: uploadError } = await res.json();
      if (!res.ok) throw new Error(uploadError ?? 'Upload failed');

      await socialService.createPost({
        videoUrl: url,
        caption: caption || undefined,
      });
      toast.success('Published!');
      navigate('/home');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to publish'));
    } finally {
      setUploading(false);
    }
  }

  const canPublish = !!videoFile;

  const TABS: { key: CenterTab; label: string }[] = [
    { key: 'video',  label: 'Video' },
    { key: 'script', label: script ? 'Script ●' : 'Script' },
  ];

  return (
    <div className="fixed inset-0 bg-[#050508] flex lg:pl-[220px]">

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-white/6">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-white/6 flex-none">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-white font-bold text-xl">Studio</h1>
              <p className="text-white/30 text-sm">Create, edit, and publish your content</p>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 rounded-xl p-1">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === key ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white/70'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {canPublish && (
            <div className="flex gap-3">
              <button
                onClick={() => { setVideoFile(null); setPreviewUrl(null); }}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white transition-colors"
              >
                Discard
              </button>
              <button
                onClick={publish}
                disabled={uploading}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
              >
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</> : 'Publish Post'}
              </button>
            </div>
          )}
        </div>

        {/* AI-assist blurb — was in the page's own sidebar, now that the
            sidebar is shared/global this lives inline in Studio itself. */}
        <div className="px-8 pt-4 flex-none">
          <div className="rounded-xl bg-gradient-to-br from-[#ff4d8d]/10 to-[#8b5cf6]/10 border border-white/8 px-4 py-3 flex items-center gap-3">
            <span className="text-white/50 text-[10px] uppercase tracking-widest flex-none">AI Powered</span>
            <p className="text-white/70 text-xs leading-snug">Create scripts, concepts, and visual ideas with your AI assistant.</p>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <AnimatePresence mode="wait">

            {/* VIDEO TAB */}
            {activeTab === 'video' && (
              <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                {!videoFile ? (
                  <>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onVideoDrop}
                      onClick={() => fileRef.current?.click()}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all ${dragOver ? 'border-[#ff4d8d] bg-[#ff4d8d]/5' : 'border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4'}`}
                      style={{ minHeight: 320 }}
                    >
                      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickVideo(f); }} />
                      <div className="w-16 h-16 rounded-2xl bg-white/6 flex items-center justify-center mb-4">
                        <Upload className="w-7 h-7 text-white/30" />
                      </div>
                      <p className="text-white font-semibold mb-1">Select video to upload</p>
                      <p className="text-white/30 text-sm mb-4">Or drag and drop here</p>
                      <div className="flex gap-6 text-white/20 text-xs">
                        <span>MP4, MOV, WebM</span><span>Up to 500MB</span><span>9:16 recommended</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { title: 'File formats', desc: 'MP4, MOV, WebM, AVI' },
                        { title: 'Recommended', desc: '9:16 vertical, 1080p+' },
                        { title: 'Max size', desc: '500 MB per video' },
                      ].map(({ title, desc }) => (
                        <div key={title} className="rounded-xl bg-white/3 border border-white/6 px-4 py-3">
                          <p className="text-white/60 text-xs font-semibold mb-0.5">{title}</p>
                          <p className="text-white/30 text-xs">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex gap-6">
                    <div className="flex-none rounded-2xl overflow-hidden bg-black relative" style={{ width: 200, aspectRatio: '9/16' }}>
                      <video src={previewUrl ?? ''} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                      <button onClick={() => { setVideoFile(null); setPreviewUrl(null); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="text-white/40 text-xs font-semibold uppercase tracking-widest block mb-2">Caption</label>
                        <textarea
                          value={caption}
                          onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                          placeholder="Write a caption…"
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 resize-none focus:outline-none focus:border-[#ff4d8d]/40 [color-scheme:dark]"
                        />
                        <p className="text-white/20 text-xs mt-1 text-right">{caption.length}/500</p>
                      </div>
                      <div className="rounded-xl bg-white/3 border border-white/8 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Video className="w-4 h-4 text-white/40" />
                          <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">File info</span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between"><span className="text-white/40">Name</span><span className="text-white/70 truncate max-w-[180px]">{videoFile.name}</span></div>
                          <div className="flex justify-between"><span className="text-white/40">Size</span><span className="text-white/70">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</span></div>
                          <div className="flex justify-between"><span className="text-white/40">Type</span><span className="text-white/70">{videoFile.type}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* SCRIPT TAB */}
            {activeTab === 'script' && (
              <motion.div key="script" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 h-full">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">Script & Concept</p>
                    <p className="text-white/30 text-sm">Write or generate your video script here</p>
                  </div>
                  <button
                    onClick={() => sendMessage('Write a complete 30-second video script with timing marks, dialogue/voiceover, and visual directions for each segment.')}
                    disabled={aiLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#ff4d8d]/20 to-[#8b5cf6]/20 border border-[#ff4d8d]/20 text-white/70 hover:text-white text-sm transition-colors disabled:opacity-40"
                  >
                    <Sparkles className="w-4 h-4 text-[#ff4d8d]" />
                    Generate with AI
                  </button>
                </div>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder={`Your video script will appear here.\n\nTry asking the AI to "Write script" or "Create concept" — then save it here.\n\nOr type your own script manually.`}
                  className="w-full bg-white/3 border border-white/8 rounded-2xl px-5 py-4 text-white text-sm placeholder-white/20 resize-none focus:outline-none focus:border-[#ff4d8d]/30 [color-scheme:dark] font-mono leading-relaxed"
                  style={{ minHeight: 420 }}
                />
                <div className="flex items-center justify-between">
                  <p className="text-white/20 text-xs">{script.length} characters</p>
                  {script && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(script); toast.success('Copied to clipboard'); }}
                      className="text-white/40 hover:text-white text-xs transition-colors"
                    >
                      Copy to clipboard
                    </button>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT: AI ASSISTANT ── */}
      <div className="flex-none flex flex-col bg-[#0a0a0f]" style={{ width: 380 }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-none">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff4d8d] to-[#8b5cf6] flex items-center justify-center flex-none">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">AI Content Creator</p>
            <p className="text-white/30 text-xs">{aiModel === 'claude' ? 'Powered by Claude' : 'Powered by GPT-4o'}</p>
          </div>
          {/* Model switcher */}
          <div className="flex bg-white/6 rounded-lg p-0.5 gap-0.5 flex-none">
            <button
              onClick={() => setAiModel('claude')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${aiModel === 'claude' ? 'bg-[#ff4d8d]/80 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              Claude
            </button>
            <button
              onClick={() => setAiModel('gpt4')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${aiModel === 'gpt4' ? 'bg-[#10a37f]/80 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              GPT-4
            </button>
          </div>
        </div>

        {/* Quick prompts */}
        <div className="px-4 py-3 border-b border-white/5 flex-none">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(({ icon: Icon, label, msg }) => (
              <button
                key={label}
                onClick={() => sendMessage(msg)}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/6 hover:bg-white/12 border border-white/8 text-white/60 hover:text-white text-xs transition-colors disabled:opacity-40"
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                {m.role === 'ai' && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ff4d8d] to-[#8b5cf6] flex items-center justify-center flex-none mr-2 mt-0.5">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[260px] px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-[#ff4d8d] to-[#8b5cf6] text-white rounded-br-sm'
                      : 'bg-white/8 text-white/80 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
              {/* Save to Script button for AI script responses */}
              {m.role === 'ai' && m.scriptContent && (
                <div className="ml-8 mt-1.5">
                  <button
                    onClick={() => saveToScript(m.scriptContent!, i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      savedMsg === i
                        ? 'bg-green-500/15 border-green-500/30 text-green-400'
                        : 'bg-white/6 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {savedMsg === i ? <><Check className="w-3 h-3" /> Saved to Script</> : <><FileText className="w-3 h-3" /> Save to Script tab</>}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
          {aiLoading && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ff4d8d] to-[#8b5cf6] flex items-center justify-center flex-none">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <div className="bg-white/8 rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1">
                {[0, 1, 2].map((d) => (
                  <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-white/40"
                    animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-white/8 flex-none">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(aiInput); } }}
              placeholder="Ask your AI creator…"
              className="flex-1 bg-white/6 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#ff4d8d]/40 [color-scheme:dark]"
            />
            <button
              onClick={() => sendMessage(aiInput)}
              disabled={!aiInput.trim() || aiLoading}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] flex items-center justify-center disabled:opacity-40 flex-none"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
