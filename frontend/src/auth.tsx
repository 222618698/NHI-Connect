import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { Role, SessionUser } from './types';

interface AuthState {
  user: SessionUser | null;
  /** True while an existing session is being checked on page load. */
  checking: boolean;
  /** Notice shown on the sign-in page, e.g. after a session expires. */
  notice: string | null;
  login: (username: string, password: string, role: Role) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(() => tokenStore.get() !== null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setNotice('Your session has ended. Please sign in again.');
    });
    if (!tokenStore.get()) return;
    api.me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setChecking(false));
  }, []);

  const login = async (username: string, password: string, role: Role) => {
    const result = await api.login(username, password, role);
    tokenStore.set(result.token);
    setNotice(null);
    setUser(result.user);
  };

  const logout = () => {
    api.logout().catch(() => {});
    tokenStore.clear();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, checking, notice, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
