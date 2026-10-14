import { useEffect, useState } from "react";
import { api } from "./api/client";
import { useAuth } from "./auth/AuthProvider";
import "./App.css";

const emptyUser = { name: "", email: "", role: "user" };

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try { await onLogin(form); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  return <main className="login-page"><section className="login-card">
    <div className="mark">M</div><p className="kicker">MERN BASIC</p><h1>Welcome back.</h1>
    <p className="login-intro">Sign in to manage your site, people, and publishing workflow.</p>
    <form onSubmit={submit}>
      <label>Email address<input autoFocus required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@example.com" /></label>
      <label>Password<input required minLength="12" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Your password" /></label>
      {error && <p className="notice error">{error}</p>}
      <button className="primary" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
    </form><p className="login-help">The administrator account is created securely during setup.</p>
  </section></main>;
}

function Administration() {
  const [users, setUsers] = useState([]); const [form, setForm] = useState(emptyUser);
  const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true);
  const loadUsers = async () => { try { const data = await api("/users"); setUsers(data.items); } catch (error) { setMessage(error.message); } finally { setLoading(false); } };
  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const createUser = async (event) => {
    event.preventDefault(); setMessage("");
    try { const result = await api("/users", { method: "POST", body: JSON.stringify(form) }); const user = result.user; setUsers([...users, user].sort((a, b) => a.name.localeCompare(b.name))); setForm(emptyUser); setMessage(`${user.name} was invited successfully.`); }
    catch (error) { setMessage(error.message); }
  };
  return <><header className="page-header"><div><p className="kicker">ADMINISTRATION</p><h1>Users</h1><p>Create accounts and decide what each person can do.</p></div><span className="count">{users.length} USERS</span></header>
    <div className="admin-grid"><section className="panel"><div className="panel-title"><h2>Add new user</h2><span>Required fields</span></div><form className="user-form" onSubmit={createUser}>
      <label>Full name<input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" /></label>
      <label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" /></label>
      <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></label>
      {message && <p className={`notice ${message.includes("successfully") ? "success" : "error"}`}>{message}</p>}<button className="primary">Send invitation</button>
    </form></section><section className="panel user-list"><div className="panel-title"><h2>All users</h2><span>STATUS</span></div>{loading ? <p className="empty">Loading users…</p> : users.map((user) => <article key={user.id}><div className="avatar">{user.name.charAt(0).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.email} · {user.emailVerified ? "verified" : "invited"}</small></div><span className={`role ${user.role}`}>{user.status}</span><button className="mini" onClick={async () => { const updated = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: user.status === "suspended" ? "active" : "suspended" }) }); setUsers(users.map((item) => item.id === updated.id ? updated : item)); }}>{user.status === "suspended" ? "Reactivate" : "Suspend"}</button></article>)}</section></div></>;
}

function Dashboard({ session }) {
  return <><header className="page-header"><div><p className="kicker">OVERVIEW</p><h1>Dashboard</h1><p>Welcome back, {session.user.name}. Here is what is happening with your site.</p></div><span className="date">SITE ADMIN</span></header>
    <div className="stats"><article><span>01</span><strong>Ready</strong><p>Site status</p></article><article><span>02</span><strong>{session.user.role}</strong><p>Your role</p></article><article><span>03</span><strong>Secure</strong><p>Authentication</p></article></div>
    <section className="welcome-panel"><div><p className="kicker">GET STARTED</p><h2>Your publishing home.</h2><p>Use Administration to invite your team and give each person the right level of access.</p></div><div className="quick-note"><b>Role guide</b><p><strong>Admin</strong> manages users and the whole site.</p><p><strong>Moderator</strong> oversees content and conversations.</p><p><strong>User</strong> has standard site access.</p></div></section></>;
}

function App() {
  const { session, loading, login, logout } = useAuth();
  const [page, setPage] = useState("dashboard");
  if (loading) return <main className="login-page"><p className="empty" role="status">Restoring your session…</p></main>;
  if (!session) return <Login onLogin={login} />;
  return <div className="admin-shell"><aside className="sidebar"><div className="side-brand"><span>M</span><div>MERN BASIC<small>Publishing platform</small></div></div><nav className="side-nav"><p>WORKSPACE</p><button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}><i>⌂</i>Dashboard</button>{session.user.role === "admin" && <><p>MANAGE</p><button className={page === "administration" ? "active" : ""} onClick={() => setPage("administration")}><i>♙</i>Administration</button></>}</nav><div className="side-user"><div className="avatar">{session.user.name.charAt(0)}</div><div><strong>{session.user.name}</strong><small>{session.user.role}</small></div><button onClick={logout} title="Sign out">↗</button></div></aside><main className="content">{page === "administration" ? <Administration /> : <Dashboard session={session} />}</main></div>;
}
export default App;
