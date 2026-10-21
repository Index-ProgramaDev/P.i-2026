import React, { useState, useEffect } from "react";
import { Users, Search, RefreshCw, Shield, AlertTriangle } from "lucide-react";
import { api } from "../api";

export default function SuspectsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadSuspects = async () => {
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
    loadSuspects();
  }, []);

  // Agrupar perfis/track IDs
  const profilesMap = new Map();
  events.forEach((ev) => {
    let dets = [];
    try {
      if (typeof ev.detections === "string" && ev.detections) {
        dets = JSON.parse(ev.detections);
      } else if (Array.isArray(ev.detections)) {
        dets = ev.detections;
      }
    } catch {
      dets = [];
    }

    dets.forEach((d) => {
      const tid = d.track_id !== undefined && d.track_id !== null ? `Track #${d.track_id}` : null;
      if (tid) {
        if (!profilesMap.has(tid)) {
          profilesMap.set(tid, {
            id: tid,
            count: 0,
            firstSeen: ev.created_at || new Date(ev.timestamp * 1000).toISOString(),
            lastSeen: ev.created_at || new Date(ev.timestamp * 1000).toISOString(),
            camera: ev.camera_uid || "cam_default",
            cls: d.class_name || "person",
          });
        }
        const p = profilesMap.get(tid);
        p.count += 1;
        p.lastSeen = ev.created_at || new Date(ev.timestamp * 1000).toISOString();
      }
    });
  });

  const profiles = Array.from(profilesMap.values()).filter((p) =>
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600 }}>Pessoas e Perfis Suspeitos</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Identificadores biométricos e rastreamento de alvos (Track IDs) persistidos no sistema.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="text"
            placeholder="Buscar por Track ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "200px", height: "38px" }}
          />
          <button onClick={loadSuspects} className="btn-secondary" style={{ height: "38px" }} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="card-panel" style={{ padding: 0, overflow: "hidden" }}>
        {profiles.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
            <Users size={32} color="#555a66" style={{ margin: "0 auto 10px" }} />
            Nenhum perfil de tracking suspeito registrado até o momento.
          </div>
        ) : (
          <table className="op-table">
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Classe</th>
                <th>Câmera de Origem</th>
                <th>Ocorrências Vinculadas</th>
                <th>Última Detecção</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: "var(--primary-red)" }}>{p.id}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.cls}</td>
                  <td>{p.camera}</td>
                  <td>
                    <span className="badge badge-warning">{p.count} incidente(s)</span>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                    {new Date(p.lastSeen).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
