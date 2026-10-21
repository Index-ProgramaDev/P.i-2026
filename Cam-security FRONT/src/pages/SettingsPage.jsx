import React, { useState } from "react";
import { Settings, Server, Database, Shield, Sliders, Save, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export default function SettingsPage() {
  const { user, serverHealth } = useAuth();
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [savedMsg, setSavedMsg] = useState("");

  const handleSave = (e) => {
    e.preventDefault();
    setSavedMsg("Configurações salvas localmente!");
    setTimeout(() => setSavedMsg(""), 3000);
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "800px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 600 }}>Configurações do Sistema</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          Parâmetros operacionais da plataforma, limites de inferência e status da rede.
        </p>
      </div>

      {savedMsg && (
        <div
          style={{
            backgroundColor: "rgba(39, 201, 133, 0.12)",
            border: "1px solid rgba(39, 201, 133, 0.25)",
            color: "var(--success-green)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} /> {savedMsg}
        </div>
      )}

      {/* Status dos Serviços */}
      <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Status dos Serviços</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
          <div
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              padding: "12px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>API Backend FastAPI</span>
              <span className={`badge ${serverHealth?.online ? "badge-success" : "badge-danger"}`}>
                {serverHealth?.online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
              Endpoint: {api.baseUrl}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              padding: "12px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Neon PostgreSQL Cloud</span>
              <span className={`badge ${serverHealth?.db ? "badge-success" : "badge-warning"}`}>
                {serverHealth?.db ? "CONECTADO" : "INDISPONÍVEL"}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
              Tabelas: users, cameras, security_events
            </div>
          </div>
        </div>
      </div>

      {/* Limiares de Alerta */}
      <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Parâmetros de Detecção e IA</h2>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Limiar Mínimo de Confiança da IA (UCF / Anomalias)
              </label>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--warning-yellow)" }}>
                {(minConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              style={{ padding: 0, height: "6px", accentColor: "var(--primary-red)", cursor: "pointer" }}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ alignSelf: "flex-start" }}>
            <Save size={14} /> Salvar Parâmetros
          </button>
        </form>
      </div>
    </div>
  );
}
