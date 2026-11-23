import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Search, Users, X } from 'lucide-react';
import { PublicProfile } from '../types/igmeet';
import { Avatar, VerifiedTick } from './Avatar';

interface DiscoverViewProps {
  currentUser: PublicProfile;
  allProfiles: PublicProfile[];
  blockedUsers: string[];
  onSelectUserProfile: (profile: PublicProfile) => void;
  onStartChat: (profile: PublicProfile) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  currentUser,
  allProfiles,
  blockedUsers,
  onSelectUserProfile,
  onStartChat,
}) => {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const searchTimestamps = useRef<number[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = rawQuery.trim().toLowerCase();
      if (trimmed) {
        const now = Date.now();
        searchTimestamps.current = searchTimestamps.current.filter((t) => now - t < 10000);
        if (searchTimestamps.current.length >= 25) {
          setRateLimited(true);
          return;
        }
        searchTimestamps.current.push(now);
        setRateLimited(false);
      } else {
        setRateLimited(false);
      }
      setDebouncedQuery(trimmed);
    }, 220);

    return () => clearTimeout(timer);
  }, [rawQuery]);

  const results = useMemo(() => {
    const eligible = allProfiles.filter(
      (p) => p.uid !== currentUser.uid && !p.isSuspended && !blockedUsers.includes(p.uid)
    );
    if (!debouncedQuery) {
      return eligible.sort((a, b) => {
        if (a.onlineStatus !== b.onlineStatus) return a.onlineStatus ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
    }
    const cleanQ = debouncedQuery.replace(/^@/, '');
    return eligible.filter(
      (p) =>
        p.username.toLowerCase().includes(cleanQ) ||
        p.displayName.toLowerCase().includes(cleanQ)
    );
  }, [allProfiles, currentUser.uid, blockedUsers, debouncedQuery]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] overflow-y-auto pb-24 lg:pb-8">
      <div className="sticky top-0 z-10 px-4 py-3.5 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-hairline)]">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rawQuery}
              maxLength={60}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search by display name or @username..."
              className="w-full h-11 pl-10 pr-10 rounded-2xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
            />
            {rawQuery && (
              <button
                type="button"
                onClick={() => setRawQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {rateLimited && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Search limit reached briefly. Please pause a few seconds before searching again.
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl w-full mx-auto px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-[var(--text-secondary)]">
            {debouncedQuery ? `Matches for "${debouncedQuery}"` : 'People on IG Meet'}
          </h2>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {results.length} {results.length === 1 ? 'person' : 'people'}
          </span>
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl p-8 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl mx-auto bg-[var(--bg-surface-tonal)] text-[var(--text-muted)] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold font-display">No matching users found</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {debouncedQuery
                ? 'Try a different display name or username.'
                : 'New users who join IG Meet will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map((person) => (
              <div
                key={person.uid}
                className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onSelectUserProfile(person)}
                  className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer"
                >
                  <Avatar
                    name={person.displayName}
                    photoURL={person.photoURL}
                    profileColor={person.profileColor}
                    size="md"
                    online={person.onlineStatus}
                    showRing={person.isVerified}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {person.displayName}
                      </span>
                      {person.isVerified && <VerifiedTick size="sm" />}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      @{person.username}
                    </p>
                    {person.bio && (
                      <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                        {person.bio}
                      </p>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartChat(person)}
                  aria-label={`Message ${person.displayName}`}
                  className="h-10 px-3.5 rounded-xl bg-[var(--accent-soft)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
