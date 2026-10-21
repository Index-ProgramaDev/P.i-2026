import React, { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Shield,
  LayoutDashboard,
  Camera,
  Bell,
  FileCheck2,
  LogOut,
} from "lucide-react";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Câmeras", path: "/cameras", icon: Camera },
    { name: "Alertas", path: "/alerts", icon: Bell },
    { name: "Evidências", path: "/events", icon: FileCheck2 },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>
      {/* Sidebar Desktop (190-220px) */}
      <aside
        style={{
          width: "var(--sidebar-width)",
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          padding: "18px 12px",
          gap: "20px",
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 40,
        }}
      >
        {/* Logo CamSecurity */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 6px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--primary-red)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Shield size={18} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "-0.02em", color: "var(--text-main)" }}>
              CamSecurity
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Monitoramento IA
            </div>
          </div>
        </div>

        {/* Lista de Navegação Principal */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path === "/dashboard" && location.pathname === "/");

            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-xs)",
                  color: isActive ? "var(--text-main)" : "var(--text-secondary)",
                  backgroundColor: isActive ? "var(--bg-surface-elevated)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--primary-red)" : "2px solid transparent",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  transition: "all 0.12s ease",
                }}
              >
                <Icon size={16} color={isActive ? "var(--primary-red)" : "var(--text-secondary)"} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Rodapé do Operador */}
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {user ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-main)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.username || "Operador"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.email || "Sessão ativa"}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sair do sistema"
                style={{
                  height: "32px",
                  width: "32px",
                  padding: 0,
                  backgroundColor: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="btn-secondary"
              style={{ width: "100%", height: "34px", fontSize: "12px" }}
            >
              Fazer Login
            </button>
          )}
        </div>
      </aside>

      {/* Conteúdo Principal com Header */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: "50px",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Plataforma Operacional CamSecurity
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
          </span>
        </header>

        <main style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
