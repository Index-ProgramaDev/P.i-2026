import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Camera,
  AlertTriangle,
  Activity,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import AnomalyAlert from "../components/AnomalyAlert";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [pendingAnomaly, setPendingAnomaly] = useState(null);
  const wsRef = useRef(null);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const camStatus = await api.getCameraStatus().catch(() => null);
      setCameraStatus(camStatus);

      let userCams = [];
      if (user && user.id) {
        const camsRes = await api.getCameras(user.id).catch(() => ({ cameras: [] }));
        userCams = camsRes.cameras || [];
      }
      setCameras(userCams);

      const eventsRes = await api.getEvents({ limit: 200 }).catch(() => ({ total: 0, items: [] }));
      const items = eventsRes.items || [];
      setEvents(items);

      const alerts = items.slice(0, 8);
      setRecentAlerts(alerts);
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000);
    
    // Conecta WebSocket para alertas em tempo real
    connectWebSocket();
    
    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(api.wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket conectado para alertas");
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Se for anomalia confirmada, mostra o modal de confirmação
          if (data.type === "ALERT" && data.kind === "ANOMALY_CONFIRMED") {
            setPendingAnomaly({
              kind: data.kind,
              timestamp: data.timestamp,
              score: data.score,
              detections: data.detections || [],
            });
          }
          
          // Atualiza lista de eventos
          if (data.type === "ALERT") {
            loadDashboardData();
          }
        } catch (err) {
          console.error("Erro ao processar mensagem WebSocket:", err);
        }
      };
      
      ws.onerror = (error) => {
        console.error("Erro WebSocket:", error);
      };
      
      ws.onclose = () => {
        console.log("WebSocket desconectado. Reconectando em 5s...");
        setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error("Erro ao conectar WebSocket:", err);
    }
  };

  const handleConfirmAnomaly = async (event, justification) => {
    try {
      // Usa o novo endpoint que salva apenas quando confirmado
      await api.confirmAnomalyFromOperator({
        decision: "confirmado",
        operator: user?.username || "operador",
        justification: justification,
      });
      console.log("Anomalia confirmada e salva no banco");
    } catch (err) {
      console.error("Erro ao confirmar anomalia:", err);
      throw err;
    }
  };

  const handleRejectAnomaly = async (event, justification) => {
    try {
      // Marca como falso positivo sem salvar evidências
      await api.confirmAnomalyFromOperator({
        decision: "falso_positivo",
        operator: user?.username || "operador",
        justification: justification,
      });
      console.log("Anomalia marcada como falso positivo");
    } catch (err) {
      console.error("Erro ao rejeitar anomalia:", err);
      throw err;
    }
  };

  const isCamRunning = Boolean(cameraStatus && cameraStatus.running);
  const activeCamerasCount = isCamRunning ? (cameras.length > 0 ? cameras.length : 1) : 0;

  // Converte caminho técnico da fonte (ex: ./video/Vandalismo.mp4) em nome amigável
  const friendlySourceName = (source) => {
    if (!source) return "Câmera sem fonte";
    const match = cameras.find((c) => c.source === source || c.camera_uid === source);
    if (match?.name) return match.name;
    const base = String(source).split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, "");
    const pretty = base.replace(/[_-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    return pretty || source;
  };
  const pendingAlertsCount = events.filter((e) => {
    const meta = typeof e.metadata === "string" ? JSON.parse(e.metadata || "{}") : (e.metadata || {});
    return !meta.status || meta.status === "pendente";
  }).length;
  const totalEventsCount = events.length;

  // ---- Dados para gráficos de ocorrências ----
  const dayBuckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      count: 0,
    };
  });
  const kindCounts = {};
  events.forEach((ev) => {
    const ts = (ev.timestamp || 0) * 1000;
    if (ts) {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      const bucket = dayBuckets.find((b) => b.key === d.toISOString().slice(0, 10));
      if (bucket) bucket.count += 1;
    }
    const k = ev.kind || "OUTROS";
    kindCounts[k] = (kindCounts[k] || 0) + 1;
  });
  const maxDayCount = Math.max(...dayBuckets.map((b) => b.count), 1);
  const kindEntries = Object.entries(kindCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const kindMax = Math.max(...kindEntries.map(([, c]) => c), 1);
  const chartTotal = events.length;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Topo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-main)" }}>
            Dashboard
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
            Visão geral operacional das câmeras e ocorrências registradas.
          </p>
        </div>

        <button onClick={loadDashboardData} className="btn-secondary" disabled={loading} style={{ height: "38px" }}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Cards de Indicadores */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Câmeras Online
            </span>
            <Camera size={18} color="var(--primary-red)" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-main)" }}>
            {activeCamerasCount}
          </div>
          <div
            style={{ fontSize: "12px", color: isCamRunning ? "var(--success-green)" : "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            title={cameraStatus?.source || undefined}
          >
            {isCamRunning ? `Ativa: ${friendlySourceName(cameraStatus.source)}` : "Nenhuma câmera ativa"}
          </div>
        </div>

        <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Alertas Pendentes
            </span>
            <AlertTriangle size={18} color="var(--warning-yellow)" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-main)" }}>
            {pendingAlertsCount}
          </div>
          <div style={{ fontSize: "12px", color: pendingAlertsCount > 0 ? "var(--warning-yellow)" : "var(--text-secondary)" }}>
            {pendingAlertsCount > 0 ? "Requer triagem" : "Nenhum alerta pendente"}
          </div>
        </div>

        <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Ocorrências Registradas
            </span>
            <Activity size={18} color="var(--text-secondary)" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-main)" }}>
            {totalEventsCount}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Registradas na base de dados
          </div>
        </div>
      </div>

      {/* Gráficos de Ocorrências */}
      <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Ocorrências</h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Distribuição dos últimos eventos registrados no sistema.
            </p>
          </div>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              padding: "3px 10px",
            }}
          >
            TOTAL: <strong style={{ color: "var(--text-main)" }}>{chartTotal}</strong>
          </span>
        </div>

        {chartTotal === 0 ? (
          <div
            style={{
              minHeight: "140px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              fontSize: "13px",
            }}
          >
            Nenhuma ocorrência registrada para exibição.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Barras — últimos 7 dias */}
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontFamily: "monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginBottom: "12px",
                }}
              >
                Últimos 7 dias
              </p>
              <svg viewBox="0 0 700 180" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Ocorrências por dia">
                {dayBuckets.map((b, i) => {
                  const h = b.count === 0 ? 4 : Math.max(8, (b.count / maxDayCount) * 140);
                  const x = 40 + i * 95;
                  const y = 158 - h;
                  return (
                    <g key={b.key}>
                      <rect
                        x={x}
                        y={y}
                        width="56"
                        height={h}
                        rx="4"
                        fill={b.count > 0 ? "#E11D48" : "#1c2029"}
                        opacity={b.count > 0 ? 0.9 : 1}
                      >
                        <title>{`${b.label}: ${b.count} ocorrência(s)`}</title>
                      </rect>
                      {b.count > 0 && (
                        <text x={x + 28} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="#f1f5f9">
                          {b.count}
                        </text>
                      )}
                      <text x={x + 28} y="174" textAnchor="middle" fontSize="10" fill="#64748b">
                        {b.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Barras horizontais — por tipo */}
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontFamily: "monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginBottom: "12px",
                }}
              >
                Por tipo de evento
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {kindEntries.map(([kind, count]) => (
                  <div key={kind} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "110px",
                        flexShrink: 0,
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={kind}
                    >
                      {kind}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: "8px",
                        backgroundColor: "#1a1d26",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(count / kindMax) * 100}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #9F1239, #E11D48)",
                          borderRadius: "4px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: "34px",
                        textAlign: "right",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        fontWeight: 600,
                        color: "var(--text-main)",
                      }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid Principal: Alertas Recentes & Câmeras */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Alertas Recentes */}
        <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Alertas Recentes</h2>
            <Link
              to="/alerts"
              style={{ fontSize: "12px", color: "var(--primary-red)", display: "flex", alignItems: "center", gap: "4px" }}
            >
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          {recentAlerts.length === 0 ? (
            <div
              style={{
                minHeight: "190px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "10px",
                backgroundColor: "var(--bg-surface-elevated)",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--border-subtle)",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  border: "1px solid rgba(39, 201, 133, 0.3)",
                  backgroundColor: "rgba(39, 201, 133, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={20} color="var(--success-green)" />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                  Nenhum incidente registrado
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px", maxWidth: "280px" }}>
                  Sistema operando em estabilidade total nas últimas 24 horas.
                </div>
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--success-green)",
                  border: "1px solid rgba(39, 201, 133, 0.25)",
                  borderRadius: "var(--radius-xs)",
                  padding: "3px 8px",
                  backgroundColor: "rgba(39, 201, 133, 0.08)",
                }}
              >
                Status: Nominal
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentAlerts.slice(0, 5).map((al) => {
                const meta = typeof al.metadata === "string" ? JSON.parse(al.metadata || "{}") : (al.metadata || {});
                const status = meta.status || "pendente";

                return (
                  <div
                    key={al.id || al.event_id}
                    onClick={() => navigate(`/alerts/review/${al.event_id || al.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderRadius: "var(--radius-xs)",
                      border: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>
                        {al.kind || "ANOMALIA"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        Câmera: {al.camera_uid || "cam_default"} • ID: {al.event_id}
                      </div>
                    </div>

                    <span className={`badge ${status === "confirmado" ? "badge-danger" : status === "falso_positivo" ? "badge-neutral" : "badge-warning"}`}>
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Câmeras Conectadas */}
        <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Câmeras do Sistema</h2>
            <Link to="/cameras" style={{ fontSize: "12px", color: "var(--primary-red)" }}>
              Gerenciar câmeras
            </Link>
          </div>

          {!isCamRunning && cameras.length === 0 ? (
            <div
              style={{
                minHeight: "190px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "10px",
                backgroundColor: "var(--bg-surface-elevated)",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--border-subtle)",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "rgba(146, 151, 163, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera size={20} color="var(--text-secondary)" />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                  Nenhuma câmera conectada
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px", maxWidth: "280px" }}>
                  Vincule uma câmera no módulo Câmeras para iniciar o monitoramento.
                </div>
              </div>
              <Link to="/cameras">
                <button className="btn-secondary" style={{ height: "32px", fontSize: "12px", padding: "0 14px", marginTop: "4px" }}>
                  Configurar câmeras
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {isCamRunning && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="pulse-dot online" />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>Câmera Ativa</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }} title={cameraStatus?.source || undefined}>
                        {friendlySourceName(cameraStatus?.source)}
                      </div>
                    </div>
                  </div>
                  <Link to="/cameras">
                    <button className="btn-primary" style={{ height: "30px", fontSize: "11px", padding: "0 10px" }}>
                      Ver Mosaico
                    </button>
                  </Link>
                </div>
              )}

              {cameras.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      {c.camera_uid}
                    </div>
                  </div>
                  <Link to="/cameras">
                    <button className="btn-secondary" style={{ height: "30px", fontSize: "11px", padding: "0 10px" }}>
                      Conectar
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Alerta de Anomalia */}
      {pendingAnomaly && (
        <AnomalyAlert
          event={pendingAnomaly}
          onConfirm={handleConfirmAnomaly}
          onReject={handleRejectAnomaly}
          onClose={() => setPendingAnomaly(null)}
        />
      )}
    </div>
  );
}
