
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type Member = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  createdAt: string;
  lastSignIn: string | null;
  status: string;
  role: string;
  isOwner: boolean;
};

type Action =
  | "approve"
  | "decline"
  | "suspend"
  | "reactivate"
  | "makeAdmin"
  | "removeAdmin"
  | "delete";

export default function AdminPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [owner, setOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState({
    title: "",
    body: "",
    type: "Announcement",
    date: "",
  });

  const loadMembers = useCallback(async (current: User) => {
    const token = await current.getIdToken();
    const response = await fetch("/api/admin/members", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load members.");
    }

    setMembers(data.members || []);

    if (data.hasMore) {
      setMessage("Showing the first 1,000 accounts. More accounts are available.");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      setUser(current);

      if (!current) {
        router.replace("/");
        return;
      }

      try {
        const token = await current.getIdTokenResult(true);

        if (token.claims.admin !== true) {
          setAllowed(false);
          setMessage("This account does not have administrator access.");
          setLoading(false);
          return;
        }

        setOwner(token.claims.owner === true);
        setAllowed(true);
        await loadMembers(current);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Access check failed.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, loadMembers]);

  async function performAction(member: Member, action: Action) {
    const labels: Record<Action, string> = {
      approve: "approve this member",
      decline: "decline this registration",
      suspend: "suspend this account",
      reactivate: "reactivate this account",
      makeAdmin: "make this member an administrator",
      removeAdmin: "remove administrator privileges",
      delete: "permanently delete this account",
    };

    if (!window.confirm(`Are you sure you want to ${labels[action]}?`)) {
      return;
    }

    setBusy(member.uid);
    setMessage("");

    try {
      if (!user) throw new Error("Please sign in again.");

      const token = await user.getIdToken();
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: member.uid, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action failed.");
      }

      setMessage(`Success: ${labels[action]}.`);
      await loadMembers(user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy("");
    }
  }

  async function publish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setBusy("notice");
    setMessage("");

    try {
      await addDoc(collection(db, "notices"), {
        ...notice,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      setNotice({
        title: "",
        body: "",
        type: "Announcement",
        date: "",
      });

      setMessage("Community update published successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish update.");
    } finally {
      setBusy("");
    }
  }

  const visibleMembers = useMemo(() => {
    const term = search.toLowerCase().trim();

    return members.filter((member) => {
      const matchesSearch =
        member.displayName.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term);

      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && member.status === "pending") ||
        (filter === "approved" && member.status === "approved") ||
        (filter === "admins" && member.role === "admin") ||
        (filter === "suspended" && member.disabled);

      return matchesSearch && matchesFilter;
    });
  }, [members, search, filter]);

  const pendingCount = members.filter((m) => m.status === "pending").length;
  const approvedCount = members.filter((m) => m.status === "approved").length;
  const adminCount = members.filter((m) => m.role === "admin").length;

  if (loading) {
    return <main className="adminShell"><div className="panel">Checking administrator access…</div></main>;
  }

  if (!allowed) {
    return (
      <main className="adminShell">
        <a href="/">← Back to THE VICTORS</a>
        <div className="panel">
          <h1>Administrator access</h1>
          <p>{message || "Access denied."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <header className="adminHeader">
        <div>
          <div className="eyebrow">THE VICTORS • CONTROL CENTRE</div>
          <h1>Member Management</h1>
          <p>Manage accounts, registrations and community updates.</p>
        </div>
        <a className="outlineDark" href="/">Back to website</a>
      </header>

      {message && (
        <div className="panel" role="status" style={{ marginBottom: 18 }}>
          {message}
        </div>
      )}

      <section className="featureGrid" style={{ marginBottom: 20 }}>
        <div className="feature">
          <span>👥</span>
          <h3>{members.length}</h3>
          <p>Total accounts loaded</p>
        </div>
        <div className="feature">
          <span>⏳</span>
          <h3>{pendingCount}</h3>
          <p>Pending registrations</p>
        </div>
        <div className="feature">
          <span>✓</span>
          <h3>{approvedCount}</h3>
          <p>Approved members</p>
        </div>
      </section>

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2>Member accounts</h2>
          <button
            className="primaryButton"
            onClick={() => user && loadMembers(user).catch((e) => setMessage(e.message))}
          >
            Refresh list
          </button>
        </div>

        <p className="muted">
          {adminCount} administrator account(s). Search and filter the account list below.
        </p>

        <div className="adminForm" style={{ marginBottom: 18 }}>
          <input
            placeholder="Search by member name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All accounts</option>
            <option value="pending">Pending registrations</option>
            <option value="approved">Approved members</option>
            <option value="admins">Administrators</option>
            <option value="suspended">Suspended accounts</option>
          </select>
        </div>

        {visibleMembers.length === 0 ? (
          <p className="muted">No matching accounts found.</p>
        ) : (
          visibleMembers.map((member) => (
            <article className="request" key={member.uid}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{member.displayName || "Unnamed member"}</strong>
                <small>{member.email || "No email address"}</small>
                <small>
                  Status: {member.status} · Role: {member.isOwner ? "Owner" : member.role}
                  {member.disabled ? " · Suspended" : ""}
                </small>
                <small>Joined: {member.createdAt || "Unknown"}</small>
              </div>

              <div className="actions" style={{ flexWrap: "wrap" }}>
                {member.status !== "approved" && (
                  <button
                    className="approve"
                    disabled={busy === member.uid}
                    onClick={() => performAction(member, "approve")}
                  >
                    Approve
                  </button>
                )}

                {member.status === "pending" && (
                  <button
                    className="decline"
                    disabled={busy === member.uid}
                    onClick={() => performAction(member, "decline")}
                  >
                    Decline
                  </button>
                )}

                {!member.disabled ? (
                  <button
                    className="decline"
                    disabled={busy === member.uid || member.isOwner}
                    onClick={() => performAction(member, "suspend")}
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    className="approve"
                    disabled={busy === member.uid || member.isOwner}
                    onClick={() => performAction(member, "reactivate")}
                  >
                    Reactivate
                  </button>
                )}

                {owner && !member.isOwner && member.role !== "admin" && (
                  <button
                    className="approve"
                    disabled={busy === member.uid}
                    onClick={() => performAction(member, "makeAdmin")}
                  >
                    Make admin
                  </button>
                )}

                {owner && !member.isOwner && member.role === "admin" && (
                  <button
                    className="decline"
                    disabled={busy === member.uid}
                    onClick={() => performAction(member, "removeAdmin")}
                  >
                    Remove admin
                  </button>
                )}

                {owner && !member.isOwner && (
                  <button
                    className="decline"
                    disabled={busy === member.uid}
                    onClick={() => performAction(member, "delete")}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="panel">
        <h2>Publish a community update</h2>
        <p className="muted">
          Share announcements, exam reminders, activities and opportunities.
        </p>

        <form className="adminForm" onSubmit={publish}>
          <input
            required
            maxLength={120}
            placeholder="Update title"
            value={notice.title}
            onChange={(e) => setNotice({ ...notice, title: e.target.value })}
          />

          <select
            value={notice.type}
            onChange={(e) => setNotice({ ...notice, type: e.target.value })}
          >
            <option>Announcement</option>
            <option>Exam reminder</option>
            <option>Daily activity</option>
            <option>Opportunity</option>
          </select>

          <input
            type="date"
            value={notice.date}
            onChange={(e) => setNotice({ ...notice, date: e.target.value })}
          />

          <textarea
            required
            maxLength={4000}
            placeholder="Write your update…"
            value={notice.body}
            onChange={(e) => setNotice({ ...notice, body: e.target.value })}
          />

          <button className="primaryButton" disabled={busy === "notice"}>
            {busy === "notice" ? "Publishing…" : "Publish update"}
          </button>
        </form>
      </section>
    </main>
  );
}
