
import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

if (!projectId || !clientEmail || !privateKey || !ownerEmail) {
  throw new Error("Required GitHub secrets are missing.");
}

if (projectId !== "thevictors") {
  throw new Error("Wrong Firebase project. Expected thevictors.");
}

if (ownerEmail !== "felixdoly603@gmail.com") {
  throw new Error("Owner email does not match the approved account.");
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n")
  })
});

const auth = admin.auth();
const user = await auth.getUserByEmail(ownerEmail);

const updatedClaims = {
  ...user.customClaims,
  admin: true,
  owner: true
};

await auth.setCustomUserClaims(user.uid, updatedClaims);

console.log("Owner access successfully assigned.");
console.log("Sign out and sign in again to refresh permissions.");

process.exit(0);
