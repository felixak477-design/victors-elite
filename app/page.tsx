
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

type Profile = {
  displayName: string;
  email: string;
  status: "pending" | "approved" | "declined";
  role?: "member" | "admin";
};

type Post = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt?: { toDate: () => Date };
};

type Notice = {
  id: string;
  title: string;
  body: string;
  type: string;
  date?: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [post, setPost] = useState({
    title: "",
    body: ""
  });

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;

    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      const version = ++requestVersion;

      setAuthReady(false);
      setUser(current);
      setProfile(null);

      if (!current) {
        setAuthReady(true);
        return;
      }

      try {
        const token = await current.getIdTokenResult(true);
        const snap = await getDoc(doc(db, "users", current.uid));

        if (!active || version !== requestVersion) return;

        if (snap.exists()) {
          setProfile({
            ...snap.data(),
            role: token.claims.admin === true ? "admin" : "member"
          } as Profile);
        } else {
          setProfile(null);
        }
      } catch {
        if (!active || version !== requestVersion) return;
        setProfile(null);
      } finally {
        if (active && version === requestVersion) {
          setAuthReady(true);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const approved = profile?.status === "approved";
  const admin = profile?.role === "admin";
  const canAccessPrivateContent =
    authReady && !!user && (approved || admin);

  useEffect(() => {
    if (!canAccessPrivateContent) {
      setPosts([]);
      return;
    }

    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      (snap) => {
        setPosts(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          } as Post))
        );
      },
      () => setPosts([])
    );
  }, [canAccessPrivateContent]);

  useEffect(() => {
    if (!canAccessPrivateContent) {
      setNotices([]);
      return;
    }

    const q = query(
      collection(db, "notices"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      (snap) => {
        setNotices(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          } as Notice))
        );
      },
      () => setNotices([])
    );
  }, [canAccessPrivateContent]);

  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (authMode === "register") {
        const {
          createUserWithEmailAndPassword,
          updateProfile
        } = await import("firebase/auth");

        const credential = await createUserWithEmailAndPassword(
          auth,
          form.email.trim(),
          form.password
        );

        await updateProfile(credential.user, {
          displayName: form.name.trim()
        });

        await setDoc(doc(db, "users", credential.user.uid), {
          displayName: form.name.trim(),
          email: form.email.trim(),
          status: "pending",
          role: "member"
        });

        await addDoc(collection(db, "registrationQueue"), {
          uid: credential.user.uid,
          displayName: form.name.trim(),
          email: form.email.trim(),
          status: "pending",
          createdAt: serverTimestamp()
        });

        setProfile({
          displayName: form.name.trim(),
          email: form.email.trim(),
          status: "pending",
          role: "member"
        });

        setMessage(
          "Registration submitted. Your account is waiting for administrator approval."
        );
      } else {
        const { signInWithEmailAndPassword } =
          await import("firebase/auth");

        await signInWithEmailAndPassword(
          auth,
          form.email.trim(),
          form.password
        );

        setMessage("Signed in. Checking your membership status…");
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  async function publishPost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user || !canAccessPrivateContent) {
      setMessage("You do not have permission to publish.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await addDoc(collection(db, "posts"), {
        title: post.title.trim(),
        body: post.body.trim(),
        authorUid: user.uid,
        authorName: profile?.displayName || "Member",
        createdAt: serverTimestamp()
      });

      setPost({ title: "", body: "" });
      setMessage("Your post has been published.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not publish post."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brandMark">V</span>
          <span>
            THE VICTORS
            <small>COMMUNITY • LEARNING • UNITY</small>
          </span>
        </a>

        <nav>
          <a href="#features">What we do</a>
          {canAccessPrivateContent && (
            <a href="#community">Community</a>
          )}
          {admin && <a href="/admin">Admin</a>}

          {user ? (
            <button
              className="smallButton"
              onClick={() => signOut(auth)}
            >
              Sign out
            </button>
          ) : (
            <a className="navJoin" href="#account">Join us</a>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="eyebrow">
          ONE COMMUNITY. ENDLESS POSSIBILITIES.
        </div>

        <h1>
          Learn together.
          <br />
          <em>Rise together.</em>
        </h1>

        <p>
          THE VICTORS connects ambitious learners and members
          to share knowledge, support one another and turn ideas
          into achievement.
        </p>

        <div className="heroActions">
          <a className="primaryButton" href="#account">
            Become a member ↗
          </a>
          <a className="outlineButton" href="#features">
            Explore the community
          </a>
        </div>

        <div className="motto">
          <span>KNOWLEDGE IS POWER</span>
          <span>UNITY IS STRENGTH</span>
          <span>SUCCESS IS OUR MISSION</span>
        </div>
      </section>

      <section className="section" id="features">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">BUILT FOR PROGRESS</div>
            <h2>Everything in one place.</h2>
          </div>
          <p>
            A practical space to stay informed, exchange ideas
            and keep the community moving forward.
          </p>
        </div>

        <div className="featureGrid">
          {[
            ["✦", "Community discussions", "Share ideas, ask questions and learn from other members."],
            ["▤", "Homework & revision", "Exchange homework, notes and useful learning resources."],
            ["◷", "Exam reminders", "Keep important dates, deadlines and exam reminders in view."],
            ["◎", "Daily activities", "Join community tasks, challenges and activities."],
            ["↗", "Opportunities", "Share opportunities and information that help members grow."],
            ["♧", "Teamwork & unity", "Build a supportive culture of collaboration and progress."]
          ].map(([icon, title, desc]) => (
            <article className="feature" key={title}>
              <span>{icon}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {canAccessPrivateContent && (
        <section className="section community" id="community">
          <div className="sectionHead">
            <div>
              <div className="eyebrow">THE MEMBERS' SPACE</div>
              <h2>Community board.</h2>
            </div>
            <p>
              Welcome to the private THE VICTORS members' area.
            </p>
          </div>

          <form className="panel postForm" onSubmit={publishPost}>
            <h3>Create a post</h3>

            <input
              required
              maxLength={100}
              placeholder="Post title"
              value={post.title}
              onChange={(e) =>
                setPost({ ...post, title: e.target.value })
              }
            />

            <textarea
              required
              maxLength={3000}
              placeholder="Share a question, homework or idea…"
              value={post.body}
              onChange={(e) =>
                setPost({ ...post, body: e.target.value })
              }
            />

            <button className="primaryButton" disabled={busy}>
              {busy ? "Publishing…" : "Publish post"}
            </button>
          </form>

          <div className="postList">
            {posts.map((item) => (
              <article className="panel post" key={item.id}>
                <div className="postMeta">
                  {item.authorName || "Member"} ·{" "}
                  {item.createdAt?.toDate?.().toLocaleString() || "Just now"}
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}

            {posts.length === 0 && (
              <div className="panel muted">
                No posts yet. Be the first to start a useful discussion.
              </div>
            )}
          </div>

          <div className="sectionHead noticeHead">
            <div>
              <div className="eyebrow">KEEP UP TO DATE</div>
              <h2>Announcements & activities.</h2>
            </div>
          </div>

          <div className="noticeGrid">
            {notices.map((n) => (
              <article className="panel" key={n.id}>
                <span className="tag">
                  {n.type || "ANNOUNCEMENT"}
                </span>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                {n.date && <small>{n.date}</small>}
              </article>
            ))}

            {notices.length === 0 && (
              <div className="panel muted">
                New announcements, exam reminders and activities
                will appear here.
              </div>
            )}
          </div>
        </section>
      )}

      <section className="section account" id="account">
        <div className="accountCard">
          <div className="eyebrow">
            BECOME PART OF THE COMMUNITY
          </div>

          <h2>
            {user
              ? `Welcome${profile?.displayName ? `, ${profile.displayName}` : ""}`
              : "Your next chapter starts here."}
          </h2>

          {user ? (
            <>
              <p>
                {!authReady
                  ? "Checking your membership status…"
                  : admin
                    ? "You have administrator access. Welcome to THE VICTORS."
                    : approved
                      ? "Your membership is active. Take part in the community."
                      : profile?.status === "declined"
                        ? "Your registration was not approved. Contact a community administrator for help."
                        : profile?.status === "pending"
                          ? "Your registration is awaiting approval. Member access will open after approval."
                          : "We could not verify your membership profile. Please contact an administrator."}
              </p>

              {admin && (
                <a className="primaryButton" href="/admin">
                  Open admin dashboard ↗
                </a>
              )}

              {canAccessPrivateContent && (
                <a className="outlineButton" href="#community">
                  Open members' area
                </a>
              )}
            </>
          ) : (
            <>
              <div className="tabs">
                <button
                  type="button"
                  className={authMode === "register" ? "selected" : ""}
                  onClick={() => setAuthMode("register")}
                >
                  Create account
                </button>

                <button
                  type="button"
                  className={authMode === "login" ? "selected" : ""}
                  onClick={() => setAuthMode("login")}
                >
                  Sign in
                </button>
              </div>

              <form onSubmit={submitAuth}>
                {authMode === "register" && (
                  <input
                    required
                    minLength={2}
                    maxLength={70}
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                  />
                )}

                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />

                <input
                  required
                  minLength={8}
                  type="password"
                  placeholder="Password (at least 8 characters)"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />

                <button className="primaryButton" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : authMode === "register"
                      ? "Submit registration"
                      : "Sign in"}
                </button>
              </form>
            </>
          )}

          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}

          <small>
            Membership requests are reviewed by community
            administrators. Keep your account details private.
          </small>
        </div>
      </section>

      <footer>
        <b>THE VICTORS</b>
        <span>
          Knowledge is Power. Unity is Strength. Success is Our Mission.
        </span>
        <span>© {new Date().getFullYear()} THE VICTORS</span>
      </footer>
    </main>
  );
}
