import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { marketplaceService } from '../../services/marketplace';
import Button from '../ui/Button';

interface Props {
  listingId: string;
  listingTitle: string;
  sellerFirstName: string;
  onClose: () => void;
}

/**
 * New — no Night Out equivalent. Deliberately isolated from src/pages/Chat.tsx and any
 * dating-messaging code/types: this is a mock-only "contact seller" action, not a real
 * cross-user messaging channel, and is never meant to be confused with one. Same
 * separation-of-domains reasoning as keeping ReportListingModal off the user-report flow.
 */
export default function ContactSellerModal({ listingId, listingTitle, sellerFirstName, onClose }: Props) {
  const [step, setStep] = useState<'compose' | 'sent'>('compose');
  const [message, setMessage] = useState(`Hi, is "${listingTitle}" still available?`);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await marketplaceService.contactSeller({ listingId, message: message.trim() });
      setStep('sent');
    } catch {
      toast.error('Could not send — try again');
    } finally {
      setSending(false);
    }
  }

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
              <MessageCircle className="w-5 h-5 text-[#ff4d8d]" />
              <h2 className="font-bold text-gray-900 text-lg">
                {step === 'sent' ? 'Message sent' : `Contact ${sellerFirstName}`}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {step === 'compose' && (
            <>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a message..."
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff4d8d]/40 resize-none text-sm mb-4"
              />
              <Button variant="primary" fullWidth disabled={!message.trim()} isLoading={sending} onClick={send}>
                Send
              </Button>
            </>
          )}

          {step === 'sent' && (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Message recorded in demo mode.</p>
              <p className="text-sm text-gray-500 mb-5">No real message was sent.</p>
              <Button variant="primary" fullWidth onClick={onClose}>Done</Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
