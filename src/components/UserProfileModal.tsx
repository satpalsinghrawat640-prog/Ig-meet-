import React, { useState } from 'react';
import { Calendar, Flag, MessageCircle, ShieldCheck, UserX, X } from 'lucide-react';
import { submitReport, toggleBlockUser } from '../lib/igmeetService';
import {
  formatFullDate,
  formatRelativeTime,
  getContrastTextColor,
  PublicProfile,
  VALIDATION,
} from '../types/igmeet';
import { Avatar, VerifiedTick } from './Avatar';

interface UserProfileModalProps {
  profile: PublicProfile;
  currentUser: PublicProfile;
  blockedUsers: string[];
  onClose: () => void;
  onStartChat: (target: PublicProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  profile,
  currentUser,
  blockedUsers,
  onClose,
  onStartChat,
}) => {
  const isSelf = profile.uid === currentUser.uid;
  const isBlocked = blockedUsers.includes(profile.uid);
  const contrast = getContrastTextColor(profile.profileColor);

  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const handleBlock = async () => {
    setBusy(true);
    try {
      await toggleBlockUser(currentUser.uid, profile.uid, blockedUsers);
      setStatusMsg(isBlocked ? 'User unblocked.' : 'User blocked.');
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submitReport({
        reporterId: currentUser.uid,
        reportedUserId: profile.uid,
        targetType: 'user',
        targetId: profile.uid,
        reason,
      });
      setReporting(false);
      setReason('');
      setStatusMsg('Report submitted to administrators.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Custom Profile Color Banner */}
        <div
          className="relative px-6 pt-5 pb-12"
          style={{ backgroundColor: profile.profileColor, color: contrast }}
        >
          <div className="w-10 h-1 rounded-full bg-current opacity-25 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-90">
              {profile.onlineStatus
                ? 'Online now'
                : profile.showLastSeen && profile.lastSeen
                  ? `Active ${formatRelativeTime(profile.lastSeen)}`
                  : 'IG Meet Member'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile"
              className="w-9 h-9 rounded-full bg-black/15 hover:bg-black/25 flex items-center justify-center cursor-pointer"
              style={{ color: contrast }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Profile Body */}
        <div className="px-6 pb-6 -mt-10 space-y-4">
          <div className="flex items-end justify-between">
            <Avatar
              name={profile.displayName}
              photoURL={profile.photoURL}
              profileColor={profile.profileColor}
              size="xl"
              online={profile.onlineStatus}
              className="ring-4 ring-[var(--bg-surface)]"
            />
            {profile.role !== 'user' && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)]">
                <ShieldCheck className="w-4 h-4" />
                {profile.role === 'main_admin' ? 'Main Admin' : 'Admin'}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold font-display">{profile.displayName}</h3>
              {profile.isVerified && <VerifiedTick size="md" />}
            </div>
            <p className="text-sm text-[var(--text-secondary)]">@{profile.username}</p>
          </div>

          {profile.bio && (
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)] pt-1 border-t border-[var(--border-hairline)]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Joined {formatFullDate(profile.createdAt)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Verification: {profile.isVerified ? 'Verified' : 'Standard'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Plan: {profile.subscriptionStatus === 'active' ? 'Active' : profile.subscriptionStatus === 'expired' ? 'Expired' : 'Free'}
            </span>
          </div>

          {statusMsg && (
            <div className="p-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-medium">
              {statusMsg}
            </div>
          )}

          {!isSelf && !reporting && (
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={isBlocked}
                onClick={() => {
                  onStartChat(profile);
                  onClose();
                }}
                className="flex-1 h-11 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleBlock}
                className="h-11 px-3.5 rounded-xl bg-[var(--bg-surface-tonal)] hover:bg-rose-500/10 text-[var(--text-primary)] hover:text-rose-500 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserX className="w-4 h-4" />
                {isBlocked ? 'Unblock' : 'Block'}
              </button>
              <button
                type="button"
                onClick={() => setReporting(true)}
                aria-label="Report user"
                className="w-11 h-11 rounded-xl bg-[var(--bg-surface-tonal)] hover:bg-rose-500/10 text-[var(--text-secondary)] hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          )}

          {reporting && (
            <form onSubmit={handleReport} className="space-y-3 pt-1">
              <textarea
                rows={3}
                required
                minLength={3}
                maxLength={VALIDATION.REPORT_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for reporting this user..."
                className="w-full p-3 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm resize-none focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReporting(false)}
                  className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 px-4 rounded-xl bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
