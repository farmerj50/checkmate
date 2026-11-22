import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { socialService, type SocialPost } from '../../services/social';

interface Props {
  post: SocialPost;
  onChange: (updated: SocialPost) => void;
  variant?: 'rail' | 'inline';
}

export default function SaveButton({ post, onChange, variant = 'inline' }: Props) {
  const [saving, setSaving] = useState(false);
  const isRail = variant === 'rail';

  async function toggle() {
    if (saving) return;
    setSaving(true);
    try {
      const updated = post.isSaved
        ? await socialService.unsavePost(post.id)
        : await socialService.savePost(post.id);
      onChange(updated);
    } catch {
      toast.error(post.isSaved ? 'Could not remove saved video' : 'Could not save video');
    } finally {
      setSaving(false);
    }
  }

  const iconClass = post.isSaved ? 'text-[#ff4d8d] fill-[#ff4d8d]' : isRail ? 'text-white' : 'text-white/70';
  const label = post.saveCount > 0 ? post.saveCount.toLocaleString() : 'Save';

  if (isRail) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-label={post.isSaved ? 'Remove saved video' : 'Save video'}
        className="flex flex-col items-center gap-1.5 disabled:opacity-60"
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${post.isSaved ? 'bg-[#ff4d8d]/20' : 'bg-white/10 hover:bg-white/20'}`}>
          <Bookmark className={`w-5 h-5 ${iconClass}`} />
        </div>
        <span className="text-white/60 text-[11px]">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-label={post.isSaved ? 'Remove saved video' : 'Save video'}
      className="flex items-center gap-1.5 disabled:opacity-60"
    >
      <Bookmark className={`w-5 h-5 ${iconClass}`} />
      <span className="text-white/60 text-sm">{post.saveCount > 0 ? post.saveCount.toLocaleString() : ''}</span>
    </button>
  );
}
