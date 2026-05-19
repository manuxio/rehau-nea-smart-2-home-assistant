import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiClient } from "./apiClient";

interface Session {
  token: string;
  role: "user" | "installer";
  username: string;
  expiresAt: string;
}

interface AuthValue {
  session: Session | null;
  api: ApiClient;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthValue | null>(null);

const STORAGE_KEY = "rehau.session";

const readSession = (): Session | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || new Date(s.expiresAt).getTime() < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());

  const baseUrl = useMemo(() => "" /* same-origin via Vite proxy in dev, Fastify in prod */, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  // Ref-based 401 handler so the ApiClient instance stays stable across
  // session changes — otherwise a sign-out triggered by 401 would race with
  // the TanStack Query refetch that exposed it in the first place.
  const onUnauthorizedRef = useRef<() => void>(() => {});
  onUnauthorizedRef.current = () => {
    if (session !== null) {
      toast.error("Sessione scaduta — accedi di nuovo");
      logout();
    }
  };

  const api = useMemo(
    () => new ApiClient(baseUrl, () => session?.token ?? null, () => onUnauthorizedRef.current()),
    [baseUrl, session?.token],
  );

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.auth.login(username, password);
    const s: Session = {
      token: r.token,
      role: r.role,
      username,
      expiresAt: r.expiresAt,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSession(s);
  }, [api]);

  // Try HA ingress auto-login exactly once when there's no session yet.
  // If the bridge is reached through HA's ingress proxy this returns a token
  // immediately. Otherwise it 401's silently and we fall back to the form.
  const triedIngressRef = useRef(false);
  useEffect(() => {
    if (session || triedIngressRef.current) return;
    triedIngressRef.current = true;
    api.auth
      .ingress()
      .then((r) => {
        const s: Session = {
          token: r.token,
          role: r.role,
          username: "ingress",
          expiresAt: r.expiresAt,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        setSession(s);
      })
      .catch(() => {
        // Not via ingress (or ingress disabled). Login form will render.
      });
  }, [api, session]);

  return (
    <AuthCtx.Provider value={{ session, api, login, logout }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = (): AuthValue => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth: missing AuthProvider");
  return ctx;
};
