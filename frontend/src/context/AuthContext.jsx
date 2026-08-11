import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setUnread(data.unreadNotifCount || 0);
      setUnreadChat(data.unreadChatCount || 0);
    } catch {
      setUser(null);
      setUnread(0);
      setUnreadChat(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function login(email, password) {
    await api.login({ email, password });
    const data = await api.me();
    setUser(data.user);
    setUnread(data.unreadNotifCount || 0);
    setUnreadChat(data.unreadChatCount || 0);
    return data.user;
  }

  async function register(form) {
    await api.register(form);
    const data = await api.me();
    setUser(data.user);
    setUnread(data.unreadNotifCount || 0);
    setUnreadChat(data.unreadChatCount || 0);
    return data.user;
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* session lokal tetap dibersihkan */
    }
    setUser(null);
    setUnread(0);
    setUnreadChat(0);
  }

  return (
    <AuthContext.Provider value={{ user, unread, unreadChat, loading, refresh, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
