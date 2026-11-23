import React, { useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  AlertCircle,
  BadgeCheck,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Loader2,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  checkUsernameAvailable,
  deleteOwnAccount,
  sanitizeUsername,
  toggleBlockUser,
  updatePrivacySettings,
  updateUserPresence,
  updateUserProfile,
  uploadImageToStorage,
} from '../lib/igmeetService';
import {
  AppTheme,
  formatFullDate,
  getContrastTextColor,
  PROFILE_COLOR_PRESETS,
  PublicProfile,
  UserPrivate,
  VALIDATION,
} from '../types/igmeet';
import { Avatar, VerifiedTick } from './Avatar';

interface ProfileViewProps {
  profile: PublicProfile;
  userPrivate: UserPrivate;
  allProfiles: PublicProfile[];
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onOpenSubscriptions: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  userPrivate,
  allProfiles,
  theme,
  onThemeChange,
  onOpenSubscriptions,
}) => {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [profileColor, setProfileColor] = useState(profile.profileColor);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [showLastSeen, setShowLastSeen] = useState(profile.showLastSeen);

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const contrast = getContrastTextColor(profile.profileColor);

  const blockedProfiles = React.useMemo(
    () => allProfiles.filter((p) => userPrivate.blockedUsers.includes(p.uid)),
    [allProfiles, userPrivate.blockedUsers]
  );

  const openEditor = () => {
    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setBio(profile.bio);
    setProfileColor(profile.profileColor);
    setPhotoURL(profile.photoURL);
    setShowLastSeen(profile.showLastSeen);
    setError('');
    setEditing(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError('');
    setUploadPct(1);
    try {
      const url = await uploadImageToStorage({
        file,
        uid: profile.uid,
        folder: 'profilePhotos',
        onProgress: setUploadPct,
      });
      setPhotoURL(url);
      if (!editing) {
        await updateUserProfile({
          currentProfile: profile,
          displayName: profile.displayName,
          username: profile.username,
          bio: profile.bio,
          profileColor: profile.profileColor,
          photoURL: url,
          showLastSeen: profile.showLastSeen,
        });
        setFeedback('Profile photo updated.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploadPct(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const cleanUser = sanitizeUsername(username);
      if (cleanUser !== profile.username) {
        const free = await checkUsernameAvailable(cleanUser);
        if (!free) throw new Error('That username is already taken.');
      }
      await updateUserProfile({
        currentProfile: profile,
        displayName,
        username: cleanUser,
        bio,
        profileColor,
        photoURL,
        showLastSeen,
      });
      setEditing(false);
      setFeedback('Profile saved to Firebase.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUid = () => {
    void navigator.clipboard?.writeText(profile.uid);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  const handleLogout = async () => {
    await updateUserPresence(profile.uid, false);
    await signOut(auth);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteOwnAccount(profile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Please sign in again recently before deleting your account.'
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] overflow-y-auto pb-24 lg:pb-10">
      <div className="max-w-3xl w-full mx-auto px-4 pt-5 space-y-5">
        {feedback && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {feedback}
            </span>
            <button type="button" onClick={() => setFeedback('')} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </span>
            <button type="button" onClick={() => setError('')} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Profile Card with Custom Profile Color */}
        <section className="rounded-3xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
          <div
            className="h-28 px-6 pt-4 flex items-start justify-between transition-colors duration-200"
            style={{ backgroundColor: profile.profileColor, color: contrast }}
          >
            <span className="text-xs font-semibold opacity-90">
              {profile.role === 'main_admin'
                ? 'Main Admin Account'
                : profile.role === 'admin'
                  ? 'Administrator'
                  : 'IG Meet Profile'}
            </span>
            <button
              type="button"
              onClick={openEditor}
              className="h-9 px-3.5 rounded-xl bg-black/20 hover:bg-black/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{ color: contrast }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          </div>

          <div className="px-6 pb-6 -mt-12 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div className="relative">
                <Avatar
                  name={profile.displayName}
                  photoURL={profile.photoURL}
                  profileColor={profile.profileColor}
                  size="xl"
                  online={profile.onlineStatus}
                  className="ring-4 ring-[var(--bg-surface)]"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload profile photo"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center shadow border-2 border-[var(--bg-surface)] cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenSubscriptions}
                className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] hover:bg-[var(--accent-soft)] border border-[var(--border-hairline)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <BadgeCheck className="w-4 h-4 text-[var(--verified-blue)]" />
                {profile.isVerified ? 'Verified Plan' : 'Get Blue Tick'}
              </button>
            </div>

            {uploadPct !== null && (
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                <span className="tabular-nums">Uploading profile photo {uploadPct}%</span>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-display">{profile.displayName}</h1>
                {profile.isVerified && <VerifiedTick size="lg" />}
              </div>
              <p className="text-sm text-[var(--text-secondary)]">@{profile.username}</p>
            </div>

            {profile.bio && (
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{profile.bio}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-hairline)]">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined {formatFullDate(profile.createdAt)}
              </span>
              <span aria-hidden="true">·</span>
              <span>Status: {profile.isVerified ? 'Verified' : 'Standard'}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handleCopyUid}
                className="inline-flex items-center gap-1 hover:text-[var(--accent-primary)] cursor-pointer tabular-nums"
              >
                <Copy className="w-3 h-3" />
                {copiedId ? 'Copied ID' : `ID: ${profile.uid.slice(0, 10)}...`}
              </button>
            </div>
          </div>
        </section>

        {/* Theme Selection Section — BOTH THEMES FREE FOR ALL USERS */}
        <section className="rounded-3xl p-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Palette className="w-5 h-5 text-[var(--accent-primary)]" />
              <div>
                <h2 className="text-sm font-bold font-display">App Theme</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Free for all users · Saved to your account
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Theme 1: Light Pink Live Preview */}
            <button
              type="button"
              onClick={() => onThemeChange('light_pink')}
              className={`rounded-2xl p-4 text-left border-2 transition-all cursor-pointer ${
                theme === 'light_pink'
                  ? 'border-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)]'
              }`}
              style={{ backgroundColor: '#FFF7FA', color: '#1F131A' }}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-bold font-display">
                  <Sun className="w-4 h-4 text-[#E11D6C]" />
                  Light Pink
                </span>
                {theme === 'light_pink' && (
                  <span className="w-5 h-5 rounded-full bg-[#E11D6C] text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#68525F' }}>
                Clean blush background with crisp readable contrast and rose accents.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="h-3 w-12 rounded-full" style={{ backgroundColor: '#E11D6C' }} />
                <span className="h-3 w-8 rounded-full" style={{ backgroundColor: '#FDEEF4' }} />
                <span className="h-3 w-6 rounded-full" style={{ backgroundColor: '#F3D9E4' }} />
              </div>
            </button>

            {/* Theme 2: Eye-Comfort Dark Live Preview */}
            <button
              type="button"
              onClick={() => onThemeChange('eye_comfort_dark')}
              className={`rounded-2xl p-4 text-left border-2 transition-all cursor-pointer ${
                theme === 'eye_comfort_dark'
                  ? 'border-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)]'
              }`}
              style={{ backgroundColor: '#090709', color: '#F7EFF3' }}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-bold font-display">
                  <Moon className="w-4 h-4 text-[#F43F7A]" />
                  Eye-Comfort Dark
                </span>
                {theme === 'eye_comfort_dark' && (
                  <span className="w-5 h-5 rounded-full bg-[#F43F7A] text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#B4A0AC' }}>
                Deep dark black surfaces with warm pink-red accents for low-light comfort.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="h-3 w-12 rounded-full" style={{ backgroundColor: '#F43F7A' }} />
                <span className="h-3 w-8 rounded-full" style={{ backgroundColor: '#1C151B' }} />
                <span className="h-3 w-6 rounded-full" style={{ backgroundColor: '#2B2029' }} />
              </div>
            </button>
          </div>
        </section>

        {/* Privacy & Safety */}
        <section className="rounded-3xl p-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[var(--accent-primary)]" />
            <h2 className="text-sm font-bold font-display">Privacy & Account Controls</h2>
          </div>

          <div className="divide-y divide-[var(--border-hairline)]">
            <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Show last seen status</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Let other members see when you were last active
                </p>
              </div>
              <input
                type="checkbox"
                checked={profile.showLastSeen}
                onChange={(e) =>
                  updateUserProfile({
                    currentProfile: profile,
                    displayName: profile.displayName,
                    username: profile.username,
                    bio: profile.bio,
                    profileColor: profile.profileColor,
                    photoURL: profile.photoURL,
                    showLastSeen: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-[var(--accent-primary)] cursor-pointer"
              />
            </label>

            <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Allow private messages</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Allow authenticated users to start 1-to-1 chats with you
                </p>
              </div>
              <input
                type="checkbox"
                checked={userPrivate.allowPrivateMessages}
                onChange={(e) =>
                  updatePrivacySettings(profile.uid, {
                    allowPrivateMessages: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-[var(--accent-primary)] cursor-pointer"
              />
            </label>
          </div>

          {/* Blocked Users */}
          {blockedProfiles.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Blocked Accounts ({blockedProfiles.length})
              </p>
              <div className="space-y-2">
                {blockedProfiles.map((bp) => (
                  <div
                    key={bp.uid}
                    className="p-2.5 rounded-xl bg-[var(--bg-surface-tonal)] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={bp.displayName}
                        photoURL={bp.photoURL}
                        profileColor={bp.profileColor}
                        size="xs"
                      />
                      <span className="text-xs font-medium truncate">
                        {bp.displayName} (@{bp.username})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toggleBlockUser(profile.uid, bp.uid, userPrivate.blockedUsers)
                      }
                      className="text-xs font-semibold text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Actions */}
          <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] hover:bg-[var(--accent-soft)] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>

            {profile.role !== 'main_admin' && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="h-10 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Live Color Banner Preview */}
            <div
              className="px-6 py-5 flex items-center justify-between transition-colors"
              style={{
                backgroundColor: profileColor,
                color: getContrastTextColor(profileColor),
              }}
            >
              <div className="flex items-center gap-3">
                <Avatar
                  name={displayName || profile.displayName}
                  photoURL={photoURL}
                  profileColor={profileColor}
                  size="md"
                />
                <div>
                  <h3 className="text-base font-bold font-display">Edit Profile</h3>
                  <p className="text-xs opacity-90">Live profile color preview</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="w-9 h-9 rounded-full bg-black/15 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
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
                  className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={VALIDATION.USERNAME_MAX}
                    value={username}
                    onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                    className="w-full h-11 pl-8 pr-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Bio</label>
                <textarea
                  rows={3}
                  maxLength={VALIDATION.BIO_MAX}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-hairline)] text-sm resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              {/* Profile Color Customization */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Profile Color (Saved in Firebase across sessions)
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  {PROFILE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setProfileColor(preset.hex)}
                      title={preset.name}
                      className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2"
                      style={{
                        backgroundColor: preset.hex,
                        borderColor:
                          profileColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'var(--text-primary)'
                            : 'transparent',
                      }}
                    >
                      {profileColor.toLowerCase() === preset.hex.toLowerCase() && (
                        <Check
                          className="w-4 h-4"
                          style={{ color: getContrastTextColor(preset.hex) }}
                        />
                      )}
                    </button>
                  ))}
                  <label className="w-9 h-9 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface-tonal)] flex items-center justify-center cursor-pointer text-xs font-bold relative overflow-hidden">
                    <input
                      type="color"
                      value={profileColor}
                      onChange={(e) => setProfileColor(e.target.value)}
                      className="opacity-0 absolute inset-0 cursor-pointer"
                      aria-label="Custom profile color"
                    />
                    +
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-11 px-4 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
            <h3 className="text-base font-bold font-display">Log out of IG Meet?</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Your profile colors, theme preference, and chats will remain safely saved in Firebase.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="h-10 px-4 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-semibold cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
            <h3 className="text-base font-bold font-display text-rose-500">
              Delete your account permanently?
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              This removes your public profile, private settings, username reservation, and Firebase login. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-10 px-4 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteAccount}
                className="h-10 px-4 rounded-xl bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
