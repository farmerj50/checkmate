import { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, X } from 'lucide-react';
import { socialService, type SocialPost } from '../../services/social';
import { useAsync } from '../../hooks/useAsync';
import { normalizeAssetUrl } from '../../utils/helpers';
import AsyncState from '../ui/AsyncState';
import ReactionBar from './ReactionBar';
import SaveButton from './SaveButton';
import ReplyRecorderModal from './ReplyRecorderModal';

interface Props {
  postId: string;
  onClose: () => void;
}

/** Video-reply thread — the video-first replacement for CommentSheet. No text input anywhere. */
export default function ReplyThread({ postId, onClose }: Props) {
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [localReplies, setLocalReplies] = useState<SocialPost[] | null>(null);

  const { data, status, error, reload } = useAsync(
    () => socialService.getReplies(postId),
    [postId]
  );

  const replies = localReplies ?? data?.items ?? [];

  function handleCreated(reply: SocialPost) {
    setLocalReplies([...(localReplies ?? data?.items ?? []), reply]);
  }

  function updateReply(updated: SocialPost) {
    setLocalReplies((replies ?? []).map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed inset-x-0 bottom-0 z-[300] bg-[#0f0f14] rounded-t-3xl border-t border-white/10 flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-none">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-none">
          <span className="text-white font-semibold text-sm">Video replies</span>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/8 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          <AsyncState
            loading={status === 'loading'}
            error={error}
            empty={status === 'success' && replies.length === 0}
            emptyMessage="No video replies yet. Be the first."
            errorMessage="Couldn't load replies."
            onRetry={reload}
          >
            {replies.map((reply) => (
              <ReplyRow key={reply.id} reply={reply} onChange={updateReply} />
            ))}
          </AsyncState>
        </div>

        <div className="flex-none border-t border-white/8 p-4 pb-safe">
          <button
            onClick={() => setRecorderOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#8b5cf6] text-white font-semibold text-sm"
          >
            <Video className="w-4 h-4" />
            Reply with video
          </button>
        </div>
      </motion.div>

      {recorderOpen && (
        <ReplyRecorderModal
          parentPostId={postId}
          onClose={() => setRecorderOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

function ReplyRow({ reply, onChange }: { reply: SocialPost; onChange: (r: SocialPost) => void }) {
  const avatar = normalizeAssetUrl(reply.author.profilePictures?.[0]);
  const media = normalizeAssetUrl(reply.videoUrl);

  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-white/10 flex-none overflow-hidden">
        {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-white text-xs font-semibold">{reply.author.firstName}</span>
        <div className="mt-1.5 rounded-xl overflow-hidden bg-black aspect-[9/16] max-w-[140px]">
          <video src={media ?? ''} className="w-full h-full object-cover" muted loop playsInline controls />
        </div>
        <div className="mt-1.5">
          <div className="flex items-center gap-4">
            <ReactionBar post={reply} onChange={onChange} variant="inline" />
            <SaveButton post={reply} onChange={onChange} variant="inline" />
          </div>
        </div>
      </div>
    </div>
  );
}
