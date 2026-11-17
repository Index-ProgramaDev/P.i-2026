import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setAuthToken, clearAuthToken, getAuthToken } from "../api";

const AuthContext = createContext(null);
const USER_KEY = "camsec_user";
const TOKEN_KEY = "camsec_token";

function readStored() {
  try {
    const userRaw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    return { user: userRaw ? JSON.parse(userRaw) : null, token };
  } catch {
    return { user: null, token: null };
  }
}

export const AuthProvider = ({ children }) => {
  const [stored] = useState(readStored);
  const [user, setUser] = useState(stored.user);

  const [serverHealth, setServerHealth] = useState({ online: false, db: false });

  useEffect(() => {
    if (stored.token) setAuthToken(stored.token);
    const onUnauthorized = () => logout();
    window.addEventListener("camsec:unauthorized", onUnauthorized);
    return () => window.removeEventListener("camsec:unauthorized", onUnauthorized);
  }, [stored.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const check = async () => {
      try {
        const data = await api.getHealth();
        setServerHealth({ online: data.status === "online", db: !!data.db });
      } catch {
        setServerHealth({ online: false, db: false });
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const login = (userData, token, remember = true) => {
    setUser(userData);
    setAuthToken(token);
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(USER_KEY, JSON.stringify(userData));
    if (token) store.setItem(TOKEN_KEY, token);
    other.removeItem(USER_KEY);
    other.removeItem(TOKEN_KEY);
  };

  const logout = () => {
    setUser(null);
    clearAuthToken();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, serverHealth, getToken: getAuthToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
};
