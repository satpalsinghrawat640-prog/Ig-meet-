import type { Timestamp } from 'firebase/firestore';

export type AppTheme = 'light_pink' | 'eye_comfort_dark';
export type UserRole = 'user' | 'admin' | 'main_admin';
export type SubscriptionStatus = 'none' | 'active' | 'expired';
export type SubscriptionRecordStatus = 'pending_verification' | 'active' | 'expired' | 'rejected';
export type PlanId = 'tier_1' | 'tier_2' | 'tier_3';
export type AppTab = 'messages' | 'discover' | 'notifications' | 'subscriptions' | 'profile' | 'admin';

export interface PublicProfile {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string;
  bio: string;
  profileColor: string;
  isVerified: boolean;
  subscriptionStatus: SubscriptionStatus;
  role: UserRole;
  isSuspended: boolean;
  onlineStatus: boolean;
  showLastSeen: boolean;
  lastSeen: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserPrivate {
  uid: string;
  email: string;
  theme: AppTheme;
  onboardingCompleted: boolean;
  blockedUsers: string[];
  fcmToken: string;
  allowPrivateMessages: boolean;
  lastGlobalReadAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface GlobalChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  senderColor: string;
  senderVerified: boolean;
  text: string;
  messageType: 'text' | 'image' | 'announcement';
  mediaUrl: string;
  isRemoved: boolean;
  createdAt: Timestamp | null;
}

export interface PrivateChat {
  conversationId: string;
  participantA: string;
  participantB: string;
  participantIds: string[];
  lastMessage: string;
  lastSenderId: string;
  unreadA: number;
  unreadB: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PrivateMessage {
  id: string;
  senderId: string;
  participantIds: string[];
  text: string;
  messageType: 'text' | 'image';
  mediaUrl: string;
  createdAt: Timestamp | null;
}

export interface SubscriptionPlan {
  planId: PlanId;
  name: string;
  description: string;
  priceLabel: string;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
  updatedAt: Timestamp | null;
}

export interface SubscriptionRecord {
  id: string;
  uid: string;
  planId: PlanId;
  planName: string;
  status: SubscriptionRecordStatus;
  paymentReference: string;
  verifiedBy: string;
  startedAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reportedUserId: string;
  targetType: 'user' | 'global_message' | 'private_message';
  targetId: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  type: 'private_message' | 'global_chat' | 'subscription' | 'announcement' | 'account';
  linkTarget: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorId: string;
  isActive: boolean;
  createdAt: Timestamp | null;
}

export interface AdminAuditLog {
  id: string;
  adminUid: string;
  action: string;
  targetId: string;
  details: string;
  createdAt: Timestamp | null;
}

export interface AdminInitDoc {
  initialized: boolean;
  mainAdminUid: string;
  initializedAt: Timestamp | null;
}

// Validation constants synchronized verbatim with firebase-blueprint.json
export const VALIDATION = {
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 60,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  USERNAME_REGEX: /^[a-z0-9_]+$/,
  HEX_COLOR_REGEX: /^#[0-9A-Fa-f]{6}$/,
  BIO_MAX: 240,
  MESSAGE_MAX: 1000,
  PAYMENT_REF_MIN: 3,
  PAYMENT_REF_MAX: 120,
  REPORT_REASON_MIN: 3,
  REPORT_REASON_MAX: 500,
  MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
} as const;

export const PROFILE_COLOR_PRESETS = [
  { name: 'Rose Berry', hex: '#E11D6C' },
  { name: 'Coral Sunset', hex: '#E84A5F' },
  { name: 'Plum Velvet', hex: '#9D174D' },
  { name: 'Royal Indigo', hex: '#4F46E5' },
  { name: 'Ocean Slate', hex: '#0284C7' },
  { name: 'Emerald Pine', hex: '#059669' },
  { name: 'Warm Amber', hex: '#D97706' },
  { name: 'Obsidian Ink', hex: '#27272A' },
] as const;

export const APP_ASSETS = {
  logo: '/src/assets/images/ig_meet_logo_1795429570550.jpg',
  globalChatEmblem: '/src/assets/images/global_chat_emblem_1795429570008.jpg',
} as const;

/**
 * Calculates WCAG relative luminance to return guaranteed high-contrast text color (#FFFFFF or #1A1015).
 */
export function getContrastTextColor(hex: string): '#FFFFFF' | '#1A1015' {
  if (!VALIDATION.HEX_COLOR_REGEX.test(hex)) return '#FFFFFF';
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.42 ? '#1A1015' : '#FFFFFF';
}

export function formatRelativeTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffSec < 604800) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatFullDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimestampTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
