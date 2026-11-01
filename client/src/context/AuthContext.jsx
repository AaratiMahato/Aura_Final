import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const expire = useCallback(() => {
    sessionStorage.setItem('sessionExpired', '1');
    api.post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  // Server says the session is over
  useEffect(() => {
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, [expire]);

  // Idle timer: sign out after N minutes without activity; activity keeps the server session alive
  useEffect(() => {
    if (!user) return;
    const idleMs = (user.sessionMinutes || 3) * 60 * 1000;
    let last = Date.now();
    let lastPing = Date.now();
    const onActivity = () => {
      last = Date.now();
      if (last - lastPing > 45000) {
        lastPing = last;
        api.get('/auth/me').catch(() => {});
      }
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last > idleMs) expire();
    }, 5000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      clearInterval(timer);
    };
  }, [user, expire]);

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, setUser, loading, refresh, logout }}>{children}</Ctx.Provider>;
}
