import React from 'react';
import { MessageCircle, Search, Users } from 'lucide-react';
import {
  APP_ASSETS,
  formatRelativeTime,
  GlobalChatMessage,
  PrivateChat,
  PublicProfile,
} from '../types/igmeet';
import { Avatar, VerifiedTick } from './Avatar';

interface MessagesViewProps {
  currentUser: PublicProfile;
  allProfiles: PublicProfile[];
  blockedUsers: string[];
  privateChats: PrivateChat[];
  latestGlobalMessage: GlobalChatMessage | null;
  globalUnreadCount: number;
  activeChatKey: string | null; // 'global' | conversationId | null
  onOpenGlobalChat: () => void;
  onOpenPrivateChat: (conversationId: string, otherProfile: PublicProfile) => void;
  onSelectUserProfile: (profile: PublicProfile) => void;
  onOpenDiscover: () => void;
}

/**
 * STRICT PART 7 MESSAGES SCREEN VERTICAL ORDER:
 * 1. FIRST: Horizontal User Profile Row (photos side-by-side, horizontally scrollable, names strictly UNDER photos)
 * 2. SECOND: Global Chat (visually prominent immediately below the horizontal profile row)
 * 3. THIRD: Personal / Active Chats list (sorted by latest activity)
 */
export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUser,
  allProfiles,
  blockedUsers,
  privateChats,
  latestGlobalMessage,
  globalUnreadCount,
  activeChatKey,
  onOpenGlobalChat,
  onOpenPrivateChat,
  onSelectUserProfile,
  onOpenDiscover,
}) => {
  const profileMap = React.useMemo(() => {
    const map = new Map<string, PublicProfile>();
    allProfiles.forEach((p) => map.set(p.uid, p));
    return map;
  }, [allProfiles]);

  // Users for top horizontal row: exclude blocked users, show online users first
  const horizontalUsers = React.useMemo(() => {
    return allProfiles
      .filter((p) => p.uid !== currentUser.uid && !p.isSuspended && !blockedUsers.includes(p.uid))
      .sort((a, b) => {
        if (a.onlineStatus !== b.onlineStatus) return a.onlineStatus ? -1 : 1;
        return (b.lastSeen?.toMillis() || 0) - (a.lastSeen?.toMillis() || 0);
      });
  }, [allProfiles, currentUser.uid, blockedUsers]);

  const onlineCount = React.useMemo(
    () => allProfiles.filter((p) => p.onlineStatus && !p.isSuspended).length,
    [allProfiles]
  );

  // Personal chats sorted strictly by latest activity descending
  const sortedChats = React.useMemo(() => {
    return [...privateChats]
      .filter((chat) => {
        const otherUid =
          chat.participantA === currentUser.uid ? chat.participantB : chat.participantA;
        return !blockedUsers.includes(otherUid);
      })
      .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
  }, [privateChats, currentUser.uid, blockedUsers]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] overflow-y-auto">
      {/* =================================================================== */}
      {/* 1. FIRST: HORIZONTAL USER PROFILE ROW (Names strictly UNDER photos) */}
      {/* =================================================================== */}
      <section aria-label="People on IG Meet" className="pt-3 pb-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="flex flex-nowrap items-start gap-3.5 overflow-x-auto no-scrollbar px-4 py-1">
          {/* Current user quick card */}
          <button
            type="button"
            onClick={() => onSelectUserProfile(currentUser)}
            className="flex flex-col items-center shrink-0 w-[68px] group cursor-pointer focus:outline-none"
          >
            <Avatar
              name={currentUser.displayName}
              photoURL={currentUser.photoURL}
              profileColor={currentUser.profileColor}
              size="lg"
              online={currentUser.onlineStatus}
              showRing
              className="transition-transform duration-150 group-active:scale-95"
            />
            <span className="mt-1.5 w-full text-center text-[11px] font-semibold text-[var(--text-primary)] truncate">
              You
            </span>
          </button>

          {horizontalUsers.map((user) => (
            <button
              key={user.uid}
              type="button"
              onClick={() => onSelectUserProfile(user)}
              className="flex flex-col items-center shrink-0 w-[68px] group cursor-pointer focus:outline-none"
            >
              <Avatar
                name={user.displayName}
                photoURL={user.photoURL}
                profileColor={user.profileColor}
                size="lg"
                online={user.onlineStatus}
                showRing={user.onlineStatus || user.isVerified}
                className="transition-transform duration-150 group-active:scale-95"
              />
              <span className="mt-1.5 w-full text-center text-[11px] font-medium text-[var(--text-primary)] truncate">
                {user.displayName.split(' ')[0]}
              </span>
            </button>
          ))}

          {horizontalUsers.length === 0 && (
            <button
              type="button"
              onClick={onOpenDiscover}
              className="flex flex-col items-center shrink-0 w-[68px] cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface-tonal)] flex items-center justify-center text-[var(--accent-primary)]">
                <Search className="w-5 h-5" />
              </div>
              <span className="mt-1.5 w-full text-center text-[11px] font-medium text-[var(--text-secondary)] truncate">
                Discover
              </span>
            </button>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. SECOND: GLOBAL CHAT (Visually Prominent Immediately Below Row)   */}
      {/* =================================================================== */}
      <section aria-label="Global Chat" className="px-4 pt-3.5 pb-2">
        <button
          type="button"
          onClick={onOpenGlobalChat}
          className={`w-full rounded-2xl p-3.5 text-left transition-all duration-150 flex items-center gap-3.5 border cursor-pointer active:scale-[0.99] ${
            activeChatKey === 'global'
              ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
              : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:border-[var(--accent-primary)]/50'
          }`}
        >
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[var(--border-hairline)] bg-[var(--bg-surface-tonal)]">
            <img
              src={APP_ASSETS.globalChatEmblem}
              alt="Global Chat"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-[15px] font-bold font-display text-[var(--text-primary)] truncate">
                  Global Chat
                </h2>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                {latestGlobalMessage?.createdAt
                  ? formatRelativeTime(latestGlobalMessage.createdAt)
                  : 'Live'}
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
              {latestGlobalMessage
                ? `${latestGlobalMessage.senderName}: ${
                    latestGlobalMessage.messageType === 'image'
                      ? 'Shared an image'
                      : latestGlobalMessage.text
                  }`
                : 'Welcome to IG Meet Global Chat — say hello!'}
            </p>

            <div className="flex items-center justify-between mt-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                <Users className="w-3 h-3" />
                {allProfiles.length} members · {onlineCount} online
              </span>
              {globalUnreadCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--accent-primary)] text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center">
                  {globalUnreadCount > 99 ? '99+' : globalUnreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      </section>

      {/* =================================================================== */}
      {/* 3. THIRD: PERSONAL / ACTIVE CHATS LIST                              */}
      {/* =================================================================== */}
      <section aria-label="Personal Chats" className="flex-1 px-4 pt-2 pb-24 lg:pb-6">
        <div className="flex items-center justify-between px-1 pb-2">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
            Personal Chats
          </h3>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {sortedChats.length} {sortedChats.length === 1 ? 'conversation' : 'conversations'}
          </span>
        </div>

        {sortedChats.length === 0 ? (
          <div className="rounded-2xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center space-y-3 mt-1">
            <div className="w-11 h-11 rounded-2xl mx-auto bg-[var(--bg-surface-tonal)] text-[var(--accent-primary)] flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold font-display">No personal chats yet</p>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
                Tap any user in the profile row above or search in Discover to start a private conversation.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDiscover}
              className="h-10 px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Find People
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
            {sortedChats.map((chat) => {
              const otherUid =
                chat.participantA === currentUser.uid ? chat.participantB : chat.participantA;
              const other = profileMap.get(otherUid);
              const unread =
                chat.participantA === currentUser.uid ? chat.unreadA : chat.unreadB;
              const displayName = other?.displayName || 'IG Meet User';
              const isSelected = activeChatKey === chat.conversationId;

              return (
                <button
                  key={chat.conversationId}
                  type="button"
                  onClick={() => {
                    if (other) {
                      onOpenPrivateChat(chat.conversationId, other);
                    }
                  }}
                  className={`w-full px-3.5 py-3 flex items-center gap-3.5 text-left transition-colors cursor-pointer min-h-[68px] ${
                    isSelected
                      ? 'bg-[var(--accent-soft)]'
                      : 'hover:bg-[var(--bg-surface-tonal)]/70'
                  }`}
                >
                  <Avatar
                    name={displayName}
                    photoURL={other?.photoURL}
                    profileColor={other?.profileColor}
                    size="md"
                    online={Boolean(other?.onlineStatus)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {displayName}
                        </span>
                        {other?.isVerified && <VerifiedTick size="sm" />}
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                        {formatRelativeTime(chat.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate ${
                          unread > 0
                            ? 'font-semibold text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {chat.lastSenderId === currentUser.uid ? 'You: ' : ''}
                        {chat.lastMessage || 'Start chatting...'}
                      </p>

                      {unread > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--accent-primary)] text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center shrink-0">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
