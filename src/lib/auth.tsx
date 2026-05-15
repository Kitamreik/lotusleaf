import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { firebaseEnabled, fbAuth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { logAudit, rateLimit, safeText } from "./security";

type Session = { email: string } | null;

type AuthCtx = {
  session: Session;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
// Legacy key — cleared on load to invalidate any pre-existing forged sessions.
const LEGACY_SESSION_KEY = "lotus.session.email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SECURITY: never restore a session from localStorage. The previous
    // fallback path trusted a plain email string in localStorage, which any
    // visitor could set via DevTools to gain full admin access. Authentication
    // now requires Firebase Auth — no offline/local admin shortcut.
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* noop */ }
    }
    if (firebaseEnabled && fbAuth) {
      const unsub = onAuthStateChanged(fbAuth, (u) => {
        setSession(u?.email ? { email: u.email } : null);
        // For audit attribution only — never used to grant access.
        try {
          if (u?.email) localStorage.setItem(LEGACY_SESSION_KEY, u.email);
          else localStorage.removeItem(LEGACY_SESSION_KEY);
        } catch { /* noop */ }
        setLoading(false);
      });
      return unsub;
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const e = safeText(email, 200).toLowerCase();
    if (!rateLimit(`login:${e}`, 5, 60_000)) {
      logAudit("auth.login.rate_limited", e);
      throw new Error("Too many attempts. Wait a minute.");
    }
    if (!(firebaseEnabled && fbAuth)) {
      logAudit("auth.login.fail", e);
      throw new Error(
        "Authentication unavailable: Firebase is not configured. " +
        "Set the VITE_FIREBASE_* env vars and restart.",
      );
    }
    try {
      await signInWithEmailAndPassword(fbAuth, e, password);
      logAudit("auth.login.success", e);
    } catch (err) {
      logAudit("auth.login.fail", e);
      throw new Error("Invalid credentials");
    }
  };

  const logout = async () => {
    const who = session?.email ?? "unknown";
    if (firebaseEnabled && fbAuth) await signOut(fbAuth);
    setSession(null);
    logAudit("auth.logout", who);
  };

  return <Ctx.Provider value={{ session, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
