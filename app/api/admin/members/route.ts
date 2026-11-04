import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const allowedActions = [
  "approve",
  "decline",
  "suspend",
  "reactivate",
  "makeAdmin",
  "removeAdmin",
  "delete",
] as const;

type Action = (typeof allowedActions)[number];

async function getAccess(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = await adminAuth.verifyIdToken(
    header.slice(7),
    true
  );

  if (token.admin !== true) {
    throw new Error("FORBIDDEN");
  }

  return {
    uid: token.uid,
    isOwner: token.owner === true,
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 }
    );
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  console.error("Member management API error:", error);

  return NextResponse.json(
    { error: "A server error occurred. Please try again." },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    await getAccess(request);

    const result = await adminAuth.listUsers(1000);

    const members = await Promise.all(
      result.users.map(async (account) => {
        const profile = await adminDb
          .collection("users")
          .doc(account.uid)
          .get();

        return {
          uid: account.uid,
          email: account.email ?? "",
          displayName: account.displayName ?? "",
          disabled: account.disabled,
          createdAt: account.metadata.creationTime,
          lastSignIn: account.metadata.lastSignInTime ?? null,
          status: profile.data()?.status ?? "unknown",
          role:
            account.customClaims?.admin === true
              ? "admin"
              : "member",
          isOwner: account.customClaims?.owner === true,
        };
      })
    );

    return NextResponse.json({
      members,
      hasMore: Boolean(result.pageToken),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAccess(request);

    let body: { uid?: unknown; action?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const uid = typeof body.uid === "string" ? body.uid : "";
    const action = body.action;

    if (!uid || uid.length > 128) {
      return NextResponse.json(
        { error: "Invalid member ID." },
        { status: 400 }
      );
    }

    if (
      typeof action !== "string" ||
      !allowedActions.includes(action as Action)
    ) {
      return NextResponse.json(
        { error: "Unknown action." },
        { status: 400 }
      );
    }

    if (
      uid === actor.uid &&
      ["delete", "suspend", "removeAdmin"].includes(action)
    ) {
      return NextResponse.json(
        { error: "You cannot perform this action on your own account." },
        { status: 400 }
      );
    }

    const account = await adminAuth.getUser(uid);

    const profileRef = adminDb
      .collection("users")
      .doc(uid);

    const queue = adminDb.collection("registrationQueue");

    const isTargetOwner = account.customClaims?.owner === true;
    const isTargetAdmin = account.customClaims?.admin === true;

    if (isTargetOwner && !actor.isOwner) {
      return NextResponse.json(
        { error: "Only the owner can manage this account." },
        { status: 403 }
      );
    }

    if (
      ["makeAdmin", "removeAdmin", "delete"].includes(action) &&
      !actor.isOwner
    ) {
      return NextResponse.json(
        {
          error:
            "Only the owner can manage administrator roles or delete accounts.",
        },
        { status: 403 }
      );
    }

    if (
      isTargetOwner &&
      ["makeAdmin", "removeAdmin", "delete", "suspend", "reactivate"].includes(action)
    ) {
      return NextResponse.json(
        { error: "The owner account cannot be changed here." },
        { status: 400 }
      );
    }

    if (
      ["makeAdmin", "removeAdmin", "delete"].includes(action) &&
      isTargetAdmin &&
      !actor.isOwner
    ) {
      return NextResponse.json(
        { error: "Only the owner can manage administrator accounts." },
        { status: 403 }
      );
    }

    if (action === "approve" || action === "decline") {
      const status =
        action === "approve" ? "approved" : "declined";

      await profileRef.set(
        { status },
        { merge: true }
      );

      const requests = await queue
        .where("uid", "==", uid)
        .get();

      for (let start = 0; start < requests.docs.length; start += 450) {
        const batch = adminDb.batch();

        requests.docs
          .slice(start, start + 450)
          .forEach((item) => {
            batch.update(item.ref, {
              status,
              reviewedAt: FieldValue.serverTimestamp(),
            });
          });

        await batch.commit();
      }

      return NextResponse.json({ success: true, status });
    }

    if (action === "suspend" || action === "reactivate") {
      await adminAuth.updateUser(uid, {
        disabled: action === "suspend",
      });

      return NextResponse.json({
        success: true,
        disabled: action === "suspend",
      });
    }

    if (action === "makeAdmin" || action === "removeAdmin") {
      const claims = { ...account.customClaims };

      if (action === "makeAdmin") {
        claims.admin = true;
      } else {
        delete claims.admin;
      }

      await adminAuth.setCustomUserClaims(uid, claims);

      await profileRef.set(
        {
          role: action === "makeAdmin" ? "admin" : "member",
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        role: action === "makeAdmin" ? "admin" : "member",
      });
    }

    if (action === "delete") {
      await adminAuth.deleteUser(uid);

      await profileRef.delete();

      const requests = await queue
        .where("uid", "==", uid)
        .get();

      for (let start = 0; start < requests.docs.length; start += 450) {
        const batch = adminDb.batch();

        requests.docs
          .slice(start, start + 450)
          .forEach((item) => batch.delete(item.ref));

        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        deleted: true,
      });
    }

    return NextResponse.json(
      { error: "Unknown action." },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
