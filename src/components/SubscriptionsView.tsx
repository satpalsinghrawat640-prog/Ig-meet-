import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { submitSubscriptionVerificationRequest } from '../lib/igmeetService';
import {
  formatFullDate,
  PlanId,
  PublicProfile,
  SubscriptionPlan,
  SubscriptionRecord,
  VALIDATION,
} from '../types/igmeet';
import { VerifiedTick } from './Avatar';

interface SubscriptionsViewProps {
  currentUser: PublicProfile;
  plans: SubscriptionPlan[];
  userSubscriptions: SubscriptionRecord[];
  isAdmin: boolean;
  onOpenAdminSubscriptions?: () => void;
}

const DEFAULT_SLOT_IDS: PlanId[] = ['tier_1', 'tier_2', 'tier_3'];

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  currentUser,
  plans,
  userSubscriptions,
  isAdmin,
  onOpenAdminSubscriptions,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const planById = React.useMemo(() => {
    const map = new Map<PlanId, SubscriptionPlan>();
    plans.forEach((p) => map.set(p.planId, p));
    return map;
  }, [plans]);

  const sortedHistory = React.useMemo(
    () =>
      [...userSubscriptions].sort(
        (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      ),
    [userSubscriptions]
  );

  const activeSub = sortedHistory.find((s) => s.status === 'active');
  const pendingSub = sortedHistory.find((s) => s.status === 'pending_verification');

  const handleSubmitPaymentRef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await submitSubscriptionVerificationRequest({
        uid: currentUser.uid,
        plan: selectedPlan,
        paymentReference,
      });
      setSuccess(
        'Payment reference submitted. Your Blue Verification Tick will activate automatically once verified by the backend administrator.'
      );
      setPaymentReference('');
      setSelectedPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment verification.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] overflow-y-auto pb-24 lg:pb-10">
      <div className="max-w-4xl w-full mx-auto px-4 pt-5 space-y-6">
        {/* Status Header */}
        <section className="rounded-3xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display">Blue Tick Verification</h1>
              <VerifiedTick size="md" />
            </div>
            <p className="text-sm text-[var(--text-secondary)] max-w-xl">
              Subscribe to one of three official IG Meet plans to earn a backend-verified Blue Verification Tick across your profile, Global Chat, and personal chats.
            </p>
          </div>

          <div className="shrink-0 rounded-2xl px-4 py-3 bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-left sm:text-right">
            <p className="text-xs text-[var(--text-muted)]">Current Status</p>
            <p className="text-sm font-bold font-display mt-0.5 flex items-center sm:justify-end gap-1.5">
              {currentUser.isVerified ? (
                <>
                  <VerifiedTick size="sm" />
                  <span>Verified Active</span>
                </>
              ) : pendingSub ? (
                <>
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Pending Verification</span>
                </>
              ) : currentUser.subscriptionStatus === 'expired' ? (
                <span className="text-rose-500">Expired</span>
              ) : (
                <span>Not Verified</span>
              )}
            </p>
            {activeSub?.expiresAt && (
              <p className="text-[11px] text-[var(--text-secondary)] tabular-nums mt-0.5">
                Valid until {formatFullDate(activeSub.expiresAt)}
              </p>
            )}
          </div>
        </section>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* EXACTLY THREE SUBSCRIPTION PLAN CARDS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold font-display">Three Official Subscription Tiers</h2>
            {isAdmin && onOpenAdminSubscriptions && (
              <button
                type="button"
                onClick={onOpenAdminSubscriptions}
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                Configure in Admin Panel
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DEFAULT_SLOT_IDS.map((slotId, index) => {
              const plan = planById.get(slotId);
              const isConfigured = Boolean(plan && plan.isActive);
              const isCurrentActivePlan = activeSub?.planId === slotId;

              return (
                <div
                  key={slotId}
                  className={`rounded-3xl p-5 bg-[var(--bg-surface)] border flex flex-col justify-between gap-5 ${
                    isCurrentActivePlan
                      ? 'border-[var(--accent-primary)]'
                      : 'border-[var(--border-hairline)]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-muted)]">
                        Tier 0{index + 1}
                      </span>
                      <VerifiedTick size="sm" />
                    </div>

                    <div>
                      <h3 className="text-lg font-bold font-display">
                        {plan ? plan.name : `Plan ${index + 1}`}
                      </h3>
                      <p className="text-sm font-semibold text-[var(--accent-primary)] mt-1 tabular-nums">
                        {plan?.priceLabel || 'Configured by Admin'}
                      </p>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {plan
                        ? plan.description
                        : 'This subscription tier has not yet been configured by the IG Meet administrator.'}
                    </p>

                    <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1.5 text-xs text-[var(--text-primary)]">
                      <div className="flex items-center gap-2">
                        <VerifiedTick size="sm" />
                        <span>Official Blue Verification Tick</span>
                      </div>
                      {plan && (
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          Duration: {plan.durationDays} days · Backend verified
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isConfigured || Boolean(pendingSub)}
                    onClick={() => {
                      if (plan) {
                        setSelectedPlan(plan);
                        setError('');
                      }
                    }}
                    className={`w-full h-11 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isCurrentActivePlan
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white'
                    }`}
                  >
                    {isCurrentActivePlan
                      ? 'Active Plan'
                      : !isConfigured
                        ? 'Awaiting Admin Setup'
                        : pendingSub
                          ? 'Verification Pending'
                          : 'Submit Payment for Verification'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Backend Security Notice */}
        <section className="rounded-2xl p-4 bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] flex items-start gap-3 text-xs text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Verification status is strictly enforced by Firebase Security Rules and backend administrator approval. Users cannot manually activate their own Blue Verification Tick.
          </p>
        </section>

        {/* Subscription History */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold font-display px-1">Subscription History</h2>
          {sortedHistory.length === 0 ? (
            <div className="rounded-2xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-secondary)]">
              No subscription records yet.
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] overflow-hidden">
              {sortedHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.planName}</p>
                    <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                      Ref: {item.paymentReference} · Submitted {formatFullDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="text-xs font-semibold sm:text-right">
                    <span
                      className={
                        item.status === 'active'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.status === 'pending_verification'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {item.status === 'pending_verification'
                        ? 'Pending Backend Verification'
                        : item.status === 'active'
                          ? 'Active Verified'
                          : item.status === 'expired'
                            ? 'Expired'
                            : 'Rejected'}
                    </span>
                    {item.expiresAt && (
                      <p className="text-[11px] font-normal text-[var(--text-muted)] tabular-nums">
                        Expires {formatFullDate(item.expiresAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Payment Verification Submission Modal */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-display">Verify Payment Reference</h3>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="w-9 h-9 rounded-full hover:bg-[var(--bg-surface-tonal)] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-tonal)] space-y-1 text-xs">
              <p className="font-semibold text-sm">{selectedPlan.name}</p>
              <p className="text-[var(--text-secondary)]">
                {selectedPlan.priceLabel || 'Standard Tier'} · {selectedPlan.durationDays} days · Blue Verification Tick
              </p>
            </div>

            <form onSubmit={handleSubmitPaymentRef} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Payment Transaction / Receipt Reference ID
                </label>
                <input
                  type="text"
                  required
                  minLength={VALIDATION.PAYMENT_REF_MIN}
                  maxLength={VALIDATION.PAYMENT_REF_MAX}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Enter verified order or receipt ID"
                  className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <p className="text-[11px] text-[var(--text-muted)]">
                  Submitted in pending state. An administrator verifies the payment before activating your Blue Tick.
                </p>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit for Backend Verification
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
