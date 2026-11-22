import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Video } from 'lucide-react';
import { normalizeAssetUrl } from '../utils/helpers';
import ReactionBar from './social/ReactionBar';
import ReplyThread from './social/ReplyThread';
import SaveButton from './social/SaveButton';
import type { SocialPost } from '../services/social';

interface Props {
  post: SocialPost;
  onChange?: (updated: SocialPost) => void;
}

export default function PostCard({ post: initialPost, onChange }: Props) {
  const navigate = useNavigate();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const cardRef   = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState(initialPost);
  const [showReplies, setShowReplies] = useState(false);

  useEffect(() => setPost(initialPost), [initialPost]);

  function handleChange(updated: SocialPost) {
    setPost(updated);
    onChange?.(updated);
  }

  // IntersectionObserver: autoplay when in viewport
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { v.play().catch(() => {}); }
        else { v.pause(); }
      },
      { threshold: 0.5 }
    );
    obs.observe(v);
    return () => obs.disconnect();
  }, []);

  const avatar = normalizeAssetUrl(post.author.profilePictures?.[0]);
  const media  = normalizeAssetUrl(post.videoUrl);

  return (
    <>
      <div ref={cardRef} className="bg-[#0a0a0f] border-b border-white/5">
        {/* Author row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(`/profile/${post.authorId}`)} className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex-none">
            {avatar && <img src={avatar} alt="" className="w-full h-full object-cover" />}
          </button>
          <button onClick={() => navigate(`/profile/${post.authorId}`)} className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-white font-semibold text-sm truncate">{post.author.firstName}</span>
            {post.author.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#ff4d8d] flex-none" />}
          </button>
        </div>

        {/* Media */}
        <div className="relative aspect-[4/5] w-full bg-black">
          <video
            ref={videoRef}
            src={media ?? ''}
            className="w-full h-full object-contain"
            loop muted playsInline
          />
          {post.caption && (
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
              <span className="bg-black/55 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-xl">
                {post.caption}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 px-4 py-3">
          <ReactionBar post={post} onChange={handleChange} variant="inline" />
          <SaveButton post={post} onChange={handleChange} variant="inline" />
          <button onClick={() => setShowReplies(true)} className="flex items-center gap-1.5">
            <Video className="w-5 h-5 text-white/70" />
            <span className="text-white/60 text-sm">{post.replyCount > 0 ? post.replyCount : 'Reply'}</span>
          </button>
        </div>

        {/* Caption below */}
        {post.caption && (
          <div className="px-4 pb-3">
            <span className="text-white/80 text-sm">
              <span className="font-semibold text-white mr-1">{post.author.firstName}</span>
              {post.caption}
            </span>
          </div>
        )}
      </div>

      {showReplies && (
        <ReplyThread
          postId={post.id}
          onClose={() => setShowReplies(false)}
        />
      )}
    </>
  );
}
