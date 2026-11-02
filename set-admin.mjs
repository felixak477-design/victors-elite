import admin from "firebase-admin";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const email = await rl.question("Email address of the existing Firebase user to make admin: ");
rl.close();

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error("Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY first.");
}
if (!email.includes("@")) throw new Error("Enter a valid email address.");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

const user = await admin.auth().getUserByEmail(email.trim());
await admin.auth().setCustomUserClaims(user.uid, { admin: true });
console.log(`Administrator role assigned to ${email}. Sign out and sign in again to refresh the token.`);
process.exit(0);
