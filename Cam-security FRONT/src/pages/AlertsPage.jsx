import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "../api";

export default function AlertsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getEvents({ limit: 100 });
      setEvents(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const filteredEvents = events.filter((ev) => {
    const meta = typeof ev.metadata === "string" ? JSON.parse(ev.metadata || "{}") : (ev.metadata || {});
    const st = meta.status || "pendente";
    if (filterStatus === "all") return true;
    return st === filterStatus;
  });

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600 }}>Alertas e Ocorrências</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Fila operacional de triagem de incidentes com inteligência artificial.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: "160px", height: "38px" }}
          >
            <option value="all">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="confirmado">Confirmados</option>
            <option value="investigacao">Em Investigação</option>
            <option value="falso_positivo">Falsos Positivos</option>
          </select>

          <button onClick={loadAlerts} className="btn-secondary" style={{ height: "38px" }} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="card-panel" style={{ padding: 0, overflow: "hidden" }}>
        {filteredEvents.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <CheckCircle2 size={32} color="var(--success-green)" />
            <span>Nenhum alerta pendente de triagem no momento.</span>
          </div>
        ) : (
          <table className="op-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ocorrência</th>
                <th>Câmera</th>
                <th>Data / Hora</th>
                <th>Confiança</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev) => {
                const meta = typeof ev.metadata === "string" ? JSON.parse(ev.metadata || "{}") : (ev.metadata || {});
                const status = meta.status || "pendente";
                const score = ev.ucf_score !== null && ev.ucf_score !== undefined ? `${(ev.ucf_score * 100).toFixed(0)}%` : "N/A";
                const isHigh = (ev.ucf_score || 0) > 0.65;

                return (
                  <tr key={ev.id || ev.event_id}>
                    <td style={{ fontWeight: 600 }}>{ev.event_id || ev.id}</td>
                    <td style={{ color: isHigh ? "var(--primary-red)" : "var(--text-main)", fontWeight: 500 }}>
                      {ev.kind || "ANOMALIA"}
                    </td>
                    <td>{ev.camera_uid || "cam_default"}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                      {ev.created_at
                        ? new Date(ev.created_at).toLocaleString("pt-BR")
                        : new Date((ev.timestamp || 0) * 1000).toLocaleString("pt-BR")}
                    </td>
                    <td style={{ color: "var(--warning-yellow)", fontWeight: 600 }}>{score}</td>
                    <td>
                      <span className={`badge ${status === "confirmado" ? "badge-danger" : status === "falso_positivo" ? "badge-neutral" : "badge-warning"}`}>
                        {status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={`/alerts/review/${ev.event_id || ev.id}`}>
                        <button className="btn-primary" style={{ height: "32px", fontSize: "11px", padding: "0 10px" }}>
                          Revisar <ArrowRight size={12} />
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
