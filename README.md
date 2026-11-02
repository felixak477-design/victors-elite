# THE VICTORS

A Next.js + Firebase community platform starter for THE VICTORS, designed for deployment on Vercel.

## Included

- Responsive community homepage
- Firebase email/password registration and sign-in
- Registration queue with pending / approved / declined states
- Member discussion board
- Admin dashboard for membership review
- Admin publishing for announcements, exam reminders, activities and opportunities
- Firestore security rules
- Server-side admin role assignment script using Firebase Admin SDK

## 1. Create Firebase project

1. Create a project at https://console.firebase.google.com/
2. Add a Web App and copy its configuration.
3. In **Authentication > Sign-in method**, enable **Email/Password**.
4. Create a **Cloud Firestore** database.
5. Copy `.env.example` to `.env.local` and fill in the Firebase Web App values.

## 2. Configure Firestore

In Firebase Console > Firestore Database > Rules, publish the contents of `firestore.rules`.

The first-time registration flow creates a Firebase Authentication account and a registration queue entry. An administrator must create the corresponding `users/{uid}` profile with `status: "pending"` and `role: "member"` before approval. For the initial admin bootstrap, create your own user profile in Firestore with your UID, displayName, email, status `approved`, and role `admin`; then assign the custom claim using the script below. Do not allow public users to assign their own admin role.

## 3. Bootstrap the first administrator

Create a Firebase service account in Project settings > Service accounts. Keep its private key secret.

Set these server-only environment variables in your local shell (do not prefix them with NEXT_PUBLIC_):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Then run:

```bash
npm install
npm run set-admin
```

Enter the email of the existing Firebase Authentication user. The script sets the `admin: true` custom claim. Sign out and sign back in to refresh the ID token.

**Important first-admin setup:** The initial user profile document must be created manually in Firestore before the admin dashboard can be used. Set its document ID to the user's Firebase Auth UID and fields:
`displayName` (string), `email` (string), `status: "approved"`, `role: "admin"`.

## 4. Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## 5. Deploy on Vercel

1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New > Project** and import the repository.
3. Add the six `NEXT_PUBLIC_FIREBASE_*` web config variables in Vercel Project Settings > Environment Variables.
4. Add the three `FIREBASE_*` server-only values only if you later add server-side admin functions. Never expose service account credentials in browser code.
5. Deploy.

## Important implementation note

This is a functional starter, not a finished production launch. Registration currently creates an Auth account and a queue request; the admin must create the matching `users/{uid}` profile document before reviewing it. Before public launch, complete that profile provisioning step with a trusted Cloud Function or server endpoint, add rate limiting / abuse controls, email verification, password reset, moderation/reporting workflows, and test Firestore rules in the Firebase Emulator Suite.

Do not put Firebase service-account JSON, private keys, passwords or other secrets in GitHub.
