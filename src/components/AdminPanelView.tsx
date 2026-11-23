import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  AlertCircle,
  Ban,
  BarChart3,
  Check,
  CheckCircle2,
  CreditCard,
  Flag,
  Loader2,
  Lock,
  Megaphone,
  RotateCcw,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  adminModerateGlobalMessage,
  adminPublishAnnouncement,
  adminResolveReport,
  adminReviewSubscription,
  adminSaveSubscriptionPlan,
  adminToggleUserSuspension,
} from '../lib/igmeetService';
import {
  AdminAuditLog,
  AdminInitDoc,
  formatFullDate,
  formatRelativeTime,
  GlobalChatMessage,
  PlanId,
  PublicProfile,
  ReportRecord,
  SubscriptionPlan,
  SubscriptionRecord,
} from '../types/igmeet';
import { Avatar, VerifiedTick } from './Avatar';

interface AdminPanelViewProps {
  adminProfile: PublicProfile;
  allProfiles: PublicProfile[];
  plans: SubscriptionPlan[];
  initialSection?: AdminSection;
}

export type AdminSection =
  | 'dashboard'
  | 'users'
  | 'subscriptions'
  | 'moderation'
  | 'announcements'
  | 'security';

const TIER_IDS: PlanId[] = ['tier_1', 'tier_2', 'tier_3'];

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  adminProfile,
  allProfiles,
  plans,
  initialSection = 'dashboard',
}) => {
  const [section, setSection] = useState<AdminSection>(initialSection);
  const [allSubs, setAllSubs] = useState<SubscriptionRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [recentGlobal, setRecentGlobal] = useState<GlobalChatMessage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [initLock, setInitLock] = useState<AdminInitDoc | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Editable Plan forms (3 tiers)
  const [planForms, setPlanForms] = useState<
    Record<
      PlanId,
      { name: string; description: string; priceLabel: string; durationDays: number; isActive: boolean }
    >
  >({
    tier_1: {
      name: 'Tier 1 Verification',
      description: 'Official Blue Verification Tick for your IG Meet profile.',
      priceLabel: '',
      durationDays: 30,
      isActive: true,
    },
    tier_2: {
      name: 'Tier 2 Verification',
      description: 'Extended Blue Verification Tick subscription for active members.',
      priceLabel: '',
      durationDays: 90,
      isActive: true,
    },
    tier_3: {
      name: 'Tier 3 Verification',
      description: 'Long-term Blue Verification Tick membership across IG Meet.',
      priceLabel: '',
      durationDays: 365,
      isActive: true,
    },
  });

  // Announcement composer
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annAlsoGlobal, setAnnAlsoGlobal] = useState(true);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  // Sync existing plans into editable forms
  useEffect(() => {
    if (plans.length === 0) return;
    setPlanForms((prev) => {
      const next = { ...prev };
      plans.forEach((p) => {
        next[p.planId] = {
          name: p.name,
          description: p.description,
          priceLabel: p.priceLabel,
          durationDays: p.durationDays,
          isActive: p.isActive,
        };
      });
      return next;
    });
  }, [plans]);

  // Live Admin Listeners
  useEffect(() => {
    const unsubSubs = onSnapshot(
      query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => {
        setAllSubs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionRecord, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
    );

    const unsubReports = onSnapshot(
      query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportRecord, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
    );

    const unsubGlobal = onSnapshot(
      query(collection(db, 'globalChatMessages'), orderBy('createdAt', 'desc'), limit(40)),
      (snap) => {
        setRecentGlobal(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GlobalChatMessage, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'globalChatMessages')
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => {
        setAuditLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminAuditLog, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'adminAuditLogs')
    );

    const unsubInit = onSnapshot(
      doc(db, 'admin', 'initialization'),
      (snap) => {
        if (snap.exists()) {
          setInitLock(snap.data() as AdminInitDoc);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'admin/initialization')
    );

    return () => {
      unsubSubs();
      unsubReports();
      unsubGlobal();
      unsubLogs();
      unsubInit();
    };
  }, []);

  const profileMap = React.useMemo(() => {
    const map = new Map<string, PublicProfile>();
    allProfiles.forEach((p) => map.set(p.uid, p));
    return map;
  }, [allProfiles]);

  const showNotice = (msg: string) => {
    setError('');
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const handleSavePlan = async (planId: PlanId, sortOrder: number) => {
    setBusyId(planId);
    setError('');
    try {
      const form = planForms[planId];
      await adminSaveSubscriptionPlan(adminProfile.uid, {
        planId,
        name: form.name,
        description: form.description,
        priceLabel: form.priceLabel,
        durationDays: Number(form.durationDays) || 30,
        isActive: form.isActive,
        sortOrder,
      });
      showNotice(`Saved ${form.name} configuration.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setBusyId('');
    }
  };

  const handleReviewSub = async (
    sub: SubscriptionRecord,
    decision: 'active' | 'expired' | 'rejected'
  ) => {
    setBusyId(sub.id);
    setError('');
    try {
      const plan = plans.find((p) => p.planId === sub.planId);
      await adminReviewSubscription({
        adminUid: adminProfile.uid,
        record: sub,
        decision,
        durationDays: plan?.durationDays || 30,
      });
      showNotice(`Updated subscription ${sub.paymentReference} to ${decision}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription review failed.');
    } finally {
      setBusyId('');
    }
  };

  const handleSuspendToggle = async (target: PublicProfile) => {
    setBusyId(target.uid);
    setError('');
    try {
      await adminToggleUserSuspension(adminProfile.uid, target, !target.isSuspended);
      showNotice(
        `${target.isSuspended ? 'Restored' : 'Suspended'} @${target.username}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account status.');
    } finally {
      setBusyId('');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId('announcement');
    setError('');
    try {
      await adminPublishAnnouncement({
        adminProfile,
        title: annTitle,
        body: annBody,
        alsoPostToGlobal: annAlsoGlobal,
      });
      setAnnTitle('');
      setAnnBody('');
      showNotice('Official announcement published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish announcement.');
    } finally {
      setBusyId('');
    }
  };

  const filteredUsers = allProfiles.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  const onlineUsersCount = allProfiles.filter((u) => u.onlineStatus).length;
  const verifiedUsersCount = allProfiles.filter((u) => u.isVerified).length;
  const pendingSubsCount = allSubs.filter((s) => s.status === 'pending_verification').length;
  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  const tabs: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'moderation', label: 'Moderation', icon: Flag },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'security', label: 'Audit & Lock', icon: Lock },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] overflow-y-auto pb-24 lg:pb-10">
      {/* Admin Sub-Nav */}
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] px-4 py-3">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--accent-primary)]" />
              <h1 className="text-base font-bold font-display">IG Meet Admin Panel</h1>
            </div>
            <span className="text-xs font-semibold text-[var(--accent-primary)]">
              {adminProfile.role === 'main_admin' ? 'Main Admin' : 'Admin'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = section === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSection(t.id)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto px-4 pt-5 space-y-5">
        {notice && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. DASHBOARD */}
        {section === 'dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                <p className="text-xs text-[var(--text-secondary)]">Registered Users</p>
                <p className="text-2xl font-bold font-display tabular-nums mt-1">
                  {allProfiles.length}
                </p>
              </div>
              <div className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                <p className="text-xs text-[var(--text-secondary)]">Active Online</p>
                <p className="text-2xl font-bold font-display tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                  {onlineUsersCount}
                </p>
              </div>
              <div className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                <p className="text-xs text-[var(--text-secondary)]">Verified Blue Ticks</p>
                <p className="text-2xl font-bold font-display tabular-nums mt-1">
                  {verifiedUsersCount}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5">
                  {pendingSubsCount} pending review
                </p>
              </div>
              <div className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                <p className="text-xs text-[var(--text-secondary)]">Open Reports</p>
                <p className="text-2xl font-bold font-display tabular-nums mt-1 text-rose-500">
                  {openReportsCount}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5">
                  {recentGlobal.length} recent global msgs
                </p>
              </div>
            </div>

            <div className="rounded-2xl p-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-3">
              <h2 className="text-sm font-bold font-display">Quick Actions</h2>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setSection('subscriptions')}
                  className="h-10 px-4 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-semibold cursor-pointer"
                >
                  Configure 3 Subscription Plans ({plans.length}/3 set)
                </button>
                <button
                  type="button"
                  onClick={() => setSection('moderation')}
                  className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
                >
                  Review Open Reports ({openReportsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSection('announcements')}
                  className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
                >
                  Publish Official Announcement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. USER MANAGEMENT */}
        {section === 'users' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by display name, username, or UID..."
                className="w-full h-11 pl-10 pr-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
              {filteredUsers.map((u) => (
                <div
                  key={u.uid}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={u.displayName}
                      photoURL={u.photoURL}
                      profileColor={u.profileColor}
                      size="sm"
                      online={u.onlineStatus}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{u.displayName}</span>
                        {u.isVerified && <VerifiedTick size="sm" />}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        @{u.username} · Role: {u.role} ·{' '}
                        {u.isSuspended ? 'Suspended' : 'Active'}
                      </p>
                    </div>
                  </div>

                  {u.role === 'main_admin' ? (
                    <span className="text-xs font-semibold text-[var(--text-muted)] inline-flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Protected Main Admin
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === u.uid}
                      onClick={() => handleSuspendToggle(u)}
                      className={`h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        u.isSuspended
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {busyId === u.uid ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : u.isSuspended ? (
                        <RotateCcw className="w-3.5 h-3.5" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                      {u.isSuspended ? 'Restore Account' : 'Suspend Account'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. SUBSCRIPTIONS MANAGEMENT */}
        {section === 'subscriptions' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-bold font-display">
                Configure the 3 Official Subscription Tiers
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TIER_IDS.map((tierId, idx) => {
                  const form = planForms[tierId];
                  return (
                    <div
                      key={tierId}
                      className="rounded-2xl p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-3"
                    >
                      <p className="text-xs font-bold text-[var(--accent-primary)]">
                        Plan Slot 0{idx + 1} ({tierId})
                      </p>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                          Plan Name
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={form.name}
                          onChange={(e) =>
                            setPlanForms((p) => ({
                              ...p,
                              [tierId]: { ...p[tierId], name: e.target.value },
                            }))
                          }
                          className="w-full h-9 px-3 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                          Price / Billing Label (configured by you)
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={form.priceLabel}
                          placeholder="e.g. Set your price here"
                          onChange={(e) =>
                            setPlanForms((p) => ({
                              ...p,
                              [tierId]: { ...p[tierId], priceLabel: e.target.value },
                            }))
                          }
                          className="w-full h-9 px-3 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                          Duration (days)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={form.durationDays}
                          onChange={(e) =>
                            setPlanForms((p) => ({
                              ...p,
                              [tierId]: { ...p[tierId], durationDays: Number(e.target.value) },
                            }))
                          }
                          className="w-full h-9 px-3 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-xs tabular-nums"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          maxLength={400}
                          value={form.description}
                          onChange={(e) =>
                            setPlanForms((p) => ({
                              ...p,
                              [tierId]: { ...p[tierId], description: e.target.value },
                            }))
                          }
                          className="w-full p-2.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-xs resize-none"
                        />
                      </div>

                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) =>
                            setPlanForms((p) => ({
                              ...p,
                              [tierId]: { ...p[tierId], isActive: e.target.checked },
                            }))
                          }
                          className="accent-[var(--accent-primary)]"
                        />
                        Active & visible to users
                      </label>

                      <button
                        type="button"
                        disabled={busyId === tierId}
                        onClick={() => handleSavePlan(tierId, idx + 1)}
                        className="w-full h-10 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {busyId === tierId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Plan {idx + 1}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold font-display">
                Payment Verification Queue & Subscriptions ({allSubs.length})
              </h2>
              {allSubs.length === 0 ? (
                <div className="rounded-2xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] text-center">
                  No subscription verification requests yet.
                </div>
              ) : (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
                  {allSubs.map((sub) => {
                    const user = profileMap.get(sub.uid);
                    return (
                      <div
                        key={sub.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold">
                            {user ? `${user.displayName} (@${user.username})` : sub.uid}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                            {sub.planName} · Ref: <span className="font-semibold">{sub.paymentReference}</span> · Status: {sub.status}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            Submitted {formatFullDate(sub.createdAt)}
                            {sub.expiresAt ? ` · Expires ${formatFullDate(sub.expiresAt)}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {sub.status !== 'active' && (
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleReviewSub(sub, 'active')}
                              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Verify & Grant Tick
                            </button>
                          )}
                          {sub.status === 'active' && (
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleReviewSub(sub, 'expired')}
                              className="h-9 px-3 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold cursor-pointer"
                            >
                              Mark Expired
                            </button>
                          )}
                          {sub.status === 'pending_verification' && (
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleReviewSub(sub, 'rejected')}
                              className="h-9 px-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. MODERATION */}
        {section === 'moderation' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-bold font-display">User & Message Reports</h2>
              {reports.length === 0 ? (
                <div className="rounded-2xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] text-center">
                  No reports submitted.
                </div>
              ) : (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
                  {reports.map((rep) => {
                    const reported = profileMap.get(rep.reportedUserId);
                    return (
                      <div
                        key={rep.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-[var(--accent-primary)]">
                            {rep.targetType} · Status: {rep.status}
                          </p>
                          <p className="text-sm font-medium">{rep.reason}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            Reported user: {reported ? `@${reported.username}` : rep.reportedUserId} ·{' '}
                            {formatRelativeTime(rep.createdAt)}
                          </p>
                        </div>

                        {rep.status === 'open' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => adminResolveReport(adminProfile.uid, rep.id, 'resolved')}
                              className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                adminResolveReport(adminProfile.uid, rep.id, 'dismissed')
                              }
                              className="h-9 px-3 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold font-display">Recent Global Chat Messages</h2>
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
                {recentGlobal.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {msg.senderName}{' '}
                        <span className="font-normal text-[var(--text-muted)] tabular-nums">
                          · {formatRelativeTime(msg.createdAt)}
                        </span>
                      </p>
                      <p
                        className={`truncate mt-0.5 ${
                          msg.isRemoved
                            ? 'italic text-[var(--text-muted)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {msg.text}
                      </p>
                    </div>
                    {!msg.isRemoved && (
                      <button
                        type="button"
                        onClick={() =>
                          adminModerateGlobalMessage(adminProfile.uid, msg.id, msg.senderId)
                        }
                        className="h-8 px-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold shrink-0 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. ANNOUNCEMENTS */}
        {section === 'announcements' && (
          <form
            onSubmit={handlePublishAnnouncement}
            className="rounded-3xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4 max-w-2xl"
          >
            <h2 className="text-base font-bold font-display">Publish Official Announcement</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Title</label>
              <input
                type="text"
                required
                maxLength={120}
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Important IG Meet update"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Message</label>
              <textarea
                rows={4}
                required
                maxLength={1000}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Write your official announcement..."
                className="w-full p-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm resize-none"
              />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={annAlsoGlobal}
                onChange={(e) => setAnnAlsoGlobal(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              Also post announcement banner in Global Chat
            </label>
            <button
              type="submit"
              disabled={busyId === 'announcement'}
              className="h-11 px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {busyId === 'announcement' && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Announcement
            </button>
          </form>
        )}

        {/* 6. ADMIN SECURITY & AUDIT LOGS */}
        {section === 'security' && (
          <div className="space-y-5">
            <div className="rounded-2xl p-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold font-display">
                <Lock className="w-4 h-4 text-[var(--accent-primary)]" />
                One-Time Main Admin Initialization Lock
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Status:{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {initLock?.initialized ? 'Initialized & Permanently Locked' : 'Pending first initialization'}
                </span>
              </p>
              {initLock && (
                <p className="text-xs text-[var(--text-muted)] tabular-nums">
                  Main Admin UID: {initLock.mainAdminUid} · Locked on{' '}
                  {formatFullDate(initLock.initializedAt)}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <h2 className="text-sm font-bold font-display">Immutable Admin Audit Logs</h2>
              {auditLogs.length === 0 ? (
                <div className="rounded-2xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] text-center">
                  No audit log entries recorded yet.
                </div>
              ) : (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--accent-primary)]">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-[var(--text-primary)]">{log.details}</p>
                      <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        Admin: {log.adminUid} · Target: {log.targetId}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
