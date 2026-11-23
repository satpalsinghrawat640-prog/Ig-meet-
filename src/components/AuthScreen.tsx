import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  checkUsernameAvailable,
  completeUserOnboarding,
  sanitizeUsername,
} from '../lib/igmeetService';
import {
  APP_ASSETS,
  AppTheme,
  getContrastTextColor,
  PROFILE_COLOR_PRESETS,
  VALIDATION,
} from '../types/igmeet';
import { Avatar } from './Avatar';

interface AuthScreenProps {
  firebaseUser: User | null;
  needsOnboarding: boolean;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onOnboardingSuccess: (becameMainAdmin: boolean) => void;
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);
  if (code === 'auth/popup-closed-by-user') return 'Sign-in window was closed before completing.';
  if (code === 'auth/cancelled-popup-request') return 'Another sign-in popup is already open.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }
  if (code === 'auth/user-not-found') return 'No account found with this email address.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters long.';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method) for project ig-meet. Use Google Sign-In or enable Email/Password in Firebase Console.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return msg;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  firebaseUser,
  needsOnboarding,
  theme,
  onThemeChange,
  onOnboardingSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Onboarding state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profileColor, setProfileColor] = useState<string>(PROFILE_COLOR_PRESETS[0].hex);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  useEffect(() => {
    if (firebaseUser && needsOnboarding) {
      const initialName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '';
      setDisplayName(initialName.slice(0, VALIDATION.DISPLAY_NAME_MAX));
      const suggested = sanitizeUsername(
        (firebaseUser.email?.split('@')[0] || initialName || 'user') +
          Math.floor(10 + Math.random() * 89)
      );
      setUsername(suggested.length >= 3 ? suggested : `ig_${suggested}12`);
    }
  }, [firebaseUser, needsOnboarding]);

  useEffect(() => {
    if (!needsOnboarding || !firebaseUser?.emailVerified) return;
    const clean = sanitizeUsername(username);
    if (!clean || clean.length < VALIDATION.USERNAME_MIN || !VALIDATION.USERNAME_REGEX.test(clean)) {
      setUsernameStatus(username ? 'invalid' : 'idle');
      return;
    }
    let cancelled = false;
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const free = await checkUsernameAvailable(clean);
        if (!cancelled) setUsernameStatus(free ? 'available' : 'taken');
      } catch {
        if (!cancelled) setUsernameStatus('idle');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, needsOnboarding, firebaseUser?.emailVerified]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    setInfoMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfoMessage('');
    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setInfoMessage('Password reset email sent. Check your inbox to reset your password.');
        setMode('login');
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
        setInfoMessage('Verification link sent to your email. Please verify to continue.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    setError('');
    try {
      await sendEmailVerification(firebaseUser);
      setInfoMessage('A fresh verification email has been sent.');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    setError('');
    try {
      await firebaseUser.reload();
      if (auth.currentUser?.emailVerified) {
        window.location.reload();
      } else {
        setError('Your email is still not verified yet. Please click the link in your inbox first.');
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setBusy(true);
    setError('');
    try {
      const result = await completeUserOnboarding({
        user: firebaseUser,
        displayName,
        username,
        bio,
        profileColor,
        theme,
        photoURL: firebaseUser.photoURL || '',
      });
      onOnboardingSuccess(result.becameMainAdmin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile.');
    } finally {
      setBusy(false);
    }
  };

  // GATE 1: Email Verification Required for Email/Password accounts
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="w-full max-w-md rounded-3xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold font-display">Verify your email</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              We sent a verification link to <span className="font-semibold text-[var(--text-primary)]">{firebaseUser.email}</span>. Verify your email address to protect your IG Meet account.
            </p>
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {infoMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={handleRefreshVerification}
              className="w-full h-12 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              I have verified my email
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleResendVerification}
              className="w-full h-11 rounded-xl bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] font-medium text-sm transition-colors cursor-pointer"
            >
              Resend verification email
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full h-10 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Sign out and use another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // GATE 2: First-Time Onboarding Profile Setup
  if (firebaseUser && needsOnboarding) {
    const contrast = getContrastTextColor(profileColor);
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="w-full max-w-lg rounded-3xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
          {/* Live Custom Profile Color Preview Header */}
          <div
            className="p-6 transition-colors duration-200"
            style={{ backgroundColor: profileColor, color: contrast }}
          >
            <div className="flex items-center gap-4">
              <Avatar
                name={displayName || 'IG'}
                photoURL={firebaseUser.photoURL || ''}
                profileColor={profileColor}
                size="lg"
                className="ring-2 ring-white/40"
              />
              <div className="min-w-0">
                <p className="text-xs opacity-85 font-medium">Set up your IG Meet profile</p>
                <h1 className="text-xl font-bold font-display truncate">
                  {displayName || 'Your Name'}
                </h1>
                <p className="text-xs opacity-90 truncate">
                  @{sanitizeUsername(username) || 'username'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCompleteOnboarding} className="p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Display Name
              </label>
              <input
                type="text"
                required
                maxLength={VALIDATION.DISPLAY_NAME_MAX}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How friends see you"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Unique Username
                </label>
                <span className="text-xs font-medium">
                  {usernameStatus === 'checking' && (
                    <span className="text-[var(--text-muted)]">Checking...</span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-emerald-600 dark:text-emerald-400">Available</span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-rose-600 dark:text-rose-400">Already taken</span>
                  )}
                  {usernameStatus === 'invalid' && (
                    <span className="text-amber-600 dark:text-amber-400">3–30 chars (a-z, 0-9, _)</span>
                  )}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">@</span>
                <input
                  type="text"
                  required
                  maxLength={VALIDATION.USERNAME_MAX}
                  value={username}
                  onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                  placeholder="your_handle"
                  className="w-full h-11 pl-8 pr-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Bio (optional)
              </label>
              <textarea
                rows={2}
                maxLength={VALIDATION.BIO_MAX}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Say hello to the IG Meet community..."
                className="w-full p-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm resize-none focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            {/* Profile Color Customization */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Profile Accent Color
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                {PROFILE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setProfileColor(preset.hex)}
                    title={preset.name}
                    aria-label={preset.name}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer border-2"
                    style={{
                      backgroundColor: preset.hex,
                      borderColor: profileColor === preset.hex ? 'var(--text-primary)' : 'transparent',
                    }}
                  >
                    {profileColor === preset.hex && (
                      <Check
                        className="w-4 h-4"
                        style={{ color: getContrastTextColor(preset.hex) }}
                      />
                    )}
                  </button>
                ))}
                <label className="w-9 h-9 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-tonal)] flex items-center justify-center cursor-pointer overflow-hidden text-xs font-semibold">
                  <input
                    type="color"
                    value={profileColor}
                    onChange={(e) => setProfileColor(e.target.value)}
                    className="opacity-0 absolute w-0 h-0"
                    aria-label="Pick custom profile color"
                  />
                  +
                </label>
              </div>
            </div>

            {/* Free Theme Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                App Theme (Free for all users)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onThemeChange('light_pink')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    theme === 'light_pink'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface-tonal)]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <Sun className="w-4 h-4 text-rose-500" />
                    Light Pink
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">Soft rose canvas</p>
                </button>
                <button
                  type="button"
                  onClick={() => onThemeChange('eye_comfort_dark')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    theme === 'eye_comfort_dark'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface-tonal)]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <Moon className="w-4 h-4 text-rose-400" />
                    Eye-Comfort Dark
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">Deep black + pink</p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || usernameStatus === 'taken' || usernameStatus === 'invalid'}
              className="w-full h-12 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enter IG Meet
              {!busy && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // GATE 3: Login / Registration / Google Sign-In
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Left Brand Showcase on Desktop */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[var(--bg-surface-tonal)] border-r border-[var(--border-hairline)]">
        <div className="flex items-center gap-3">
          <img
            src={APP_ASSETS.logo}
            alt="IG Meet"
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-2xl object-cover border border-[var(--border-hairline)]"
          />
          <span className="text-xl font-extrabold font-display tracking-tight">IG Meet</span>
        </div>

        <div className="max-w-md space-y-5">
          <h1 className="text-4xl font-extrabold font-display tracking-tight leading-tight text-balance">
            Meet, chat, and connect in real time.
          </h1>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed">
            Jump into the live Global Chat, start private one-to-one conversations, personalize your profile colors, and switch seamlessly between Light Pink and Eye-Comfort Dark themes.
          </p>
          <div className="flex items-center gap-4 pt-2 text-xs text-[var(--text-secondary)]">
            <span>Global Chat</span>
            <span aria-hidden="true">·</span>
            <span>Private Messaging</span>
            <span aria-hidden="true">·</span>
            <span>Verified Blue Tick Tiers</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>IG Meet Social Platform</span>
          <button
            type="button"
            onClick={() =>
              onThemeChange(theme === 'light_pink' ? 'eye_comfort_dark' : 'light_pink')
            }
            className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
          >
            {theme === 'light_pink' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            {theme === 'light_pink' ? 'Eye-Comfort Dark' : 'Light Pink'}
          </button>
        </div>
      </div>

      {/* Right / Mobile Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Brand Header */}
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <img
                src={APP_ASSETS.logo}
                alt="IG Meet"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-2xl object-cover border border-[var(--border-hairline)]"
              />
              <div>
                <h1 className="text-xl font-extrabold font-display tracking-tight">IG Meet</h1>
                <p className="text-xs text-[var(--text-secondary)]">Real-time social chat</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onThemeChange(theme === 'light_pink' ? 'eye_comfort_dark' : 'light_pink')
              }
              aria-label="Switch theme"
              className="w-11 h-11 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center cursor-pointer"
            >
              {theme === 'light_pink' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>

          <div className="rounded-3xl p-6 sm:p-7 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold font-display">
                {mode === 'login'
                  ? 'Welcome back'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Reset password'}
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {mode === 'login'
                  ? 'Sign in to continue your conversations on IG Meet.'
                  : mode === 'register'
                    ? 'Join IG Meet to chat globally and connect privately.'
                    : 'Enter your email and we will send a reset link.'}
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* Primary Real Google Sign-In */}
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="w-full h-12 rounded-xl bg-[var(--bg-surface-tonal)] hover:bg-[var(--accent-soft)] border border-[var(--border-hairline)] font-semibold text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <div className="flex-1 h-px bg-[var(--border-hairline)]" />
              <span>or use email</span>
              <div className="flex-1 h-px bg-[var(--border-hairline)]" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError('');
                          setInfoMessage('');
                        }}
                        className="text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                    ? 'Create Account'
                    : 'Send Reset Link'}
              </button>
            </form>

            <div className="text-center text-xs text-[var(--text-secondary)] pt-1">
              {mode === 'login' ? (
                <>
                  New to IG Meet?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError('');
                      setInfoMessage('');
                    }}
                    className="font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setInfoMessage('');
                    }}
                    className="font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
