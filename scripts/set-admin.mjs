import admin from "firebase-admin";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Firebase Admin credentials are not configured.");
}

if (projectId !== "thevictors") {
  throw new Error("Wrong Firebase project. Expected thevictors.");
}

const rl = readline.createInterface({ input, output });

const email = (
  await rl.question("Enter the existing Firebase account email: ")
).trim();

rl.close();

if (!email.includes("@")) {
  throw new Error("Please enter a valid email address.");
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n")
  })
});

const auth = admin.auth();
const user = await auth.getUserByEmail(email);

const updatedClaims = {
  ...user.customClaims,
  admin: true,
  owner: true
};

await auth.setCustomUserClaims(user.uid, updatedClaims);

console.log(`Owner access successfully assigned to ${email}.`);
console.log("Sign out and sign in again to refresh your permissions.");

process.exit(0);
