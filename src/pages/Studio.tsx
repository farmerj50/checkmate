/**
 * 🎬 STUDIO — Video/Image upload + AI content creation assistant
 * Layout: Left sidebar | Center tabs (Video / Images / Script) | Right AI panel
 */
import { useState, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, Search, PlusSquare, Heart, Bell, Upload, Sparkles,
  Send, Loader2, X, Video, Film, Wand2, Hash, FileText,
  Image as ImageIcon, Zap, Plus, Check, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  scriptContent?: string;
}

type CenterTab = 'video' | 'images' | 'script';

const QUICK_PROMPTS = [
  { icon: Sparkles,  label: 'Create concept', msg: 'Create a complete video concept for my CheckMate dating profile video. Include: a powerful hook for the first 3 seconds, main content idea, and CTA. Make it authentic and engaging.' },
  { icon: FileText,  label: 'Write script',   msg: 'Write a complete 30-second video script with timing marks (e.g. [0-3s]), dialogue or voiceover text, and visual directions for each segment.' },
  { icon: ImageIcon, label: 'Picture ideas',  msg: 'Suggest 6 specific photo or B-roll scene ideas I should capture to complement my video. Be specific about angles, lighting, and what to show.' },
  { icon: Zap,       label: 'Improve it',     msg: 'Analyze my current content and caption, then give me 5 specific, actionable improvements I can make right now to get more engagement.' },
  { icon: Wand2,     label: 'Hook ideas',     msg: 'Give me 5 powerful hook ideas for the first 3 seconds of my video to stop the scroll and make people want to keep watching.' },
  { icon: Hash,      label: 'Hashtags',       msg: 'Suggest 10 relevant hashtags for my CheckMate dating profile video that will maximize reach.' },
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
  const imgFileRef  = useRef<HTMLInputElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  /* video */
  const [videoFile, setVideoFile]   = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption]       = useState('');
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);

  /* images */
  const [images, setImages]         = useState<{ file: File; url: string }[]>([]);
  const [imgDragOver, setImgDragOver] = useState(false);

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

  function addImages(files: FileList) {
    const next = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 12 - images.length)
      .map(f => ({ file: f, url: URL.createObjectURL(f) }));
    if (next.length) setImages(prev => [...prev, ...next]);
  }

  const onVideoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickVideo(f);
  }, []);

  const onImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setImgDragOver(false);
    addImages(e.dataTransfer.files);
  }, [images.length]);

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
        hasImages: images.length > 0,
        imageCount: images.length,
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
    if (!videoFile && images.length === 0) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('demo_token') ?? (await auth.currentUser?.getIdToken()) ?? '';
      const formData = new FormData();
      const isVideo  = !!videoFile;
      formData.append('video', isVideo ? videoFile! : images[0].file);

      const res = await fetch('/api/upload/post-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const { url, error: uploadError } = await res.json();
      if (!res.ok) throw new Error(uploadError ?? 'Upload failed');

      await api.post('/social/posts', {
        mediaUrl: url,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        caption: caption || undefined,
      });
      toast.success('Published!');
      navigate('/home');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to publish');
    } finally {
      setUploading(false);
    }
  }

  const canPublish = !!videoFile || images.length > 0;

  const TABS: { key: CenterTab; label: string }[] = [
    { key: 'video',  label: 'Video' },
    { key: 'images', label: images.length ? `Images (${images.length})` : 'Images' },
    { key: 'script', label: script ? 'Script ●' : 'Script' },
  ];

  return (
    <div className="fixed inset-0 bg-[#050508] flex">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="flex-none flex flex-col bg-[#0a0a0f]" style={{ width: 220 }}>
        <div className="px-6 py-5 flex-none">
          <span className="text-white font-bold text-lg tracking-tight">CheckMate</span>
          <p className="text-white/30 text-xs mt-0.5">Studio</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {[
            { to: '/home',          icon: Home,       label: 'Home' },
            { to: '/explore',       icon: Search,     label: 'Explore' },
            { to: '/create',        icon: PlusSquare, label: 'Quick Post' },
            { to: '/studio',        icon: Film,       label: 'Studio' },
            { to: '/matches',       icon: Heart,      label: 'Matches' },
            { to: '/notifications', icon: Bell,       label: 'Alerts' },
            { to: '/profile',       icon: User,       label: 'Profile' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[#ff4d8d]/12 text-[#ff4d8d]' : 'text-white/50 hover:text-white hover:bg-white/5'}`
            }>
              <Icon className="w-5 h-5 flex-none" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-5 flex-none">
          <div className="rounded-xl bg-gradient-to-br from-[#ff4d8d]/10 to-[#8b5cf6]/10 border border-white/8 p-3">
            <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1">AI Powered</p>
            <p className="text-white/70 text-xs leading-snug">Create scripts, concepts, and visual ideas with your AI assistant.</p>
          </div>
        </div>
      </aside>

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
                onClick={() => { setVideoFile(null); setPreviewUrl(null); setImages([]); }}
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

            {/* IMAGES TAB */}
            {activeTab === 'images' && (
              <motion.div key="images" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">Photos & Images</p>
                    <p className="text-white/30 text-sm">Add photos to your post or use as reference for the AI</p>
                  </div>
                  {images.length > 0 && (
                    <button
                      onClick={() => imgFileRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-white/60 hover:text-white text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add more
                    </button>
                  )}
                </div>
                <input ref={imgFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addImages(e.target.files); }} />

                {images.length === 0 ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setImgDragOver(true); }}
                    onDragLeave={() => setImgDragOver(false)}
                    onDrop={onImageDrop}
                    onClick={() => imgFileRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all ${imgDragOver ? 'border-[#8b5cf6] bg-[#8b5cf6]/5' : 'border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4'}`}
                    style={{ minHeight: 280 }}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white/6 flex items-center justify-center mb-4">
                      <ImageIcon className="w-7 h-7 text-white/30" />
                    </div>
                    <p className="text-white font-semibold mb-1">Add photos</p>
                    <p className="text-white/30 text-sm mb-2">Upload images for your post or B-roll reference</p>
                    <p className="text-white/20 text-xs">JPG, PNG, WebP · Up to 12 images</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 group">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {i === 0 && !videoFile && (
                          <div className="absolute bottom-1.5 left-1.5 bg-[#ff4d8d] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">Cover</div>
                        )}
                      </div>
                    ))}
                    {images.length < 12 && (
                      <button
                        onClick={() => imgFileRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 hover:text-white/60 hover:border-white/20 transition-colors"
                      >
                        <Plus className="w-6 h-6 mb-1" />
                        <span className="text-xs">Add</span>
                      </button>
                    )}
                  </div>
                )}

                {images.length > 0 && (
                  <div className="rounded-xl bg-white/3 border border-white/6 px-4 py-3">
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-widest block mb-2">Caption</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                      placeholder="Write a caption for your post…"
                      rows={3}
                      className="w-full bg-transparent text-white text-sm placeholder-white/20 resize-none focus:outline-none [color-scheme:dark]"
                    />
                    <p className="text-white/20 text-xs text-right">{caption.length}/500</p>
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
