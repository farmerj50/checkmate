import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Video, MoreVertical, CheckCheck, Check, Flag, Ban, Play, X, User } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';
import { getSocket } from '../lib/socket';
import ReportModal from '../components/ReportModal';
import type { Message, Match, User as UserType } from '../types';

type ExtendedMatch = Match & { otherUser: UserType };

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].createdAt);
  const curr = new Date(messages[index].createdAt);
  return prev.toDateString() !== curr.toDateString();
}

// ── Video message bubble ──────────────────────────────────────────────────────
function VideoMessage({ content, isOwn }: { content: string; isOwn: boolean }) {
  const [previewing, setPreviewing] = useState(false);

  return (
    <>
      <div
        className={`relative rounded-2xl overflow-hidden cursor-pointer ${
          isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
        style={{ width: 180, aspectRatio: '9/16', maxHeight: 260 }}
        onClick={() => setPreviewing(true)}
      >
        <video
          src={content}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-0.5" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {previewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setPreviewing(false)}
          >
            <button
              className="absolute top-5 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
              onClick={() => setPreviewing(false)}
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <video
              src={content}
              className="max-h-screen max-w-full"
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Chat() {
  const { id: matchId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dbUser } = useAuth();

  const [match, setMatch] = useState<ExtendedMatch | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);

  // Load match + history
  useEffect(() => {
    if (!matchId) return;

    async function load() {
      try {
        const [matchData, msgData] = await Promise.all([
          api.get<{ matches: ExtendedMatch[] }>('/matches'),
          api.get<{ messages: Message[] }>(`/messages/${matchId}`),
        ]);
        const found = matchData.matches.find((m) => m.id === matchId);
        if (!found) { navigate('/matches'); return; }
        setMatch(found);
        setMessages(msgData.messages);
      } catch {
        toast.error('Could not load conversation');
        navigate('/matches');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [matchId, navigate]);

  // Socket
  useEffect(() => {
    if (!matchId) return;
    let mounted = true;

    getSocket().then((sock) => {
      if (!mounted) return;
      socketRef.current = sock;
      sock.emit('match:join', matchId);

      sock.on('message:new', (msg: Message) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (document.visibilityState === 'visible') sock.emit('messages:read', matchId);
      });

      sock.on('user:online', ({ userId }: { userId: string }) => {
        if (userId === match?.otherUser?.id) setOtherUserOnline(true);
      });
      sock.on('user:offline', ({ userId }: { userId: string }) => {
        if (userId === match?.otherUser?.id) setOtherUserOnline(false);
      });
      sock.on('messages:read', ({ readBy }: { readBy: string }) => {
        if (readBy !== dbUser?.id) {
          setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
        }
      });
    });

    return () => {
      mounted = false;
      socketRef.current?.emit('match:leave', matchId);
      socketRef.current?.off('message:new');
      socketRef.current?.off('user:online');
      socketRef.current?.off('user:offline');
      socketRef.current?.off('messages:read');
    };
  }, [matchId, dbUser?.id, match?.otherUser?.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAuthToken = async () =>
    localStorage.getItem('demo_token') ?? (await auth.currentUser?.getIdToken()) ?? '';

  const sendVideo = useCallback(async (file: File) => {
    if (!matchId || uploading) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('video', file);
      const token = await getAuthToken();
      const uploadRes = await fetch('/api/upload/video-message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed');

      const videoUrl: string = uploadData.url;

      // Optimistic
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        matchId: matchId!,
        senderId: dbUser!.id,
        content: videoUrl,
        messageType: 'VIDEO',
        isRead: false,
        createdAt: new Date().toISOString(),
        sender: dbUser as any,
      };
      setMessages((prev) => [...prev, optimistic]);

      // Send via REST
      const data = await api.post<{ message: Message }>('/messages', {
        matchId,
        content: videoUrl,
        messageType: 'VIDEO',
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m))
      );
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send video');
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('optimistic-')));
    } finally {
      setUploading(false);
    }
  }, [matchId, uploading, dbUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!match) return null;

  const other = match.otherUser;
  const avatar = other.profileVideo
    ? null
    : `https://ui-avatars.com/api/?name=${other.firstName}&background=ec4899&color=fff`;

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-950 border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/matches')} className="p-1 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </button>

        <div
          className="relative cursor-pointer"
          onClick={() => navigate(`/match/${matchId}`)}
        >
          {other.profileVideo ? (
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
              <video src={other.profileVideo} className="w-full h-full object-cover" muted playsInline />
            </div>
          ) : (
            <img src={avatar!} alt={other.firstName} className="w-10 h-10 rounded-full object-cover" />
          )}
          {otherUserOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-950" />
          )}
        </div>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate(`/match/${matchId}`)}
        >
          <h2 className="font-semibold text-white truncate">{other.firstName}</h2>
          <p className="text-xs text-white/40">
            {otherUserOnline
              ? 'Active now'
              : other.lastActive
              ? `Active ${formatDistanceToNow(new Date(other.lastActive), { addSuffix: true })}`
              : 'Offline'}
          </p>
        </div>

        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => navigate(`/match/${matchId}`)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <User className="w-5 h-5 text-white/50" />
          </button>
          <button
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical className="w-5 h-5 text-white/50" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                className="absolute right-0 top-10 bg-gray-900 rounded-2xl shadow-xl border border-white/10 w-44 py-1 z-20"
              >
                <button
                  onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
                >
                  <Flag className="w-4 h-4 text-red-400" /> Report
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    try {
                      await api.post(`/safety/block/${other.id}`, {});
                      toast.success(`${other.firstName} blocked`);
                      navigate('/matches');
                    } catch { toast.error('Could not block user'); }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10"
                >
                  <Ban className="w-4 h-4" /> Block
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-950">
        {messages.length === 0 && !uploading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center py-12"
          >
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-800 mb-4 shadow-md">
              {other.profileVideo ? (
                <video src={other.profileVideo} className="w-full h-full object-cover" muted playsInline />
              ) : (
                <img src={avatar!} alt={other.firstName} className="w-full h-full object-cover" />
              )}
            </div>
            <h3 className="font-semibold text-white mb-1">You matched with {other.firstName}!</h3>
            <p className="text-sm text-white/40">Send a video to start the conversation</p>
            <Video className="w-6 h-6 text-white/20 mt-3" />
          </motion.div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.senderId === dbUser?.id;
          const showDate = shouldShowDateSeparator(messages, i);
          const isOptimistic = msg.id.startsWith('optimistic-');

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: isOptimistic ? 0.6 : 1, y: 0, scale: 1 }}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
              >
                {!isOwn && (
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-800 mr-2 self-end flex-shrink-0">
                    {other.profileVideo ? (
                      <video src={other.profileVideo} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <img src={avatar!} alt={other.firstName} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}

                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {msg.messageType === 'VIDEO' ? (
                    <VideoMessage content={msg.content} isOwn={isOwn} />
                  ) : (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[72%] ${
                        isOwn
                          ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-br-sm'
                          : 'bg-gray-800 text-white rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                  <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] text-white/25">
                      {format(new Date(msg.createdAt), 'h:mm a')}
                    </span>
                    {isOwn && (
                      msg.isRead
                        ? <CheckCheck className="w-3 h-3 text-pink-500" />
                        : <Check className="w-3 h-3 text-white/30" />
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Report modal */}
      {reportOpen && (
        <ReportModal
          userId={other.id}
          userName={other.firstName}
          onClose={() => setReportOpen(false)}
          onBlocked={() => navigate('/matches')}
        />
      )}

      {/* Video upload bar */}
      <div className="bg-gray-950 border-t border-white/10 px-4 py-4 pb-safe">
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-dashed border-white/15 hover:border-pink-500/50 bg-white/5 hover:bg-pink-500/5 transition-all disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/60 text-sm font-medium">Sending video…</span>
            </>
          ) : (
            <>
              <Video className="w-5 h-5 text-pink-400" />
              <span className="text-white/60 text-sm font-medium">Send a video</span>
            </>
          )}
        </motion.button>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) sendVideo(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
