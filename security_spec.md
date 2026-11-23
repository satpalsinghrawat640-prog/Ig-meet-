# IG Meet — Security Specification (Phase 0 TDD)

## 1. Core Data Invariants
1. **PII Isolation**: User emails, FCM tokens, blocked lists, and theme settings live strictly in `/userPrivate/{uid}` and are readable only by the owner (`uid == request.auth.uid`) or verified admins. `/publicProfiles/{uid}` contains zero PII.
2. **One-Time Atomic Main Admin Initialization**: Only when `/admin/initialization` does not exist can a verified user atomically create `/admin/initialization` + `/admins/{uid}` (`role: 'main_admin'`) + `/publicProfiles/{uid}` (`role: 'main_admin'`). Once initialized, `/admin/initialization` is permanently immutable (`update/delete: false`), and all subsequent registrations must have `role == 'user'`.
3. **No Self-Verification / No Self-Promotion**: Ordinary users cannot create or update `isVerified: true`, `subscriptionStatus: 'active'`, `role: 'admin' | 'main_admin'`, or `isSuspended`.
4. **Private Chat Confidentiality**: Only the two participants in `participantIds` can `get`, `list`, `create`, or `update` `/privateChats/{conversationId}` and its `/messages/{messageId}` subcollection.
5. **Backend-Controlled Subscription Verification**: Users may only submit `/subscriptions/{id}` with `status: 'pending_verification'` and `verifiedBy: ''`. Only an admin can activate, expire, or reject a subscription and grant the blue tick.
6. **Temporal Integrity**: All `createdAt`, `updatedAt`, and `initializedAt` timestamps must strictly equal `request.time`.
7. **Terminal State Locking**: Once a report reaches `resolved` or `dismissed`, or a subscription reaches `expired` or `rejected`, non-admins cannot alter it.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Admin Promotion on Create**: Creating `/publicProfiles/{uid}` with `role: "admin"` after `/admin/initialization` exists.
2. **Self-Verification Shadow Update**: Updating `/publicProfiles/{uid}` with `{ displayName: "Alex", isVerified: true }`.
3. **Email Spoofing Without Verification**: Reading `/adminAuditLogs` with `email == "satpalsinghrawat640@gmail.com"` when `email_verified == false`.
4. **PII Blanket Read**: User B calling `get` on `/userPrivate/{userA}`.
5. **Private Chat Eavesdropping**: User C calling `get` or `list` on `/privateChats/userA_userB/messages`.
6. **Fake Subscription Activation**: Ordinary user creating `/subscriptions/{id}` with `status: "active"` and `verifiedBy: "self"`.
7. **Admin Lock Overwrite**: Attempting `update` or `delete` on `/admin/initialization`.
8. **Global Chat Impersonation**: User A creating `/globalChatMessages/{id}` with `senderId: "userB"` or `messageType: "announcement"`.
9. **Resource Exhaustion / ID Poisoning**: Creating `/publicProfiles/{200-char-invalid-id}` or sending a 5,000-character message.
10. **Client Timestamp Forgery**: Creating a message with a backdated client `createdAt` instead of `request.time`.
11. **Audit Log Tampering**: Attempting `update` or `delete` on `/adminAuditLogs/{logId}` (even as admin).
12. **Unscoped List Scraping**: Calling `list` on `/notifications` without filtering `recipientId == request.auth.uid`, or calling `list` on `/privateChats` without `participantIds array-contains uid`.
