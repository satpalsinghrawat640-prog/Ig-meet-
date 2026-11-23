import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  deleteNotification,
  markNotificationRead,
  updatePrivacySettings,
} from '../lib/igmeetService';
import {
  Announcement,
  AppNotification,
  formatRelativeTime,
  PublicProfile,
} from '../types/igmeet';

interface NotificationsViewProps {
  currentUser: PublicProfile;
  notifications: AppNotification[];
  announcements: Announcement[];
  onNavigateLink: (linkTarget: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  currentUser,
  notifications,
  announcements,
  onNavigateLink,
}) => {
  const [permState, setPermState] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [statusNote, setStatusNote] = useState('');

  const handleEnableBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') {
      setStatusNote('Browser push notifications are not supported in this context.');
      return;
    }
    const result = await Notification.requestPermission();
    setPermState(result);
    if (result === 'granted') {
      const deviceToken = `web_${currentUser.uid.slice(0, 12)}_${Date.now()}`;
      await updatePrivacySettings(currentUser.uid, { fcmToken: deviceToken });
      setStatusNote('Device notifications enabled and registered.');
    } else {
      setStatusNote('Notification permission was not granted.');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => markNotificationRead(n.id)));
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] overflow-y-auto pb-24 lg:pb-10">
      <div className="max-w-3xl w-full mx-auto px-4 pt-5 space-y-6">
        {/* Push Permission Card */}
        <section className="rounded-3xl p-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold font-display">Notifications & Alerts</h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Receive real-time alerts for private messages, subscription verifications, and official announcements.
              </p>
              {statusNote && (
                <p className="text-xs text-[var(--accent-primary)] mt-1.5 font-medium">
                  {statusNote}
                </p>
              )}
            </div>
          </div>

          {permState !== 'granted' && permState !== 'unsupported' && (
            <button
              type="button"
              onClick={handleEnableBrowserAlerts}
              className="h-10 px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              Enable Alerts
            </button>
          )}
        </section>

        {/* Official Admin Announcements */}
        {announcements.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] px-1">
              Official Announcements
            </h2>
            <div className="space-y-2.5">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="rounded-2xl p-4 bg-[var(--accent-soft)] border border-[var(--accent-primary)]/25 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold font-display text-[var(--accent-primary)]">
                      <Megaphone className="w-4 h-4" />
                      {ann.title}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      {formatRelativeTime(ann.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                    {ann.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Personal Notifications List */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)]">
              Recent Activity
            </h2>
            {notifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="rounded-2xl p-8 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl mx-auto bg-[var(--bg-surface-tonal)] text-[var(--text-muted)] flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold font-display">You are all caught up</p>
              <p className="text-xs text-[var(--text-secondary)]">
                New private messages and account updates will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
              {notifications.map((item) => {
                const Icon =
                  item.type === 'private_message'
                    ? MessageCircle
                    : item.type === 'subscription'
                      ? ShieldCheck
                      : item.type === 'announcement'
                        ? Megaphone
                        : Bell;

                return (
                  <div
                    key={item.id}
                    className={`p-4 flex items-start gap-3 transition-colors ${
                      !item.read ? 'bg-[var(--accent-soft)]/50' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-tonal)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.read) void markNotificationRead(item.id);
                        if (item.linkTarget) onNavigateLink(item.linkTarget);
                      }}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{item.title}</p>
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                        {item.body}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNotification(item.id)}
                      aria-label="Delete notification"
                      className="w-9 h-9 rounded-lg hover:bg-[var(--bg-surface-tonal)] text-[var(--text-muted)] hover:text-rose-500 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
