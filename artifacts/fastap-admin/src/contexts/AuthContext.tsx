// @refresh reset
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, type AdminUser } from "@/lib/apiClient";

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
