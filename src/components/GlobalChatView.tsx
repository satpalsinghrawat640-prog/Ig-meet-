import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  Flag,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Send,
  ShieldAlert,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  adminModerateGlobalMessage,
  deleteOwnGlobalMessage,
  sendGlobalMessage,
  submitReport,
  toggleBlockUser,
  updateLastGlobalRead,
  uploadImageToStorage,
} from '../lib/igmeetService';
import {
  APP_ASSETS,
  formatTimestampTime,
  GlobalChatMessage,
  PublicProfile,
  VALIDATION,
} from '../types/igmeet';
import { Avatar, VerifiedTick } from './Avatar';

interface GlobalChatViewProps {
  currentUser: PublicProfile;
  isAdmin: boolean;
  blockedUsers: string[];
  allProfiles: PublicProfile[];
  onBack?: () => void;
  onSelectUserProfile: (profile: PublicProfile) => void;
}

export const GlobalChatView: React.FC<GlobalChatViewProps> = ({
  currentUser,
  isAdmin,
  blockedUsers,
  allProfiles,
  onBack,
  onSelectUserProfile,
}) => {
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLimit, setMsgLimit] = useState(50);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [lastSentAt, setLastSentAt] = useState(0);
  const [reportTarget, setReportTarget] = useState<GlobalChatMessage | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [toast, setToast] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileMap = React.useMemo(() => {
    const map = new Map<string, PublicProfile>();
    allProfiles.forEach((p) => map.set(p.uid, p));
    return map;
  }, [allProfiles]);

  useEffect(() => {
    const q = query(
      collection(db, 'globalChatMessages'),
      where('isRemoved', '==', false),
      limit(msgLimit)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: GlobalChatMessage[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<GlobalChatMessage, 'id'>) }))
          .sort((a, b) => (a.createdAt?.toMillis() || Date.now()) - (b.createdAt?.toMillis() || Date.now()));
        setMessages(list);
        setLoading(false);
        void updateLastGlobalRead(currentUser.uid);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'globalChatMessages');
      }
    );

    return () => unsub();
  }, [msgLimit, currentUser.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const now = Date.now();
    if (now - lastSentAt < 1200) {
      setError('Slow down slightly to avoid spam.');
      return;
    }

    setSending(true);
    setError('');
    try {
      await sendGlobalMessage({
        sender: currentUser,
        text,
        messageType: 'text',
      });
      setText('');
      setLastSentAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError('');
    setUploadPct(1);
    try {
      const url = await uploadImageToStorage({
        file,
        uid: currentUser.uid,
        folder: 'chatMedia',
        onProgress: setUploadPct,
      });
      await sendGlobalMessage({
        sender: currentUser,
        text: 'Shared a photo',
        messageType: 'image',
        mediaUrl: url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadPct(null);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    try {
      await submitReport({
        reporterId: currentUser.uid,
        reportedUserId: reportTarget.senderId,
        targetType: 'global_message',
        targetId: reportTarget.id,
        reason: reportReason,
      });
      setReportTarget(null);
      setReportReason('');
      showToast('Report submitted to administrators.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    }
  };

  const handleBlockSender = async (senderId: string, senderName: string) => {
    try {
      await toggleBlockUser(currentUser.uid, senderId, blockedUsers);
      showToast(`Blocked ${senderName}. Their messages are now hidden.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block user.');
    }
  };

  const visibleMessages = messages.filter((m) => !blockedUsers.includes(m.senderId));
  const onlineCount = allProfiles.filter((p) => p.onlineStatus && !p.isSuspended).length;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)]">
      {/* Header */}
      <header className="h-14 shrink-0 px-3 sm:px-4 flex items-center justify-between gap-3 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Messages"
              className="lg:hidden w-10 h-10 rounded-full hover:bg-[var(--bg-surface-tonal)] flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <img
            src={APP_ASSETS.globalChatEmblem}
            alt="Global Chat"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-[var(--border-hairline)] shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold font-display truncate">Global Chat</h2>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums truncate">
              {allProfiles.length} members · {onlineCount} online
            </p>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-medium">
          {toast}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError('')} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length >= msgLimit && (
          <div className="text-center pb-2">
            <button
              type="button"
              onClick={() => setMsgLimit((n) => n + 50)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading Global Chat...
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <p className="text-sm font-semibold font-display">No messages yet</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Be the first to greet everyone in IG Meet Global Chat.
            </p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isMine = msg.senderId === currentUser.uid;
            const liveProfile = profileMap.get(msg.senderId);
            const displayName = liveProfile?.displayName || msg.senderName;
            const photoURL = liveProfile?.photoURL ?? msg.senderPhoto;
            const profileColor = liveProfile?.profileColor || msg.senderColor;
            const isVerified = liveProfile?.isVerified ?? msg.senderVerified;

            if (msg.messageType === 'announcement') {
              return (
                <div
                  key={msg.id}
                  className="rounded-2xl p-4 bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--accent-primary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5" />
                      Official Announcement
                    </span>
                    <span className="tabular-nums opacity-80">
                      {formatTimestampTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2.5 group ${isMine ? 'flex-row-reverse' : ''}`}
              >
                {!isMine && (
                  <button
                    type="button"
                    onClick={() => liveProfile && onSelectUserProfile(liveProfile)}
                    className="cursor-pointer shrink-0"
                  >
                    <Avatar
                      name={displayName}
                      photoURL={photoURL}
                      profileColor={profileColor}
                      size="xs"
                    />
                  </button>
                )}

                <div className={`max-w-[78%] sm:max-w-[68%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {!isMine && (
                    <button
                      type="button"
                      onClick={() => liveProfile && onSelectUserProfile(liveProfile)}
                      className="flex items-center gap-1 mb-1 px-1 cursor-pointer hover:underline"
                    >
                      <span className="text-[11px] font-semibold" style={{ color: profileColor }}>
                        {displayName}
                      </span>
                      {isVerified && <VerifiedTick size="sm" />}
                    </button>
                  )}

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                      isMine
                        ? 'bg-[var(--accent-primary)] text-white rounded-br-md'
                        : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] rounded-bl-md'
                    }`}
                  >
                    {msg.messageType === 'image' && msg.mediaUrl && (
                      <img
                        src={msg.mediaUrl}
                        alt="Shared media"
                        referrerPolicy="no-referrer"
                        className="rounded-xl max-h-64 w-auto object-cover mb-2"
                      />
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-[var(--text-muted)]">
                    <span className="tabular-nums">{formatTimestampTime(msg.createdAt)}</span>
                    {!isMine && (
                      <>
                        <button
                          type="button"
                          onClick={() => setReportTarget(msg)}
                          title="Report message"
                          className="opacity-70 hover:opacity-100 hover:text-rose-500 inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <Flag className="w-3 h-3" />
                          Report
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBlockSender(msg.senderId, displayName)}
                          title="Block user"
                          className="opacity-70 hover:opacity-100 hover:text-rose-500 inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <UserX className="w-3 h-3" />
                          Block
                        </button>
                      </>
                    )}
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => deleteOwnGlobalMessage(msg.id)}
                        title="Delete message"
                        className="opacity-70 hover:opacity-100 hover:text-rose-500 inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {isAdmin && !isMine && (
                      <button
                        type="button"
                        onClick={() => adminModerateGlobalMessage(currentUser.uid, msg.id, msg.senderId)}
                        title="Moderator remove"
                        className="text-rose-500 hover:underline inline-flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <ShieldAlert className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Upload Progress */}
      {uploadPct !== null && (
        <div className="px-4 py-2 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] flex items-center gap-3 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
          <span className="tabular-nums">Uploading image {uploadPct}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface-tonal)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Input Composer */}
      {currentUser.isSuspended ? (
        <div className="p-4 text-center text-xs text-rose-500 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)]">
          Your account is currently suspended from posting messages.
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="p-3 pb-safe bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] flex items-center gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploadPct !== null}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Send photo"
            className="w-11 h-11 rounded-2xl bg-[var(--bg-surface-tonal)] hover:bg-[var(--accent-soft)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={text}
            maxLength={VALIDATION.MESSAGE_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message Global Chat..."
            className="flex-1 h-11 px-4 rounded-2xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
          />

          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Send message"
            className="w-11 h-11 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl p-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-display">Report message</h3>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="w-9 h-9 rounded-full hover:bg-[var(--bg-surface-tonal)] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Reporting message from <span className="font-semibold text-[var(--text-primary)]">{reportTarget.senderName}</span>
            </p>
            <form onSubmit={handleReportSubmit} className="space-y-3">
              <textarea
                rows={3}
                required
                minLength={3}
                maxLength={VALIDATION.REPORT_REASON_MAX}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe why this message violates IG Meet guidelines..."
                className="w-full p-3 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm resize-none focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
