import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Upload, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import VideoRecorder from '../components/VideoRecorder';
import { marketplaceService, type MarketplaceCategory, type MarketplaceCondition } from '../services/marketplace';
import { MARKETPLACE_CATEGORY_LABELS, MARKETPLACE_CONDITION_LABELS } from '../services/marketplace/presentation';

type Step = 'pick' | 'details';
type Mode = 'record' | 'upload';

const CATEGORIES = Object.keys(MARKETPLACE_CATEGORY_LABELS) as MarketplaceCategory[];
const CONDITIONS = Object.keys(MARKETPLACE_CONDITION_LABELS) as MarketplaceCondition[];

export default function MarketplaceCreate() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('pick');
  const [mode, setMode] = useState<Mode>('record');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('ELECTRONICS');
  const [condition, setCondition] = useState<MarketplaceCondition>('GOOD');
  const [location, setLocation] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast.error('Please choose a video file.');
      return;
    }
    // Preview-only: this file is never uploaded anywhere — there's no media endpoint
    // for marketplace listings yet, so the mock service substitutes a stock clip for
    // the actual listing video on publish. See MockMarketplaceService/plan §8.
    setPreviewUrl(URL.createObjectURL(f));
    setStep('details');
  }

  function handleRecordingComplete(blob: Blob) {
    setPreviewUrl(URL.createObjectURL(blob));
    setStep('details');
  }

  function resetToPickStep() {
    if (publishing) return;
    setStep('pick');
    setPreviewUrl(null);
  }

  const canPublish = title.trim() && description.trim() && location.trim() && price !== '' && !publishing;

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    try {
      const listing = await marketplaceService.createListing({
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        condition,
        location: location.trim(),
        videoUrl: '', // ignored by the mock service — see comment in MockMarketplaceService.createListing
      });
      toast.success('Listing created!');
      navigate(`/marketplace/${listing.id}`);
    } catch {
      toast.error('Could not create listing — try again');
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050508] lg:pl-[220px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/95 backdrop-blur-xl border-b border-white/6 flex items-center justify-between px-4 py-3">
        <button
          onClick={() => (step === 'details' ? resetToPickStep() : navigate(-1))}
          disabled={publishing}
          className="p-2 rounded-full bg-white/8 text-white/70 active:bg-white/15 disabled:opacity-40 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white font-semibold text-base">Sell Something</h1>
        <div className="w-9" />
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-6 sm:py-10">
        <div className="sm:bg-white/[0.03] sm:border sm:border-white/8 sm:rounded-3xl sm:p-8">
          <AnimatePresence mode="wait">
            {step === 'pick' && (
              <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
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

                {mode === 'record' && (
                  <div className="rounded-2xl overflow-hidden border border-white/8 bg-[#0a0a0f]">
                    <VideoRecorder onRecordingComplete={handleRecordingComplete} isUploading={false} />
                  </div>
                )}

                {mode === 'upload' && (
                  <>
                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed border-white/12 rounded-2xl bg-white/3 hover:bg-white/5 hover:border-white/20 active:scale-[0.98] transition-all"
                    >
                      <Camera className="w-9 h-9 text-white opacity-35" />
                      <div className="text-center">
                        <p className="text-white/60 text-sm font-medium">Tap to choose</p>
                        <p className="text-white/30 text-xs mt-1">A short video of the item</p>
                      </div>
                      <div className="px-5 py-2 rounded-full bg-white/8 border border-white/10 text-white/50 text-xs font-semibold">
                        Browse files
                      </div>
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {step === 'details' && previewUrl && (
              <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Preview */}
                <div className="relative rounded-2xl overflow-hidden bg-black border border-white/8" style={{ aspectRatio: '9/16', maxHeight: '40vh' }}>
                  <video src={previewUrl} className="w-full h-full object-contain" muted loop autoPlay playsInline />
                  <button
                    onClick={resetToPickStep}
                    disabled={publishing}
                    className="absolute top-4 right-4 w-9 h-9 bg-black/75 backdrop-blur-md rounded-full flex items-center justify-center disabled:opacity-40 transition"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>

                <p className="text-white/30 text-[11px] text-center">
                  Preview only — this is a demo. A stock sample clip stands in for your video once published.
                </p>

                {/* Form fields */}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Listing title"
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#ff4d8d]/40"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  rows={3}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 resize-none focus:outline-none focus:border-[#ff4d8d]/40"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Price ($, 0 = free)"
                    className="flex-1 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#ff4d8d]/40"
                  />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, State"
                    className="flex-1 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#ff4d8d]/40"
                  />
                </div>

                {/* Category chips */}
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          category === c
                            ? 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white'
                            : 'bg-white/5 text-white/40 border border-white/8'
                        }`}
                      >
                        {MARKETPLACE_CATEGORY_LABELS[c]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Condition chips */}
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">Condition</p>
                  <div className="flex flex-wrap gap-2">
                    {CONDITIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCondition(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          condition === c
                            ? 'bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white'
                            : 'bg-white/5 text-white/40 border border-white/8'
                        }`}
                      >
                        {MARKETPLACE_CONDITION_LABELS[c]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Publish — plain indeterminate state, no fake progress percentage */}
                <button
                  onClick={publish}
                  disabled={!canPublish}
                  className="w-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-[#ff4d8d]/20 disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {publishing ? 'Creating listing…' : 'Publish Listing'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
