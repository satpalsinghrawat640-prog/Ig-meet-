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
  Image as ImageIcon,
  Info,
  Loader2,
  Send,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  markPrivateChatRead,
  sendPrivateMessage,
  uploadImageToStorage,
} from '../lib/igmeetService';
import {
  formatRelativeTime,
  formatTimestampTime,
  PrivateMessage,
  PublicProfile,
  VALIDATION,
} from '../types/igmeet';
import { Avatar, VerifiedTick } from './Avatar';

interface PrivateChatViewProps {
  conversationId: string;
  currentUser: PublicProfile;
  otherUser: PublicProfile;
  isBlocked: boolean;
  onBack?: () => void;
  onOpenOtherProfile: (profile: PublicProfile) => void;
}

export const PrivateChatView: React.FC<PrivateChatViewProps> = ({
  conversationId,
  currentUser,
  otherUser,
  isBlocked,
  onBack,
  onOpenOtherProfile,
}) => {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLimit, setMsgLimit] = useState(50);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [participantA] = [currentUser.uid, otherUser.uid].sort();

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'privateChats', conversationId, 'messages'),
      where('participantIds', 'array-contains', currentUser.uid),
      limit(msgLimit)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PrivateMessage[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PrivateMessage, 'id'>) }))
          .sort((a, b) => (a.createdAt?.toMillis() || Date.now()) - (b.createdAt?.toMillis() || Date.now()));
        setMessages(list);
        setLoading(false);
        void markPrivateChatRead(conversationId, currentUser.uid, participantA);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, `privateChats/${conversationId}/messages`);
      }
    );

    return () => unsub();
  }, [conversationId, currentUser.uid, msgLimit, participantA]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending || isBlocked) return;
    setSending(true);
    setError('');
    try {
      await sendPrivateMessage({
        conversationId,
        sender: currentUser,
        recipientUid: otherUser.uid,
        text,
        messageType: 'text',
      });
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isBlocked) return;
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
      await sendPrivateMessage({
        conversationId,
        sender: currentUser,
        recipientUid: otherUser.uid,
        text: 'Photo',
        messageType: 'image',
        mediaUrl: url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadPct(null);
    }
  };

  const presenceSubtitle = otherUser.onlineStatus
    ? 'Online now'
    : otherUser.showLastSeen && otherUser.lastSeen
      ? `Last seen ${formatRelativeTime(otherUser.lastSeen)}`
      : `@${otherUser.username}`;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)]">
      {/* Header */}
      <header className="h-14 shrink-0 px-3 sm:px-4 flex items-center justify-between gap-2 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)]">
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
          <button
            type="button"
            onClick={() => onOpenOtherProfile(otherUser)}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
          >
            <Avatar
              name={otherUser.displayName}
              photoURL={otherUser.photoURL}
              profileColor={otherUser.profileColor}
              size="sm"
              online={otherUser.onlineStatus}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold font-display truncate">
                  {otherUser.displayName}
                </h2>
                {otherUser.isVerified && <VerifiedTick size="sm" />}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">{presenceSubtitle}</p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpenOtherProfile(otherUser)}
          aria-label="View profile details"
          className="w-10 h-10 rounded-full hover:bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer"
        >
          <Info className="w-5 h-5" />
        </button>
      </header>

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

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length >= msgLimit && (
          <div className="text-center pb-2">
            <button
              type="button"
              onClick={() => setMsgLimit((n) => n + 50)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] cursor-pointer"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading conversation...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <Avatar
              name={otherUser.displayName}
              photoURL={otherUser.photoURL}
              profileColor={otherUser.profileColor}
              size="lg"
              className="mx-auto"
            />
            <p className="text-sm font-semibold font-display pt-1">{otherUser.displayName}</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Private conversation. Only you and @{otherUser.username} can read these messages.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUser.uid;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[78%] sm:max-w-[68%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                    isMine
                      ? 'bg-[var(--accent-primary)] text-white rounded-br-md'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] rounded-bl-md'
                  }`}
                >
                  {msg.messageType === 'image' && msg.mediaUrl && (
                    <img
                      src={msg.mediaUrl}
                      alt="Private attachment"
                      referrerPolicy="no-referrer"
                      className="rounded-xl max-h-64 w-auto object-cover mb-2"
                    />
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                <span className="mt-1 px-1 text-[10px] text-[var(--text-muted)] tabular-nums">
                  {formatTimestampTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {uploadPct !== null && (
        <div className="px-4 py-2 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] flex items-center gap-3 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
          <span className="tabular-nums">Uploading image {uploadPct}%</span>
        </div>
      )}

      {/* Composer */}
      {isBlocked ? (
        <div className="p-4 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] border-t border-[var(--border-hairline)]">
          You have blocked this user. Unblock them from their profile to resume messaging.
        </div>
      ) : currentUser.isSuspended ? (
        <div className="p-4 text-center text-xs text-rose-500 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)]">
          Your account is currently suspended from sending messages.
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
            placeholder={`Message ${otherUser.displayName}...`}
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
    </div>
  );
};
