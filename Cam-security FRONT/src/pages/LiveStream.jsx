import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";
import {
  Radio,
  Sliders,
  Bell,
  AlertTriangle,
  RefreshCw,
  Camera,
  Layers,
  Clock,
  Wifi,
} from "lucide-react";

export default function LiveStream() {
  const [overlays, setOverlays] = useState(true);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [cameraStatus, setCameraStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // Fetch camera status
  const fetchStatus = async () => {
    try {
      const data = await api.getCameraStatus();
      setCameraStatus(data);
    } catch (e) {
      console.error("Erro ao obter status da câmera", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for live alerts
  useEffect(() => {
    const connectWs = () => {
      try {
        const socket = new WebSocket(api.wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "ALERT" || data.type === "ANOMALY") {
              setAlerts((prev) => [
                {
                  id: Date.now() + Math.random(),
                  time: new Date().toLocaleTimeString(),
                  score: data.score,
                  kind: data.kind,
                  detections: data.detections,
                },
                ...prev.slice(0, 19), // manter últimos 20
              ]);
            }
          } catch (e) {
            console.error("Erro no parse do WebSocket", e);
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          // auto reconnect
          setTimeout(connectWs, 3000);
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch (e) {
        setWsConnected(false);
      }
    };

    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleRefreshStream = () => {
    setStreamKey(Date.now());
  };

  const handleSetLocalCam = async () => {
    try {
      await api.switchCamera("0");
      fetchStatus();
      setStreamKey(Date.now());
    } catch (err) {
      alert("Erro ao selecionar câmera física: " + err);
    }
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Monitoramento ao Vivo
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
            Transmissão em tempo real processada pela rede neural YOLO & modelo de anomalia UCF
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleSetLocalCam} className="btn-secondary">
            <Camera size={16} /> Usar Minha Câmera (Device 0)
          </button>
          <button onClick={handleRefreshStream} className="btn-secondary">
            <RefreshCw size={16} /> Atualizar Sinal
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
        {/* Main Video Player Card */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="badge badge-danger">
                <span className="pulse-dot recording" /> AO VIVO
              </span>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Fonte Atual:{" "}
                <code style={{ background: "rgba(0,0,0,0.4)", padding: "2px 6px", borderRadius: "4px" }}>
                  {cameraStatus?.source !== undefined ? String(cameraStatus.source) : "Carregando..."}
                </code>
              </span>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={overlays}
                onChange={(e) => {
                  setOverlays(e.target.checked);
                  setStreamKey(Date.now());
                }}
                style={{ width: "auto" }}
              />
              <Layers size={14} /> Overlays de IA (YOLO / Anomalias)
            </label>
          </div>

          {/* Stream Display */}
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4/3",
              maxHeight: "560px",
              background: "#000",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`${api.getStreamUrl(overlays)}&t=${streamKey}`}
              alt="Transmissão ao vivo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
              onError={(e) => {
                e.target.onerror = null;
              }}
            />
          </div>

          {/* Stream Metadata footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border)",
              paddingTop: "12px",
            }}
          >
            <span>Resolução: {cameraStatus?.width || 640}x{cameraStatus?.height || 480}</span>
            <span>FPS Configurado: {cameraStatus?.fps ? cameraStatus.fps.toFixed(1) : 30.0}</span>
            <span>Tipo: {cameraStatus?.is_video ? "Arquivo MP4" : (cameraStatus?.is_network ? "RTSP / Rede" : "Câmera Física")}</span>
          </div>
        </div>

        {/* Live Alerts Feed Panel */}
        <div
          className="glass-panel"
          style={{
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            height: "fit-content",
            maxHeight: "680px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              <Bell size={18} color="var(--accent)" /> Eventos em Tempo Real
            </div>
            <span className={`badge ${wsConnected ? "badge-success" : "badge-warning"}`}>
              {wsConnected ? "WS ATIVO" : "RECONECTANDO"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              overflowY: "auto",
              paddingRight: "4px",
              maxHeight: "540px",
            }}
          >
            {alerts.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 10px",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                }}
              >
                <Wifi size={24} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
                Aguardando novos eventos de anomalia do modelo...
              </div>
            ) : (
              alerts.map((al) => (
                <div
                  key={al.id}
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#f87171", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px" }}>
                      <AlertTriangle size={12} /> {al.kind || "ANOMALIA"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{al.time}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Score: <strong>{(al.score * 100).toFixed(1)}%</strong>
                  </div>
                  {al.detections && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {al.detections}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
