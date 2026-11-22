import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { nightOutService, type NightOutReportReason } from '../../services/nightOut';
import Button from '../ui/Button';

const REASONS: { value: NightOutReportReason; label: string; emoji: string }[] = [
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content', emoji: '🚫' },
  { value: 'MISLEADING_INFO', label: 'Misleading event info', emoji: '❓' },
  { value: 'SAFETY_CONCERN', label: 'Safety concern', emoji: '⚠️' },
  { value: 'SPAM', label: 'Spam or scam', emoji: '📨' },
  { value: 'OTHER', label: 'Other', emoji: '💬' },
];

interface Props {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

/**
 * Structurally cloned from src/components/ReportModal.tsx's step machine, but a
 * separate component: this reports an event, not a user, so there's no block action
 * and it's wired to nightOutService instead of socialService.
 */
export default function ReportEventModal({ eventId, eventTitle, onClose }: Props) {
  const [step, setStep] = useState<'choose' | 'detail' | 'done'>('choose');
  const [selectedReason, setSelectedReason] = useState<NightOutReportReason | ''>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReport = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await nightOutService.report({
        eventId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });
      setStep('done');
    } catch {
      toast.error('Could not submit report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-bold text-gray-900 text-lg">
                {step === 'done' ? 'Report submitted' : 'Report event'}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {step === 'choose' && (
            <>
              <p className="text-sm text-gray-500 mb-4">What's the issue with "{eventTitle}"?</p>
              <div className="space-y-2 mb-5">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setSelectedReason(r.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selectedReason === r.value
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span className={`text-sm font-medium ${selectedReason === r.value ? 'text-red-700' : 'text-gray-700'}`}>
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>
              <Button variant="danger" fullWidth disabled={!selectedReason} onClick={() => setStep('detail')}>
                Continue
              </Button>
            </>
          )}

          {step === 'detail' && (
            <>
              <p className="text-sm text-gray-500 mb-3">Add more detail (optional)</p>
              <textarea
                rows={4}
                placeholder="Describe what happened..."
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none text-sm mb-4"
              />
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setStep('choose')}>
                  Back
                </Button>
                <Button variant="danger" className="flex-1" isLoading={submitting} onClick={submitReport}>
                  Submit Report
                </Button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Thank you for your report</p>
              <p className="text-sm text-gray-500 mb-5">We review all reports within 24 hours.</p>
              <Button variant="primary" fullWidth onClick={onClose}>Done</Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
