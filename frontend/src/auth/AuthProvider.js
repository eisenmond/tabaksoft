import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, configureAuth, refreshSession } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef(null);
  const setSession = (next) => { sessionRef.current = next; setSessionState(next); };

  configureAuth({
    getAccessToken: () => sessionRef.current?.accessToken || null,
    onSession: setSession,
    onSignOut: () => setSession(null),
  });

  useEffect(() => {
    let active = true;
    refreshSession().catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (credentials) => {
    const next = await api("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
    setSession(next);
  };
  const logout = async () => {
    try { await api("/auth/logout", { method: "POST" }); }
    finally { setSession(null); }
  };

  return <AuthContext.Provider value={{ session, user: session?.user || null, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
