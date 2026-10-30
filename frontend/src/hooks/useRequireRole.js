import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, getToken, readJson } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Mirrors the original checkAuth(): verify the stored token, persist the full
// profile, redirect unauthenticated users home, and bounce users who are on the
// wrong role's dashboard. Returning the context user keeps updates such as
// "assign a doctor" visible without a reload.
export function useRequireRole(requiredRole) {
  const navigate = useNavigate();
  const { user, setUser, clearUser } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const token = getToken();
      if (!token) {
        clearUser();
        setChecking(false);
        navigate('/', { replace: true });
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await readJson(res);

        if (!res.ok || !data.success || !data.user) {
          clearUser();
          navigate('/', { replace: true });
          return;
        }

        setUser(data.user);

        if (requiredRole && data.user.role !== requiredRole) {
          navigate(data.user.role === 'doctor' ? '/doctor' : '/patient', { replace: true });
          return;
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        clearUser();
        navigate('/', { replace: true });
      } finally {
        if (active) setChecking(false);
      }
    };

    verify();

    return () => {
      active = false;
    };
  }, [requiredRole, navigate, setUser, clearUser]);

  return { user, checking };
}
