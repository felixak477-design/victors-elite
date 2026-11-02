
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  addDoc, collection, doc, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type Request = {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  status: string;
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [notice, setNotice] = useState({
    title: "", body: "", type: "Announcement", date: ""
  });
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => onAuthStateChanged(auth, async current => {
    setUser(current);
    if (!current) {
      router.replace("/");
      return;
    }
    const token = await current.getIdTokenResult(true);
    if (token.claims.admin !== true) {
      setAllowed(false);
      setMessage("This account does not have administrator access.");
      return;
    }
    setAllowed(true);
  }), [router]);

  useEffect(() => {
    if (!allowed) return;
    return onSnapshot(
      query(collection(db, "registrationQueue"), orderBy("createdAt", "desc")),
      snap => setRequests(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Request))
      )
    );
  }, [allowed]);

  async function review(item: Request, status: "approved" | "declined") {
    try {
      await updateDoc(doc(db, "registrationQueue", item.id), {
        status, reviewedAt: serverTimestamp()
      });
      await updateDoc(doc(db, "users", item.uid), { status });
      setMessage(`${item.displayName} marked ${status}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update registration.");
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addDoc(collection(db, "notices"), {
        ...notice,
        createdAt: serverTimestamp(),
        createdBy: user?.uid
      });
      setNotice({ title: "", body: "", type: "Announcement", date: "" });
      setMessage("Community update published.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not publish update.");
    }
  }

  if (!allowed) {
    return (
      <main className="adminShell">
        <a href="/">← Back to THE VICTORS</a>
        <div className="panel">
          <h1>Administrator access</h1>
          <p>{message || "Checking access…"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <header className="adminHeader">
        <div>
          <div className="eyebrow">THE VICTORS</div>
          <h1>Admin dashboard</h1>
          <p>Review membership and keep the community updated.</p>
        </div>
        <a className="outlineDark" href="/">Back to website</a>
      </header>

      <section className="panel">
        <h2>Registration requests</h2>
        {requests.filter(r => r.status === "pending").length === 0
          ? <p className="muted">No pending registrations.</p>
          : requests.filter(r => r.status === "pending").map(r => (
            <div className="request" key={r.id}>
              <div>
                <b>{r.displayName}</b>
                <small>{r.email}</small>
              </div>
              <div className="actions">
                <button onClick={() => review(r, "approved")} className="approve">
                  Approve
                </button>
                <button onClick={() => review(r, "declined")} className="decline">
                  Decline
                </button>
              </div>
            </div>
          ))}
      </section>

      <section className="panel">
        <h2>Publish an update</h2>
        <p className="muted">
          Use this for announcements, exam reminders and daily activities.
        </p>
        <form className="adminForm" onSubmit={publish}>
          <input required maxLength={120} placeholder="Title"
            value={notice.title}
            onChange={e => setNotice({ ...notice, title: e.target.value })} />
          <select value={notice.type}
            onChange={e => setNotice({ ...notice, type: e.target.value })}>
            <option>Announcement</option>
            <option>Exam reminder</option>
            <option>Daily activity</option>
            <option>Opportunity</option>
          </select>
          <input type="date" value={notice.date}
            onChange={e => setNotice({ ...notice, date: e.target.value })} />
          <textarea required maxLength={4000} placeholder="Write the update…"
            value={notice.body}
            onChange={e => setNotice({ ...notice, body: e.target.value })} />
          <button className="primaryButton">Publish update</button>
        </form>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
