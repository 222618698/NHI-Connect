import { createContext, useContext, useState, type ReactNode } from 'react';

// Step 1: local-only sign-in. Step 2 replaces this with JWT from /security/api/v1/auth/login.
interface AuthState {
  username: string | null;
  login: (username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem('nhi.user'));
  const login = (u: string) => { sessionStorage.setItem('nhi.user', u); setUsername(u); };
  const logout = () => { sessionStorage.removeItem('nhi.user'); setUsername(null); };
  return <AuthContext.Provider value={{ username, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
