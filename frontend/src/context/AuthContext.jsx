import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  apiFetch,
  clearSession,
  getCurrentUser,
  setCurrentUser
} from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => getCurrentUser());

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    if (nextUser) setCurrentUser(nextUser);
  }, []);

  const clearUser = useCallback(() => {
    clearSession();
    setUserState(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUserState(null);
    apiFetch('/auth/logout', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        window.location.href = '/';
      });
  }, []);

  const value = useMemo(
    () => ({ user, setUser, clearUser, logout }),
    [user, setUser, clearUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
