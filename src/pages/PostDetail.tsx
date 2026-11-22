import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Video } from 'lucide-react';
import { socialService, type SocialPost } from '../services/social';
import { useAsync } from '../hooks/useAsync';
import { normalizeAssetUrl } from '../utils/helpers';
import AsyncState from '../components/ui/AsyncState';
import ReactionBar from '../components/social/ReactionBar';
import ReplyRecorderModal from '../components/social/ReplyRecorderModal';
import SaveButton from '../components/social/SaveButton';

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [localReplies, setLocalReplies] = useState<SocialPost[] | null>(null);

  const postState = useAsync(
    () => (postId ? socialService.getPost(postId) : Promise.resolve(null)),
    [postId]
  );
  const repliesState = useAsync(
    () => (postId ? socialService.getReplies(postId) : Promise.resolve({ items: [], nextCursor: null })),
    [postId]
  );

  const [localPost, setLocalPost] = useState<SocialPost | null>(null);
  useEffect(() => setLocalPost(postState.data ?? null), [postState.data]);
  useEffect(() => setLocalReplies(null), [postId]);

  const post = localPost;
  const replies = localReplies ?? repliesState.data?.items ?? [];

  function handlePostChange(updated: SocialPost) {
    setLocalPost(updated);
  }

  function handleReplyChange(updated: SocialPost) {
    setLocalReplies((replies).map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleReplyCreated(reply: SocialPost) {
    setLocalReplies([...(localReplies ?? repliesState.data?.items ?? []), reply]);
  }

  return (
    <div className="min-h-screen bg-[#050508] flex flex-col pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050508]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/8">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold">Post</span>
      </div>

      <AsyncState
        loading={postState.status === 'loading'}
        error={postState.error}
        empty={postState.status === 'success' && !post}
        emptyMessage="This post isn't available."
        errorMessage="Couldn't load this post."
        onRetry={postState.reload}
      >
        {post && (
          <div className="flex-1 overflow-y-auto">
            {/* Media */}
            <div className="bg-black flex items-center justify-center" style={{ height: '50vh' }}>
              <video
                src={normalizeAssetUrl(post.videoUrl) ?? ''}
                className="h-full w-full object-contain"
                autoPlay loop muted playsInline
              />
            </div>

            {/* Author + caption */}
            <div className="px-4 py-3 border-b border-white/5">
              <button onClick={() => navigate(`/profile/${post.authorId}`)} className="text-white font-semibold text-sm">
                {post.author.firstName}
              </button>
              {post.caption && <p className="text-white/70 text-sm mt-1">{post.caption}</p>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-5 px-4 py-3 border-b border-white/5">
              <ReactionBar post={post} onChange={handlePostChange} variant="inline" />
              <SaveButton post={post} onChange={handlePostChange} variant="inline" />
              <button onClick={() => setRecorderOpen(true)} className="flex items-center gap-1.5">
                <Video className="w-5 h-5 text-white/70" />
                <span className="text-white/60 text-sm">{replies.length > 0 ? replies.length : 'Reply'}</span>
              </button>
            </div>

            {/* Video replies */}
            <div className="px-4 py-3">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">Video replies</p>
              <AsyncState
                loading={repliesState.status === 'loading'}
                error={repliesState.error}
                empty={repliesState.status === 'success' && replies.length === 0}
                emptyMessage="No video replies yet. Be the first."
                errorMessage="Couldn't load replies."
                onRetry={repliesState.reload}
              >
                <div className="space-y-4">
                  {replies.map((reply) => (
                    <ReplyCard key={reply.id} reply={reply} onChange={handleReplyChange} />
                  ))}
                </div>
              </AsyncState>
            </div>
          </div>
        )}
      </AsyncState>

      {recorderOpen && postId && (
        <ReplyRecorderModal
          parentPostId={postId}
          onClose={() => setRecorderOpen(false)}
          onCreated={handleReplyCreated}
        />
      )}
    </div>
  );
}

function ReplyCard({ reply, onChange }: { reply: SocialPost; onChange: (r: SocialPost) => void }) {
  const navigate = useNavigate();
  const avatar = normalizeAssetUrl(reply.author.profilePictures?.[0]);
  const media = normalizeAssetUrl(reply.videoUrl);

  return (
    <div className="flex items-start gap-3">
      <button onClick={() => navigate(`/profile/${reply.authorId}`)} className="w-9 h-9 rounded-full bg-white/10 flex-none overflow-hidden">
        {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-white text-xs font-semibold">{reply.author.firstName}</span>
        <div className="mt-1.5 rounded-xl overflow-hidden bg-black aspect-[9/16] max-w-[160px]">
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
