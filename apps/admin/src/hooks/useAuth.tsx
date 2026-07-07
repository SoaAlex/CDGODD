import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API, authHeaders } from '../lib/api';

interface AuthContextValue {
  token: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /** Verify a bearer token against the API, then persist it on success. */
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  headers: Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(
    () => sessionStorage.getItem('admin_token') ?? '',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (candidate: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // /admin/stats is the cheapest authenticated probe.
      const res = await fetch(`${API}/admin/stats`, {
        headers: authHeaders(candidate),
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'Invalid token' : `API ${res.status}`);
        return false;
      }
      sessionStorage.setItem('admin_token', candidate);
      setToken(candidate);
      return true;
    } catch {
      setError('Network error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('admin_token');
    setToken('');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: token !== '',
      isLoading,
      error,
      login,
      logout,
      headers: authHeaders(token),
    }),
    [token, isLoading, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
