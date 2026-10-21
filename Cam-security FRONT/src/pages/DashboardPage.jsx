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

      const eventsRes = await api.getEvents({ limit: 50 }).catch(() => ({ total: 0, items: [] }));
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
  const pendingAlertsCount = events.filter((e) => {
    const meta = typeof e.metadata === "string" ? JSON.parse(e.metadata || "{}") : (e.metadata || {});
    return !meta.status || meta.status === "pendente";
  }).length;
  const totalEventsCount = events.length;

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
          <div style={{ fontSize: "12px", color: isCamRunning ? "var(--success-green)" : "var(--text-secondary)" }}>
            {isCamRunning ? `Ativa: ${cameraStatus.source}` : "Nenhuma câmera ativa"}
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
                height: "160px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "8px",
                backgroundColor: "var(--bg-surface-elevated)",
                borderRadius: "var(--radius-xs)",
                border: "1px dashed var(--border-subtle)",
                color: "var(--text-secondary)",
                fontSize: "13px",
              }}
            >
              <CheckCircle2 size={24} color="var(--success-green)" />
              <span>Sem alertas recentes pendentes.</span>
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
                height: "160px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "8px",
                backgroundColor: "var(--bg-surface-elevated)",
                borderRadius: "var(--radius-xs)",
                border: "1px dashed var(--border-subtle)",
                color: "var(--text-secondary)",
                fontSize: "13px",
              }}
            >
              <Camera size={24} color="#555a66" />
              <span>Nenhuma câmera ativa ou acoplada.</span>
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
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        Fonte: {cameraStatus?.source}
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
                      {c.source} ({c.camera_uid})
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
