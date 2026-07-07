import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiGet, apiPost } from "../services/api";
import { useSessionTimeout } from "../hooks/useSessionTimeout";
import {
  clearAccessToken,
  clearLegacyPersistentToken,
  isSessionExpired,
  setAccessToken,
} from "../lib/sessionAuth";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await apiPost("auth/logout");
    } catch {
      /* ignore */
    }
    clearAccessToken();
    setUser(null);
  }, []);

  useSessionTimeout(Boolean(user), logout);

  useEffect(() => {
    clearLegacyPersistentToken();

    if (isSessionExpired()) {
      clearAccessToken();
      setUser(null);
      setLoading(false);
      return;
    }

    apiGet<Profile>("auth/me")
      .then(setUser)
      .catch(() => {
        clearAccessToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onSessionExpired() {
      setUser(null);
    }
    window.addEventListener("apex:session-expired", onSessionExpired);
    return () => window.removeEventListener("apex:session-expired", onSessionExpired);
  }, []);

  async function login(email: string, password: string) {
    const data = await apiPost<Profile & { token?: string }>("auth/login", { email, password });
    if (data.token) setAccessToken(data.token);
    setUser(data);
  }

  async function register(email: string, password: string) {
    const data = await apiPost<Profile & { token?: string }>("auth/register", { email, password });
    if (data.token) setAccessToken(data.token);
    setUser(data);
  }

  async function refreshUser() {
    const data = await apiGet<Profile>("auth/me");
    setUser(data);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
