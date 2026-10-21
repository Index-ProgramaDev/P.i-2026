import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("camsec_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [serverHealth, setServerHealth] = useState({ online: false, db: false });

  useEffect(() => {
    const check = async () => {
      try {
        const data = await api.getHealth();
        setServerHealth({
          online: data.status === "online",
          db: !!data.db,
        });
      } catch {
        setServerHealth({ online: false, db: false });
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("camsec_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("camsec_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, serverHealth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Separar hook em constante para Fast Refresh
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
};
