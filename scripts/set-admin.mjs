
import admin from "firebase-admin";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

try {
  const email = (
    await rl.question("Email of the existing Firebase user: ")
  ).trim();

  const role = (
    await rl.question("Role to assign (admin or owner): ")
  ).trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (!["admin", "owner"].includes(role)) {
    throw new Error("Role must be admin or owner.");
  }

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env;

  if (
    !FIREBASE_PROJECT_ID ||
    !FIREBASE_CLIENT_EMAIL ||
    !FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      "Firebase Admin environment variables are not configured."
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  const auth = admin.auth();
  const user = await auth.getUserByEmail(email);

  // Preserve all existing custom claims.
  const existingClaims = user.customClaims || {};
  const updatedClaims = {
    ...existingClaims,
    admin: true,
  };

  if (role === "owner") {
    updatedClaims.owner = true;
  }

  await auth.setCustomUserClaims(user.uid, updatedClaims);

  console.log(
    `Successfully assigned ${role} access to ${user.email}.`
  );
  console.log("The user must sign out and sign in again to refresh access.");
} catch (error) {
  console.error(
    "Could not update the Firebase role:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
} finally {
  rl.close();
}
