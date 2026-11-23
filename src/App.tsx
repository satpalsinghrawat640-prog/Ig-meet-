import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  BadgeCheck,
  Bell,
  Compass,
  MessageCircle,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  ensurePrivateChat,
  updateUserPresence,
  updateUserTheme,
} from './lib/igmeetService';
import {
  Announcement,
  APP_ASSETS,
  AppNotification,
  AppTab,
  AppTheme,
  GlobalChatMessage,
  PrivateChat,
  PublicProfile,
  SubscriptionPlan,
  SubscriptionRecord,
  UserPrivate,
} from './types/igmeet';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { Avatar } from './components/Avatar';
import { MessagesView } from './components/MessagesView';
import { GlobalChatView } from './components/GlobalChatView';
import { PrivateChatView } from './components/PrivateChatView';
import { DiscoverView } from './components/DiscoverView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { AdminPanelView, AdminSection } from './components/AdminPanelView';
import { UserProfileModal } from './components/UserProfileModal';

const BOOTSTRAPPED_ADMIN_EMAIL = 'satpalsinghrawat640@gmail.com';
const THEME_STORAGE_KEY = 'ig_meet_theme';

function applyThemeToDOM(theme: AppTheme) {
  const root = document.documentElement;
  if (theme === 'eye_comfort_dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'eye_comfort_dark' ? '#090709' : '#FFF7FA');
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

function IGMeetApp() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'eye_comfort_dark' || saved === 'light_pink') return saved;
    } catch {
      // ignore
    }
    return 'light_pink';
  });

  const [splashDone, setSplashDone] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<PublicProfile | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);

  // Real-time app data
  const [allProfiles, setAllProfiles] = useState<PublicProfile[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [recentGlobalMsgs, setRecentGlobalMsgs] = useState<GlobalChatMessage[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubs, setUserSubs] = useState<SubscriptionRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<AppTab>('messages');
  const [activeChat, setActiveChat] = useState<
    { type: 'global' } | { type: 'private'; conversationId: string; otherUid: string } | null
  >(null);
  const [selectedProfileModal, setSelectedProfileModal] = useState<PublicProfile | null>(null);
  const [adminInitialSection, setAdminInitialSection] = useState<AdminSection>('dashboard');
  const [welcomeBanner, setWelcomeBanner] = useState('');

  // Sync theme immediately to DOM
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Brief non-blocking splash timer (never permanent!)
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 700);
    return () => clearTimeout(timer);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setCurrentUser(null);
        setUserPrivate(null);
        setHasAdminDoc(false);
        setActiveChat(null);
        setProfileLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Own profile + private prefs + admin status listeners (only when verified auth)
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    let profileResolved = false;
    let privateResolved = false;

    const checkReady = () => {
      if (profileResolved && privateResolved) setProfileLoading(false);
    };

    const unsubProfile = onSnapshot(
      doc(db, 'publicProfiles', firebaseUser.uid),
      (snap) => {
        setCurrentUser(snap.exists() ? (snap.data() as PublicProfile) : null);
        profileResolved = true;
        checkReady();
      },
      (err) => {
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, `publicProfiles/${firebaseUser.uid}`);
      }
    );

    const unsubPrivate = onSnapshot(
      doc(db, 'userPrivate', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserPrivate;
          setUserPrivate(data);
          if (data.theme === 'light_pink' || data.theme === 'eye_comfort_dark') {
            setTheme(data.theme);
          }
        } else {
          setUserPrivate(null);
        }
        privateResolved = true;
        checkReady();
      },
      (err) => {
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, `userPrivate/${firebaseUser.uid}`);
      }
    );

    const unsubAdmin = onSnapshot(
      doc(db, 'admins', firebaseUser.uid),
      (snap) => setHasAdminDoc(snap.exists()),
      () => setHasAdminDoc(false)
    );

    return () => {
      unsubProfile();
      unsubPrivate();
      unsubAdmin();
    };
  }, [firebaseUser]);

  const isAdmin = Boolean(
    firebaseUser?.emailVerified &&
      (hasAdminDoc ||
        currentUser?.role === 'admin' ||
        currentUser?.role === 'main_admin' ||
        firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL)
  );

  // Presence lifecycle
  useEffect(() => {
    if (!currentUser) return;
    void updateUserPresence(currentUser.uid, true);

    const onVisibility = () => {
      void updateUserPresence(currentUser.uid, document.visibilityState === 'visible');
    };
    const onBeforeUnload = () => {
      void updateUserPresence(currentUser.uid, false);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [currentUser?.uid]);

  // Real-time Firestore collections (only after onboarding completed)
  useEffect(() => {
    if (!currentUser || !userPrivate?.onboardingCompleted) return;

    const profilesQuery = isAdmin
      ? query(collection(db, 'publicProfiles'), limit(150))
      : query(collection(db, 'publicProfiles'), where('isSuspended', '==', false), limit(150));

    const unsubProfiles = onSnapshot(
      profilesQuery,
      (snap) => setAllProfiles(snap.docs.map((d) => d.data() as PublicProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'publicProfiles')
    );

    const unsubChats = onSnapshot(
      query(
        collection(db, 'privateChats'),
        where('participantIds', 'array-contains', currentUser.uid)
      ),
      (snap) => setPrivateChats(snap.docs.map((d) => d.data() as PrivateChat)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'privateChats')
    );

    const unsubGlobalPreview = onSnapshot(
      query(
        collection(db, 'globalChatMessages'),
        where('isRemoved', '==', false),
        limit(100)
      ),
      (snap) =>
        setRecentGlobalMsgs(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<GlobalChatMessage, 'id'>) }))
            .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'globalChatMessages')
    );

    const plansQuery = isAdmin
      ? query(collection(db, 'subscriptionPlans'))
      : query(collection(db, 'subscriptionPlans'), where('isActive', '==', true));

    const unsubPlans = onSnapshot(
      plansQuery,
      (snap) => setPlans(snap.docs.map((d) => d.data() as SubscriptionPlan)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptionPlans')
    );

    const unsubUserSubs = onSnapshot(
      query(collection(db, 'subscriptions'), where('uid', '==', currentUser.uid)),
      (snap) =>
        setUserSubs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionRecord, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
    );

    const unsubNotifs = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('recipientId', '==', currentUser.uid),
        limit(100)
      ),
      (snap) =>
        setNotifications(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
            .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubAnn = onSnapshot(
      query(
        collection(db, 'announcements'),
        where('isActive', '==', true),
        limit(20)
      ),
      (snap) =>
        setAnnouncements(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
            .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
    );

    return () => {
      unsubProfiles();
      unsubChats();
      unsubGlobalPreview();
      unsubPlans();
      unsubUserSubs();
      unsubNotifs();
      unsubAnn();
    };
  }, [currentUser?.uid, userPrivate?.onboardingCompleted, isAdmin]);

  const handleThemeChange = (next: AppTheme) => {
    setTheme(next);
    if (currentUser) {
      void updateUserTheme(currentUser.uid, next);
    }
  };

  const handleStartPrivateChat = async (target: PublicProfile) => {
    if (!currentUser || target.uid === currentUser.uid) return;
    const conversationId = await ensurePrivateChat(currentUser.uid, target.uid);
    setActiveTab('messages');
    setActiveChat({ type: 'private', conversationId, otherUid: target.uid });
  };

  const handleNavigateNotificationLink = (linkTarget: string) => {
    if (linkTarget.startsWith('private:')) {
      const conversationId = linkTarget.replace('private:', '');
      const chat = privateChats.find((c) => c.conversationId === conversationId);
      if (chat && currentUser) {
        const otherUid =
          chat.participantA === currentUser.uid ? chat.participantB : chat.participantA;
        setActiveTab('messages');
        setActiveChat({ type: 'private', conversationId, otherUid });
        return;
      }
      setActiveTab('messages');
    } else if (linkTarget === 'subscriptions') {
      setActiveTab('subscriptions');
    } else if (linkTarget === 'profile') {
      setActiveTab('profile');
    } else if (linkTarget === 'global') {
      setActiveTab('messages');
      setActiveChat({ type: 'global' });
    }
  };

  const latestGlobalMessage = recentGlobalMsgs[0] || null;
  const globalUnreadCount = useMemo(() => {
    if (!currentUser || !userPrivate?.lastGlobalReadAt) return 0;
    const lastReadMs = userPrivate.lastGlobalReadAt.toMillis();
    return recentGlobalMsgs.filter(
      (m) =>
        m.senderId !== currentUser.uid &&
        !userPrivate.blockedUsers.includes(m.senderId) &&
        (m.createdAt?.toMillis() || 0) > lastReadMs
    ).length;
  }, [recentGlobalMsgs, currentUser, userPrivate]);

  const totalPrivateUnread = useMemo(() => {
    if (!currentUser) return 0;
    return privateChats.reduce((sum, chat) => {
      const count = chat.participantA === currentUser.uid ? chat.unreadA : chat.unreadB;
      return sum + count;
    }, 0);
  }, [privateChats, currentUser]);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // 1. Splash screen while initializing
  if (!splashDone || !authReady || profileLoading) {
    return <SplashScreen />;
  }

  // 2. Auth / Verification / Onboarding gate
  const needsOnboarding = Boolean(
    firebaseUser?.emailVerified && (!currentUser || !userPrivate?.onboardingCompleted)
  );
  if (!firebaseUser || !firebaseUser.emailVerified || needsOnboarding || !currentUser || !userPrivate) {
    return (
      <AuthScreen
        firebaseUser={firebaseUser}
        needsOnboarding={needsOnboarding}
        theme={theme}
        onThemeChange={handleThemeChange}
        onOnboardingSuccess={(becameMainAdmin) => {
          if (becameMainAdmin) {
            setWelcomeBanner(
              'First account registered: Main Admin privileges were atomically initialized and permanently locked to your account.'
            );
          }
        }}
      />
    );
  }

  const activePrivateOther =
    activeChat?.type === 'private'
      ? allProfiles.find((p) => p.uid === activeChat.otherUid) || null
      : null;

  const navItems: {
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageCircle,
      badge: totalPrivateUnread + globalUnreadCount,
    },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadNotifCount },
    { id: 'subscriptions', label: 'Verified', icon: BadgeCheck },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    ...(isAdmin ? [{ id: 'admin' as AppTab, label: 'Admin', icon: Shield }] : []),
  ];

  const isMobileChatOpen = activeTab === 'messages' && activeChat !== null;

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-hidden">
      {/* DESKTOP LEFT NAVIGATION RAIL */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-hairline)] p-4 justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 pt-1">
            <img
              src={APP_ASSETS.logo}
              alt="IG Meet"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-2xl object-cover border border-[var(--border-hairline)]"
            />
            <span className="text-lg font-extrabold font-display tracking-tight whitespace-nowrap">
              IG Meet
            </span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full h-11 px-3.5 rounded-2xl text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--accent-primary)] text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Current User Trigger */}
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className="p-2.5 rounded-2xl bg-[var(--bg-surface-tonal)] hover:bg-[var(--accent-soft)] flex items-center gap-3 text-left transition-colors cursor-pointer"
        >
          <Avatar
            name={currentUser.displayName}
            photoURL={currentUser.photoURL}
            profileColor={currentUser.profileColor}
            size="sm"
            online={currentUser.onlineStatus}
          />
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{currentUser.displayName}</p>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              @{currentUser.username}
            </p>
          </div>
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* MOBILE TOP APP BAR (Compact 54px, hidden when inside an open mobile chat screen) */}
        {!isMobileChatOpen && (
          <header className="lg:hidden h-[54px] shrink-0 px-4 flex items-center justify-between bg-[var(--bg-surface)] border-b border-[var(--border-hairline)]">
            <div className="flex items-center gap-2.5">
              <img
                src={APP_ASSETS.logo}
                alt="IG Meet"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl object-cover border border-[var(--border-hairline)]"
              />
              <span className="text-base font-extrabold font-display tracking-tight">
                {activeTab === 'messages'
                  ? 'IG Meet'
                  : activeTab === 'discover'
                    ? 'Discover'
                    : activeTab === 'notifications'
                      ? 'Alerts'
                      : activeTab === 'subscriptions'
                        ? 'Verification'
                        : activeTab === 'admin'
                          ? 'Admin'
                          : 'Profile'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              aria-label="Open profile"
              className="cursor-pointer"
            >
              <Avatar
                name={currentUser.displayName}
                photoURL={currentUser.photoURL}
                profileColor={currentUser.profileColor}
                size="xs"
                online={currentUser.onlineStatus}
              />
            </button>
          </header>
        )}

        {/* First-User Main Admin Initialization Banner */}
        {welcomeBanner && (
          <div className="px-4 py-2.5 bg-[var(--accent-soft)] border-b border-[var(--border-hairline)] flex items-center justify-between gap-3 text-xs text-[var(--accent-primary)] font-medium">
            <span>{welcomeBanner}</span>
            <button
              type="button"
              onClick={() => setWelcomeBanner('')}
              className="font-bold cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Suspended Banner */}
        {currentUser.isSuspended && (
          <div className="px-4 py-2.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-semibold text-center">
            Your account is currently suspended. Messaging is disabled pending administrator review.
          </div>
        )}

        {/* ACTIVE TAB STAGE */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'messages' && (
            <div className="h-full flex">
              {/* Left Column (Full screen on mobile when no chat open, 390px split pane on desktop) */}
              <div
                className={`${
                  isMobileChatOpen ? 'hidden lg:flex' : 'flex'
                } flex-col w-full lg:w-[390px] xl:w-[420px] shrink-0 lg:border-r border-[var(--border-hairline)] h-full`}
              >
                <MessagesView
                  currentUser={currentUser}
                  allProfiles={allProfiles}
                  blockedUsers={userPrivate.blockedUsers}
                  privateChats={privateChats}
                  latestGlobalMessage={latestGlobalMessage}
                  globalUnreadCount={globalUnreadCount}
                  activeChatKey={
                    activeChat?.type === 'global'
                      ? 'global'
                      : activeChat?.type === 'private'
                        ? activeChat.conversationId
                        : null
                  }
                  onOpenGlobalChat={() => setActiveChat({ type: 'global' })}
                  onOpenPrivateChat={(conversationId, other) =>
                    setActiveChat({ type: 'private', conversationId, otherUid: other.uid })
                  }
                  onSelectUserProfile={(profile) => setSelectedProfileModal(profile)}
                  onOpenDiscover={() => setActiveTab('discover')}
                />
              </div>

              {/* Right Conversation Stage */}
              <div
                className={`${
                  isMobileChatOpen ? 'flex' : 'hidden lg:flex'
                } flex-col flex-1 min-w-0 h-full`}
              >
                {activeChat?.type === 'global' ? (
                  <GlobalChatView
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    blockedUsers={userPrivate.blockedUsers}
                    allProfiles={allProfiles}
                    onBack={() => setActiveChat(null)}
                    onSelectUserProfile={(profile) => setSelectedProfileModal(profile)}
                  />
                ) : activeChat?.type === 'private' && activePrivateOther ? (
                  <PrivateChatView
                    conversationId={activeChat.conversationId}
                    currentUser={currentUser}
                    otherUser={activePrivateOther}
                    isBlocked={userPrivate.blockedUsers.includes(activePrivateOther.uid)}
                    onBack={() => setActiveChat(null)}
                    onOpenOtherProfile={(profile) => setSelectedProfileModal(profile)}
                  />
                ) : (
                  <div className="hidden lg:flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                    <img
                      src={APP_ASSETS.globalChatEmblem}
                      alt="IG Meet Conversations"
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-3xl object-cover border border-[var(--border-hairline)]"
                    />
                    <div className="space-y-1 max-w-sm">
                      <h2 className="text-lg font-bold font-display">Select a conversation</h2>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Jump into Global Chat or pick any member from the horizontal profile row to message privately.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveChat({ type: 'global' })}
                      className="h-11 px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold cursor-pointer"
                    >
                      Open Global Chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'discover' && (
            <DiscoverView
              currentUser={currentUser}
              allProfiles={allProfiles}
              blockedUsers={userPrivate.blockedUsers}
              onSelectUserProfile={(p) => setSelectedProfileModal(p)}
              onStartChat={handleStartPrivateChat}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              currentUser={currentUser}
              notifications={notifications}
              announcements={announcements}
              onNavigateLink={handleNavigateNotificationLink}
            />
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionsView
              currentUser={currentUser}
              plans={plans}
              userSubscriptions={userSubs}
              isAdmin={isAdmin}
              onOpenAdminSubscriptions={() => {
                setAdminInitialSection('subscriptions');
                setActiveTab('admin');
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              profile={currentUser}
              userPrivate={userPrivate}
              allProfiles={allProfiles}
              theme={theme}
              onThemeChange={handleThemeChange}
              onOpenSubscriptions={() => setActiveTab('subscriptions')}
            />
          )}

          {activeTab === 'admin' && isAdmin && (
            <AdminPanelView
              adminProfile={currentUser}
              allProfiles={allProfiles}
              plans={plans}
              initialSection={adminInitialSection}
            />
          )}
        </main>

        {/* MOBILE FIXED BOTTOM NAVIGATION BAR (Hidden while inside a full-screen mobile chat) */}
        {!isMobileChatOpen && (
          <nav
            aria-label="Primary Navigation"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-hairline)] pb-safe"
          >
            <div
              className="grid items-center h-14"
              style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex flex-col items-center justify-center h-full min-w-[44px] transition-colors cursor-pointer ${
                      active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-5 h-5" />
                      {item.badge && item.badge > 0 ? (
                        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-primary)] text-white text-[10px] font-bold tabular-nums inline-flex items-center justify-center">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-semibold mt-0.5 truncate max-w-full px-0.5">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {/* User Profile Sheet / Modal */}
      {selectedProfileModal && (
        <UserProfileModal
          profile={selectedProfileModal}
          currentUser={currentUser}
          blockedUsers={userPrivate.blockedUsers}
          onClose={() => setSelectedProfileModal(null)}
          onStartChat={handleStartPrivateChat}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <IGMeetApp />
    </ErrorBoundary>
  );
}
