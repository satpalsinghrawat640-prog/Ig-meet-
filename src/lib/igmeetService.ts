import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { deleteUser, User } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, handleFirestoreError, OperationType, storage } from './firebase';
import {
  AppTheme,
  PlanId,
  PublicProfile,
  SubscriptionPlan,
  SubscriptionRecord,
  VALIDATION,
} from '../types/igmeet';

const BOOTSTRAPPED_ADMIN_EMAIL = 'satpalsinghrawat640@gmail.com';

export function getConversationId(uidA: string, uidB: string): string {
  const [first, second] = [uidA, uidB].sort();
  return `${first}_${second}`;
}

export function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, VALIDATION.USERNAME_MAX);
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const clean = sanitizeUsername(username);
  if (clean.length < VALIDATION.USERNAME_MIN || !VALIDATION.USERNAME_REGEX.test(clean)) {
    return false;
  }
  const path = `usernames/${clean}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', clean));
    return !snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Atomically completes onboarding for a new user.
 * If `/admin/initialization` does NOT exist yet, atomically initializes the very first
 * account as Main Admin (enforced by Firestore Security Rules via existsAfter/getAfter).
 */
export async function completeUserOnboarding(params: {
  user: User;
  displayName: string;
  username: string;
  bio: string;
  profileColor: string;
  theme: AppTheme;
  photoURL: string;
}): Promise<{ becameMainAdmin: boolean }> {
  const { user } = params;
  const cleanDisplayName = params.displayName.trim().slice(0, VALIDATION.DISPLAY_NAME_MAX);
  const cleanUsername = sanitizeUsername(params.username);
  const cleanBio = params.bio.trim().slice(0, VALIDATION.BIO_MAX);
  const cleanColor = VALIDATION.HEX_COLOR_REGEX.test(params.profileColor)
    ? params.profileColor
    : '#E11D6C';
  const cleanPhoto = params.photoURL.trim().slice(0, 1000);

  if (!cleanDisplayName) {
    throw new Error('Display name is required.');
  }
  if (cleanUsername.length < VALIDATION.USERNAME_MIN || !VALIDATION.USERNAME_REGEX.test(cleanUsername)) {
    throw new Error('Username must be 3–30 characters using lowercase letters, numbers, or underscores.');
  }

  // Verify username uniqueness
  const available = await checkUsernameAvailable(cleanUsername);
  if (!available) {
    throw new Error('That username is already taken. Please choose another.');
  }

  // Check atomic first-user Main Admin lock
  let initExists = true;
  try {
    const initSnap = await getDoc(doc(db, 'admin', 'initialization'));
    initExists = initSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'admin/initialization');
  }

  const isBootstrappedOwner =
    user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;
  const shouldInitMainAdmin = !initExists;
  const assignedRole = shouldInitMainAdmin || isBootstrappedOwner ? 'main_admin' : 'user';

  const batch = writeBatch(db);
  const now = serverTimestamp();

  if (shouldInitMainAdmin) {
    batch.set(doc(db, 'admin', 'initialization'), {
      initialized: true,
      mainAdminUid: user.uid,
      initializedAt: now,
    });
    batch.set(doc(db, 'admins', user.uid), {
      uid: user.uid,
      role: 'main_admin',
      createdAt: now,
    });
  } else if (isBootstrappedOwner) {
    batch.set(doc(db, 'admins', user.uid), {
      uid: user.uid,
      role: 'main_admin',
      createdAt: now,
    });
  }

  batch.set(doc(db, 'usernames', cleanUsername), {
    uid: user.uid,
    createdAt: now,
  });

  batch.set(doc(db, 'publicProfiles', user.uid), {
    uid: user.uid,
    displayName: cleanDisplayName,
    username: cleanUsername,
    photoURL: cleanPhoto,
    bio: cleanBio,
    profileColor: cleanColor,
    isVerified: false,
    subscriptionStatus: 'none',
    role: assignedRole,
    isSuspended: false,
    onlineStatus: true,
    showLastSeen: true,
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(db, 'userPrivate', user.uid), {
    uid: user.uid,
    email: (user.email || '').slice(0, 200),
    theme: params.theme,
    onboardingCompleted: true,
    blockedUsers: [],
    fcmToken: '',
    allowPrivateMessages: true,
    lastGlobalReadAt: now,
    updatedAt: now,
  });

  try {
    await batch.commit();
    return { becameMainAdmin: shouldInitMainAdmin };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `publicProfiles/${user.uid}`);
  }
}

export async function updateUserPresence(uid: string, onlineStatus: boolean): Promise<void> {
  const path = `publicProfiles/${uid}`;
  try {
    await updateDoc(doc(db, 'publicProfiles', uid), {
      onlineStatus,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Non-fatal on page unload, still log cleanly
    if (onlineStatus) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function updateUserTheme(uid: string, theme: AppTheme): Promise<void> {
  const path = `userPrivate/${uid}`;
  try {
    await updateDoc(doc(db, 'userPrivate', uid), {
      theme,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLastGlobalRead(uid: string): Promise<void> {
  const path = `userPrivate/${uid}`;
  try {
    await updateDoc(doc(db, 'userPrivate', uid), {
      lastGlobalReadAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserProfile(params: {
  currentProfile: PublicProfile;
  displayName: string;
  username: string;
  bio: string;
  profileColor: string;
  photoURL: string;
  showLastSeen: boolean;
}): Promise<void> {
  const { currentProfile } = params;
  const cleanDisplayName = params.displayName.trim().slice(0, VALIDATION.DISPLAY_NAME_MAX);
  const cleanUsername = sanitizeUsername(params.username);
  const cleanBio = params.bio.trim().slice(0, VALIDATION.BIO_MAX);
  const cleanColor = VALIDATION.HEX_COLOR_REGEX.test(params.profileColor)
    ? params.profileColor
    : currentProfile.profileColor;
  const cleanPhoto = params.photoURL.trim().slice(0, 1000);

  if (!cleanDisplayName) throw new Error('Display name cannot be empty.');
  if (cleanUsername.length < VALIDATION.USERNAME_MIN || !VALIDATION.USERNAME_REGEX.test(cleanUsername)) {
    throw new Error('Username must be 3–30 lowercase letters, numbers, or underscores.');
  }

  const usernameChanged = cleanUsername !== currentProfile.username;
  if (usernameChanged) {
    const available = await checkUsernameAvailable(cleanUsername);
    if (!available) {
      throw new Error('That username is already taken.');
    }
  }

  const batch = writeBatch(db);
  const now = serverTimestamp();

  if (usernameChanged) {
    batch.set(doc(db, 'usernames', cleanUsername), {
      uid: currentProfile.uid,
      createdAt: now,
    });
    batch.delete(doc(db, 'usernames', currentProfile.username));
  }

  batch.update(doc(db, 'publicProfiles', currentProfile.uid), {
    displayName: cleanDisplayName,
    username: cleanUsername,
    bio: cleanBio,
    profileColor: cleanColor,
    photoURL: cleanPhoto,
    showLastSeen: params.showLastSeen,
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `publicProfiles/${currentProfile.uid}`);
  }
}

export async function updatePrivacySettings(
  uid: string,
  updates: { allowPrivateMessages?: boolean; fcmToken?: string }
): Promise<void> {
  const path = `userPrivate/${uid}`;
  try {
    await updateDoc(doc(db, 'userPrivate', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleBlockUser(
  myUid: string,
  targetUid: string,
  currentBlocked: string[]
): Promise<string[]> {
  const exists = currentBlocked.includes(targetUid);
  const next = exists
    ? currentBlocked.filter((id) => id !== targetUid)
    : [...currentBlocked, targetUid].slice(0, 100);
  const path = `userPrivate/${myUid}`;
  try {
    await updateDoc(doc(db, 'userPrivate', myUid), {
      blockedUsers: next,
      updatedAt: serverTimestamp(),
    });
    return next;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Compresses an image client-side with Canvas and uploads to Firebase Storage with progress tracking.
 */
async function compressImageFile(file: File, maxDimension: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
          } else {
            resolve(blob);
          }
        },
        'image/webp',
        0.84
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the selected image file.'));
    };
    img.src = objectUrl;
  });
}

export async function uploadImageToStorage(params: {
  file: File;
  uid: string;
  folder: 'profilePhotos' | 'chatMedia';
  onProgress?: (percent: number) => void;
}): Promise<string> {
  const { file, uid, folder, onProgress } = params;
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are supported.');
  }
  if (file.size > VALIDATION.MAX_UPLOAD_BYTES) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  const maxDim = folder === 'profilePhotos' ? 512 : 1280;
  const compressed = await compressImageFile(file, maxDim);
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
  const storageRef = ref(storage, `${folder}/${uid}/${safeName}`);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, compressed, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=86400',
    });

    task.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(pct);
      },
      (err) => {
        if (err.code === 'storage/unauthorized') {
          reject(
            new Error(
              'Firebase Storage blocked this upload. Please deploy storage.rules in Firebase Console -> Storage -> Rules for project ig-meet.'
            )
          );
        } else {
          reject(new Error(err.message || 'Image upload failed.'));
        }
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

// =========================================================================
// GLOBAL CHAT
// =========================================================================
export async function sendGlobalMessage(params: {
  sender: PublicProfile;
  text: string;
  messageType?: 'text' | 'image' | 'announcement';
  mediaUrl?: string;
}): Promise<void> {
  const cleanText = params.text.trim().slice(0, VALIDATION.MESSAGE_MAX);
  const cleanMedia = (params.mediaUrl || '').trim().slice(0, 1000);
  if (!cleanText) throw new Error('Message cannot be empty.');

  const path = 'globalChatMessages';
  try {
    await addDoc(collection(db, path), {
      senderId: params.sender.uid,
      senderName: params.sender.displayName.slice(0, VALIDATION.DISPLAY_NAME_MAX),
      senderPhoto: params.sender.photoURL.slice(0, 1000),
      senderColor: params.sender.profileColor,
      senderVerified: params.sender.isVerified,
      text: cleanText,
      messageType: params.messageType || 'text',
      mediaUrl: cleanMedia,
      isRemoved: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteOwnGlobalMessage(messageId: string): Promise<void> {
  const path = `globalChatMessages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'globalChatMessages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =========================================================================
// PRIVATE 1-TO-1 CHAT
// =========================================================================
export async function ensurePrivateChat(myUid: string, otherUid: string): Promise<string> {
  const conversationId = getConversationId(myUid, otherUid);
  const [participantA, participantB] = [myUid, otherUid].sort();
  const chatRef = doc(db, 'privateChats', conversationId);
  const path = `privateChats/${conversationId}`;

  try {
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      const now = serverTimestamp();
      await setDoc(chatRef, {
        conversationId,
        participantA,
        participantB,
        participantIds: [participantA, participantB],
        lastMessage: '',
        lastSenderId: '',
        unreadA: 0,
        unreadB: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    return conversationId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function sendPrivateMessage(params: {
  conversationId: string;
  sender: PublicProfile;
  recipientUid: string;
  text: string;
  messageType?: 'text' | 'image';
  mediaUrl?: string;
}): Promise<void> {
  const cleanText = params.text.trim().slice(0, VALIDATION.MESSAGE_MAX);
  const cleanMedia = (params.mediaUrl || '').trim().slice(0, 1000);
  if (!cleanText) throw new Error('Message cannot be empty.');

  const [participantA, participantB] = [params.sender.uid, params.recipientUid].sort();
  const participantIds = [participantA, participantB];
  const chatRef = doc(db, 'privateChats', params.conversationId);
  const path = `privateChats/${params.conversationId}`;

  try {
    const existingSnap = await getDoc(chatRef);
    const now = serverTimestamp();

    let unreadA = 0;
    let unreadB = 0;
    if (existingSnap.exists()) {
      const d = existingSnap.data();
      unreadA = Number(d.unreadA || 0);
      unreadB = Number(d.unreadB || 0);
    }

    if (params.recipientUid === participantA) {
      unreadA += 1;
    } else {
      unreadB += 1;
    }

    const preview =
      params.messageType === 'image' ? 'Sent a photo' : cleanText.slice(0, 300);

    if (!existingSnap.exists()) {
      await setDoc(chatRef, {
        conversationId: params.conversationId,
        participantA,
        participantB,
        participantIds,
        lastMessage: preview,
        lastSenderId: params.sender.uid,
        unreadA,
        unreadB,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await updateDoc(chatRef, {
        lastMessage: preview,
        lastSenderId: params.sender.uid,
        unreadA,
        unreadB,
        updatedAt: now,
      });
    }

    await addDoc(collection(db, 'privateChats', params.conversationId, 'messages'), {
      senderId: params.sender.uid,
      participantIds,
      text: cleanText,
      messageType: params.messageType || 'text',
      mediaUrl: cleanMedia,
      createdAt: serverTimestamp(),
    });

    // Privacy-respecting notification alert (never leaks private message contents)
    await addDoc(collection(db, 'notifications'), {
      recipientId: params.recipientUid,
      title: `New message from ${params.sender.displayName.slice(0, 40)}`,
      body: 'Open IG Meet to view your private conversation.',
      type: 'private_message',
      linkTarget: `private:${params.conversationId}`,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markPrivateChatRead(
  conversationId: string,
  myUid: string,
  participantA: string
): Promise<void> {
  const path = `privateChats/${conversationId}`;
  const field = myUid === participantA ? 'unreadA' : 'unreadB';
  try {
    await updateDoc(doc(db, 'privateChats', conversationId), {
      [field]: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// =========================================================================
// SUBSCRIPTIONS (3 TIERS + BACKEND/ADMIN VERIFIED BLUE TICK)
// =========================================================================
export async function submitSubscriptionVerificationRequest(params: {
  uid: string;
  plan: SubscriptionPlan;
  paymentReference: string;
}): Promise<void> {
  const refCode = params.paymentReference.trim().slice(0, VALIDATION.PAYMENT_REF_MAX);
  if (refCode.length < VALIDATION.PAYMENT_REF_MIN) {
    throw new Error('Please enter a valid payment reference ID (minimum 3 characters).');
  }
  const path = 'subscriptions';
  try {
    const now = serverTimestamp();
    await addDoc(collection(db, path), {
      uid: params.uid,
      planId: params.plan.planId,
      planName: params.plan.name.slice(0, 60),
      status: 'pending_verification',
      paymentReference: refCode,
      verifiedBy: '',
      startedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// =========================================================================
// REPORTS & NOTIFICATIONS
// =========================================================================
export async function submitReport(params: {
  reporterId: string;
  reportedUserId: string;
  targetType: 'user' | 'global_message' | 'private_message';
  targetId: string;
  reason: string;
}): Promise<void> {
  const cleanReason = params.reason.trim().slice(0, VALIDATION.REPORT_REASON_MAX);
  if (cleanReason.length < VALIDATION.REPORT_REASON_MIN) {
    throw new Error('Please describe the reason for your report.');
  }
  const path = 'reports';
  try {
    const now = serverTimestamp();
    await addDoc(collection(db, path), {
      reporterId: params.reporterId,
      reportedUserId: params.reportedUserId,
      targetType: params.targetType,
      targetId: params.targetId.slice(0, 200),
      reason: cleanReason,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =========================================================================
// ACCOUNT DELETION
// =========================================================================
export async function deleteOwnAccount(profile: PublicProfile): Promise<void> {
  if (profile.role === 'main_admin') {
    throw new Error('The Main Admin account is permanently protected and cannot be self-deleted.');
  }
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not signed in.');

  const batch = writeBatch(db);
  batch.delete(doc(db, 'publicProfiles', profile.uid));
  batch.delete(doc(db, 'userPrivate', profile.uid));
  batch.delete(doc(db, 'usernames', profile.username));

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `publicProfiles/${profile.uid}`);
  }

  await deleteUser(currentUser);
}

// =========================================================================
// ADMIN PANEL OPERATIONS (Admin-Authorized Only + Audit Logs)
// =========================================================================
async function writeAuditLog(adminUid: string, action: string, targetId: string, details: string) {
  await addDoc(collection(db, 'adminAuditLogs'), {
    adminUid,
    action: action.slice(0, 100),
    targetId: targetId.slice(0, 200),
    details: details.slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export async function adminSaveSubscriptionPlan(
  adminUid: string,
  plan: {
    planId: PlanId;
    name: string;
    description: string;
    priceLabel: string;
    durationDays: number;
    isActive: boolean;
    sortOrder: number;
  }
): Promise<void> {
  const path = `subscriptionPlans/${plan.planId}`;
  try {
    await setDoc(doc(db, 'subscriptionPlans', plan.planId), {
      planId: plan.planId,
      name: plan.name.trim().slice(0, 60),
      description: plan.description.trim().slice(0, 400),
      priceLabel: plan.priceLabel.trim().slice(0, 60),
      durationDays: Math.max(1, Math.min(3650, Math.floor(plan.durationDays))),
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      adminUid,
      'UPDATE_SUBSCRIPTION_PLAN',
      plan.planId,
      `Configured plan "${plan.name}" (${plan.durationDays}d, active=${plan.isActive})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminReviewSubscription(params: {
  adminUid: string;
  record: SubscriptionRecord;
  decision: 'active' | 'expired' | 'rejected';
  durationDays: number;
}): Promise<void> {
  const { adminUid, record, decision, durationDays } = params;
  const nowDate = new Date();
  const expiryDate = new Date(nowDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const nowServer = serverTimestamp();

  const batch = writeBatch(db);
  batch.update(doc(db, 'subscriptions', record.id), {
    status: decision,
    verifiedBy: adminUid,
    startedAt: decision === 'active' ? Timestamp.fromDate(nowDate) : record.startedAt || null,
    expiresAt: decision === 'active' ? Timestamp.fromDate(expiryDate) : record.expiresAt || null,
    updatedAt: nowServer,
  });

  const nextSubStatus =
    decision === 'active' ? 'active' : decision === 'expired' ? 'expired' : 'none';
  const nextVerified = decision === 'active';

  batch.update(doc(db, 'publicProfiles', record.uid), {
    isVerified: nextVerified,
    subscriptionStatus: nextSubStatus,
    updatedAt: nowServer,
  });

  const notifTitle =
    decision === 'active'
      ? 'Blue Verification Tick Activated'
      : decision === 'expired'
        ? 'Subscription Expired'
        : 'Verification Payment Rejected';
  const notifBody =
    decision === 'active'
      ? `Your ${record.planName} payment was verified. Your blue tick is now live.`
      : decision === 'expired'
        ? `Your ${record.planName} subscription has expired.`
        : `Payment reference "${record.paymentReference}" could not be verified.`;

  batch.set(doc(collection(db, 'notifications')), {
    recipientId: record.uid,
    title: notifTitle,
    body: notifBody,
    type: 'subscription',
    linkTarget: 'subscriptions',
    read: false,
    createdAt: nowServer,
  });

  try {
    await batch.commit();
    await writeAuditLog(
      adminUid,
      `SUBSCRIPTION_${decision.toUpperCase()}`,
      record.id,
      `Set user ${record.uid} (${record.planName}, ref=${record.paymentReference}) -> ${decision}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subscriptions/${record.id}`);
  }
}

export async function adminToggleUserSuspension(
  adminUid: string,
  target: PublicProfile,
  suspend: boolean
): Promise<void> {
  if (target.role === 'main_admin') {
    throw new Error('The Main Admin account is permanently protected.');
  }
  const path = `publicProfiles/${target.uid}`;
  try {
    await updateDoc(doc(db, 'publicProfiles', target.uid), {
      isSuspended: suspend,
      updatedAt: serverTimestamp(),
    });
    await addDoc(collection(db, 'notifications'), {
      recipientId: target.uid,
      title: suspend ? 'Account Suspended' : 'Account Restored',
      body: suspend
        ? 'Your account was suspended by an administrator due to policy review.'
        : 'Your account access has been restored by an administrator.',
      type: 'account',
      linkTarget: 'profile',
      read: false,
      createdAt: serverTimestamp(),
    });
    await writeAuditLog(
      adminUid,
      suspend ? 'SUSPEND_USER' : 'RESTORE_USER',
      target.uid,
      `${suspend ? 'Suspended' : 'Restored'} @${target.username}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminModerateGlobalMessage(
  adminUid: string,
  messageId: string,
  senderId: string
): Promise<void> {
  const path = `globalChatMessages/${messageId}`;
  try {
    await updateDoc(doc(db, 'globalChatMessages', messageId), {
      isRemoved: true,
      text: '[Message removed by moderator]',
    });
    await writeAuditLog(
      adminUid,
      'MODERATE_GLOBAL_MESSAGE',
      messageId,
      `Removed Global Chat message from user ${senderId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminResolveReport(
  adminUid: string,
  reportId: string,
  status: 'resolved' | 'dismissed'
): Promise<void> {
  const path = `reports/${reportId}`;
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(adminUid, `REPORT_${status.toUpperCase()}`, reportId, `Marked report ${status}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminPublishAnnouncement(params: {
  adminProfile: PublicProfile;
  title: string;
  body: string;
  alsoPostToGlobal: boolean;
}): Promise<void> {
  const cleanTitle = params.title.trim().slice(0, 120);
  const cleanBody = params.body.trim().slice(0, 1000);
  if (!cleanTitle || !cleanBody) throw new Error('Title and announcement message are required.');

  const path = 'announcements';
  try {
    const docRef = await addDoc(collection(db, path), {
      title: cleanTitle,
      body: cleanBody,
      authorId: params.adminProfile.uid,
      isActive: true,
      createdAt: serverTimestamp(),
    });

    if (params.alsoPostToGlobal) {
      await sendGlobalMessage({
        sender: params.adminProfile,
        text: `${cleanTitle}: ${cleanBody}`.slice(0, VALIDATION.MESSAGE_MAX),
        messageType: 'announcement',
      });
    }

    await writeAuditLog(
      params.adminProfile.uid,
      'PUBLISH_ANNOUNCEMENT',
      docRef.id,
      `Published "${cleanTitle}"`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
