# IG Meet — Firebase Setup & Security Rules Reference

## Provisioned Project
- **Firebase Project ID**: `ig-meet`
- **Storage Bucket**: `ig-meet.firebasestorage.app`
- **Firestore Security Rules (`firestore.rules`)**: Deployed to `ig-meet` via AI Studio Firebase provisioning.
- **Realtime Database Rules (`database.rules.json`)**: Included for Android/RTDB parity; deploy via Firebase CLI (`firebase deploy --only database`).
- **Storage Rules (`storage.rules`)**: Included for profile photo & chat media protection; deploy via Firebase Console -> Storage -> Rules or `firebase deploy --only storage`.

## Firebase Console Services Checklist
1. **Google Sign-In**: Pre-configured automatically on project `ig-meet`.
2. **Email/Password Sign-In**: If you want users to register with Email & Password in addition to Google Sign-In, enable **Email/Password** in Firebase Console -> Authentication -> Sign-in method.
3. **Firebase Storage**: Ensure Firebase Storage is enabled for `ig-meet.firebasestorage.app` and paste `storage.rules` under Storage -> Rules so profile photo and chat image uploads are secured to each user's UID folder.

## One-Time Atomic Main Admin Initialization
- The very first verified account that completes onboarding atomically writes `/admin/initialization`, `/admins/{uid}` (`role: "main_admin"`), and `/publicProfiles/{uid}` (`role: "main_admin"`) in a single Firestore batch verified by `existsAfter`/`getAfter`.
- Once `/admin/initialization` exists, `update` and `delete` are permanently blocked (`if false`), and every subsequent registration is enforced to `role == "user"`.
