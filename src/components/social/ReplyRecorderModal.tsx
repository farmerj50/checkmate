import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { socialService, type SocialPost } from '../../services/social';
import { auth } from '../../lib/firebase';
import VideoRecorder from '../VideoRecorder';

interface Props {
  parentPostId: string;
  onClose: () => void;
  onCreated: (reply: SocialPost) => void;
}

/**
 * Records a video reply, uploads it through the existing (unmodified)
 * /api/upload/post-media endpoint — same one CreatePost.tsx/Studio.tsx use
 * for root posts — and creates the reply via SocialService with the real
 * server-hosted URL. A browser-local `URL.createObjectURL(blob)` would only
 * ever resolve inside the recorder's own tab, so it can't be what's sent to
 * the backend; this path was mock-only before real integration.
 */
export default function ReplyRecorderModal({ parentPostId, onClose, onCreated }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleComplete(blob: Blob) {
    setUploading(true);
    try {
      const token = localStorage.getItem('demo_token') ?? (await auth.currentUser?.getIdToken()) ?? '';
      const file = new File([blob], `reply-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
      const formData = new FormData();
      formData.append('media', file);
      const uploadRes = await fetch('/api/upload/post-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const { url, error: uploadError } = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadError ?? 'Upload failed');

      const reply = await socialService.createReply(parentPostId, { videoUrl: url });
      onCreated(reply);
      onClose();
    } catch {
      toast.error('Could not post your reply — try again');
    } finally {
      setUploading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[320] bg-black/70 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          className="bg-[#0f0f14] w-full max-w-sm rounded-3xl p-5 border border-white/10"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-semibold text-sm">Reply with video</span>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/8 text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>
          <VideoRecorder onRecordingComplete={handleComplete} isUploading={uploading} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
