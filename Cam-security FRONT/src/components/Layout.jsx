import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import {
  Search,
  Shield,
  LayoutDashboard,
  Camera,
  Bell,
  FileCheck2,
  LogOut,
  ChevronDown,
  Command,
  Keyboard,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, hint: "Visão geral", key: "D" },
  { name: "Câmeras", path: "/cameras", icon: Camera, hint: "Mosaico ao vivo", key: "C" },
  { name: "Alertas", path: "/alerts", icon: Bell, hint: "Triagem de ocorrências", key: "A" },
  { name: "Evidências", path: "/events", icon: FileCheck2, hint: "Histórico de eventos", key: "E" },
];

function SystemClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const time = now.toLocaleTimeString("pt-BR", { hour12: false });

  return (
    <div
      className="hud-chip"
      title="Relógio do sistema — atualizado em tempo real"
    >
      <span className="pulse-dot online" style={{ width: 6, height: 6 }} />
      <span style={{ textTransform: "capitalize" }}>{date}</span>
      <strong>{time}</strong>
    </div>
  );
}

function Rail({ pendingAlerts, isRecording, onOpenPalette, onLogout }) {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path || (path === "/dashboard" && location.pathname === "/");

  return (
    <aside className="icon-rail">
      <div className="rail-logo" title="CamSecurity">
        <Shield size={19} color="#FFFFFF" />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, width: "100%", alignItems: "center" }}>
        {NAV_ITEMS.map(({ name, path, icon: Icon, key }) => (
          <NavLink
            key={path}
            to={path}
            className={`rail-btn${isActive(path) ? " active" : ""}`}
            aria-label={name}
          >
            <Icon size={19} />
            {path === "/alerts" && pendingAlerts > 0 && (
              <span className="rail-badge">{pendingAlerts > 99 ? "99+" : pendingAlerts}</span>
            )}
            {path === "/cameras" && isRecording && <span className="rail-dot" />}
            <span className="rail-tip">
              {name}
              <span className="rail-tip-key">{key}</span>
            </span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="rail-btn"
        onClick={onOpenPalette}
        aria-label="Paleta de comandos"
        title="Paleta de comandos (Ctrl+K)"
      >
        <Command size={18} />
        <span className="rail-tip">
          Comandos
          <span className="rail-tip-key">Ctrl K</span>
        </span>
      </button>

      <button
        type="button"
        className="rail-btn"
        onClick={() => window.dispatchEvent(new Event("camsec:toggle-shortcuts"))}
        aria-label="Atalhos de teclado"
        title="Atalhos de teclado (?)"
      >
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700 }}>
          ?
        </span>
        <span className="rail-tip">
          Atalhos
          <span className="rail-tip-key">?</span>
        </span>
      </button>

      <button
        type="button"
        className="rail-btn"
        onClick={onLogout}
        aria-label="Sair do sistema"
      >
        <LogOut size={18} />
        <span className="rail-tip">Sair</span>
      </button>
    </aside>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const initials = (user?.username || user?.email || "OP")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="user-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials || "OP"}</span>
        <span style={{ textAlign: "left", lineHeight: 1.15, maxWidth: 140 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.username || "Operador"}
          </span>
          <span style={{ display: "block", fontSize: 10, color: "#64748b", fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {user?.role || "Operador"}
          </span>
        </span>
        <ChevronDown size={14} color="#64748b" style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "230px",
            background: "#0F1117",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 12,
            boxShadow: "0 20px 50px -12px rgba(0,0,0,0.8)",
            padding: 6,
            zIndex: 90,
            animation: "loginScaleIn 0.15s cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <div style={{ padding: "10px 10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{user?.username || "Operador"}</p>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email || "Sessão ativa"}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout(); }}
            className="palette-item"
            style={{ color: "#fca5a5" }}
          >
            <LogOut size={15} />
            Sair do sistema
          </button>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose, cameras, onLogout }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s) => !q || s.toLowerCase().includes(q);

    const screens = NAV_ITEMS.filter((i) => match(i.name) || match(i.hint)).map((i) => ({
      ...i,
      section: "Telas",
      action: () => navigate(i.path),
    }));

    const cams = (cameras || [])
      .filter((c) => match(c.name) || match(c.camera_uid) || match(c.source || ""))
      .map((c) => ({
        name: c.name || c.camera_uid,
        hint: "Conectar",
        icon: Camera,
        section: "Câmeras",
        action: async () => {
          try {
            await api.switchCamera(c.source);
          } catch {
            // silencioso — a página de câmeras exibe o erro de conexão
          }
          navigate("/cameras");
        },
      }));

    const actions = [{ name: "Sair do sistema", hint: "Encerrar sessão", icon: LogOut, section: "Ações", action: onLogout }]
      .filter((i) => match(i.name));

    return [...screens, ...cams, ...actions];
  }, [query, cameras, navigate, onLogout]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(".palette-item.selected");
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  const run = (item) => {
    onClose();
    item.action();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selected]) run(items[selected]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastSection = null;

  return (
    <div className="palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette-panel" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div className="palette-input-row">
          <Search size={16} color="#64748b" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Buscar telas, câmeras ou ações..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="palette-kbd">ESC</span>
        </div>

        <div className="palette-list" ref={listRef} role="listbox">
          {items.length === 0 ? (
            <p className="palette-empty">Nenhum resultado para “{query}”.</p>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const header = item.section !== lastSection ? item.section : null;
              lastSection = item.section;
              return (
                <React.Fragment key={`${item.section}-${item.name}`}>
                  {header && <div className="palette-section">{header}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === selected}
                    className={`palette-item${idx === selected ? " selected" : ""}`}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => run(item)}
                  >
                    <Icon size={15} color={idx === selected ? "#fb7185" : "#64748b"} />
                    <span>{item.name}</span>
                    <span className="palette-hint">{item.hint}</span>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="palette-footer">
          <span className="palette-kbd">↑↓</span> navegar
          <span className="palette-kbd">↵</span> selecionar
          <span className="palette-kbd">ESC</span> fechar
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Command size={11} /> CAM-SEC
          </span>
        </div>
      </div>
    </div>
  );
}

const SHORTCUT_GROUPS = [
  {
    title: "Geral",
    items: [
      { keys: ["Ctrl", "K"], label: "Abrir paleta de comandos" },
      { keys: ["?"], label: "Mostrar esta lista de atalhos" },
      { keys: ["Esc"], label: "Fechar painéis e modais" },
    ],
  },
  {
    title: "Navegação",
    items: [
      { keys: ["D"], label: "Dashboard" },
      { keys: ["C"], label: "Câmeras" },
      { keys: ["A"], label: "Alertas" },
      { keys: ["E"], label: "Evidências" },
    ],
  },
  {
    title: "Câmeras",
    items: [
      { keys: ["1", "-", "9"], label: "Conectar câmera pelo número" },
      { keys: ["["], label: "Câmera anterior" },
      { keys: ["]"], label: "Próxima câmera" },
      { keys: ["R"], label: "Atualizar página de câmeras" },
    ],
  },
];

function ShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "?") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette-panel" style={{ maxWidth: 480 }} role="dialog" aria-modal="true" aria-label="Atalhos de teclado">
        <div className="palette-input-row">
          <Command size={16} color="#64748b" />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>Atalhos de teclado</span>
          <span className="palette-kbd">?</span>
        </div>
        <div style={{ padding: "10px 14px 16px", display: "flex", flexDirection: "column", gap: 14, maxHeight: 380, overflowY: "auto" }}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="palette-section" style={{ padding: "0 0 6px" }}>{group.title}</p>
              {group.items.map((item) => (
                <div key={item.label} className="palette-item" style={{ cursor: "default" }}>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {item.keys.map((k) => (
                      <span key={k} className="palette-kbd">{k}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [camStatus, setCamStatus] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [pendingAlerts, setPendingAlerts] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Botão "?" da rail abre o modal de atalhos
  useEffect(() => {
    const onToggle = () => setShortcutsOpen((v) => !v);
    window.addEventListener("camsec:toggle-shortcuts", onToggle);
    return () => window.removeEventListener("camsec:toggle-shortcuts", onToggle);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    const load = async () => {
      try {
        const status = await api.getCameraStatus().catch(() => null);
        setCamStatus(status);

        let cams = [];
        if (user?.id) {
          const res = await api.getCameras(user.id).catch(() => ({ cameras: [] }));
          cams = res.cameras || [];
        }
        setCameras(cams);

        const eventsRes = await api.getEvents({ limit: 50 }).catch(() => ({ items: [] }));
        const pending = (eventsRes.items || []).filter((e) => {
          const meta = typeof e.metadata === "string" ? JSON.parse(e.metadata || "{}") : (e.metadata || {});
          return !meta.status || meta.status === "pendente";
        }).length;
        setPendingAlerts(pending);
      } catch {
        // silencioso — topbar não deve quebrar a navegação
      }
    };

    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Atalhos globais: Ctrl+K paleta · D/C/A/E navegação · 1-9 troca câmera · [ ] cicla
  useEffect(() => {
    const NAV_KEYS = { d: "/dashboard", c: "/cameras", a: "/alerts", e: "/events" };

    const switchTo = async (cam) => {
      if (!cam?.source) return;
      try {
        await api.switchCamera(cam.source);
      } catch {
        // silencioso — a página de câmeras exibe o erro de conexão
      }
      window.dispatchEvent(new Event("camsec:camera-changed"));
      navigate("/cameras");
    };

    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || paletteOpen || shortcutsOpen) return;

      const t = e.target;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      const path = NAV_KEYS[e.key.toLowerCase()];
      if (path) {
        e.preventDefault();
        navigate(path);
        return;
      }

      const digit = Number(e.key);
      if (digit >= 1 && digit <= 9) {
        const cam = cameras[digit - 1];
        if (cam) {
          e.preventDefault();
          switchTo(cam);
        }
        return;
      }

      if ((e.key === "[" || e.key === "]") && cameras.length > 0) {
        e.preventDefault();
        const cur = cameras.findIndex((c) => String(c.source) === String(camStatus?.source));
        const dir = e.key === "]" ? 1 : -1;
        const next = cur === -1
          ? (dir === 1 ? 0 : cameras.length - 1)
          : (cur + dir + cameras.length) % cameras.length;
        switchTo(cameras[next]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, paletteOpen, shortcutsOpen, cameras, camStatus]);

  const isRecording = Boolean(camStatus?.running);
  const onlineCams = isRecording ? Math.max(cameras.length, 1) : 0;
  const totalCams = Math.max(cameras.length, 1);

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#07080B", overflow: "hidden" }}>
      <Rail
        pendingAlerts={pendingAlerts}
        isRecording={isRecording}
        onOpenPalette={() => setPaletteOpen(true)}
        onLogout={handleLogout}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Command Center Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hud-chip"
              style={{ cursor: "pointer", color: "#64748b" }}
              title="Abrir paleta de comandos (Ctrl+K)"
            >
              <Search size={12} />
              Buscar ou comando
              <span className="palette-kbd">Ctrl K</span>
            </button>
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="hud-chip"
              style={{ cursor: "pointer", color: "#94a3b8" }}
              title="Atalhos de teclado"
              aria-label="Mostrar atalhos de teclado"
            >
              <Keyboard size={12} />
              Atalhos
              <span className="palette-kbd">?</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span className="hud-chip" title="Câmeras online">
              <Camera size={12} />
              Cams <strong>{onlineCams}/{totalCams}</strong>
            </span>
            <span className={`hud-chip${pendingAlerts > 0 ? " alerts" : ""}`} title="Alertas pendentes de triagem">
              <Bell size={12} />
              Alertas <strong>{pendingAlerts}</strong>
            </span>
            <SystemClock />
            <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        <main style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        cameras={cameras}
        onLogout={handleLogout}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
