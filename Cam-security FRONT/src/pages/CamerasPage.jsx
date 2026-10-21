import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Camera,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";
import AnomalyAlert from "../components/AnomalyAlert";

export default function CamerasPage() {
  const { user } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  // Modo tela cheia
  const [fullScreenCam, setFullScreenCam] = useState(null);
  const gridContainerRef = useRef(null);

  // Modal de adicionar câmera
  const [showAddModal, setShowAddModal] = useState(false);

  // Formulário de nova câmera
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState("");

  // Pop-up de anomalia
  const [pendingAnomaly, setPendingAnomaly] = useState(null);
  const wsRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const status = await api.getCameraStatus();
      setCameraStatus(status);

      if (user) {
        const camData = await api.getCameras(user.id);
        setCameras(camData.cameras || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Conecta WebSocket para alertas em tempo real
    connectWebSocket();
    
    return () => {
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

  const handleSwitch = async (newSource) => {
    try {
      setMsg({ text: `Alternando fluxo da câmera para "${newSource}"...`, type: "info" });
      const res = await api.switchCamera(newSource);
      if (res.success) {
        setMsg({ text: `Câmera alternada com sucesso para ${newSource}!`, type: "success" });
        loadData();
      } else {
        setMsg({ text: res.detail || "Falha ao alternar", type: "error" });
      }
    } catch (err) {
      setMsg({ text: "Erro: " + err.message, type: "error" });
    }
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    if (!user) {
      return setMsg({ text: "Faça login para salvar câmeras!", type: "error" });
    }
    if (!uid || !name || !source) {
      return setMsg({ text: "Preencha todos os campos da câmera", type: "error" });
    }

    try {
      const res = await api.registerCamera(uid.trim(), name.trim(), source.trim(), user.id);
      if (res.success) {
        setMsg({ text: "Câmera acoplada com sucesso!", type: "success" });
        setUid("");
        setName("");
        setSource("");
        setShowAddModal(false); // Fecha o modal
        loadData();
      } else {
        setMsg({ text: res.detail || "Erro ao salvar", type: "error" });
      }
    } catch (err) {
      setMsg({ text: "Erro: " + err.message, type: "error" });
    }
  };

  const handleDeleteCamera = async (camera_uid, camera_name) => {
    if (!user) {
      return setMsg({ text: "Faça login para remover câmeras!", type: "error" });
    }
    
    if (!window.confirm(`Tem certeza que deseja remover a câmera "${camera_name}"?`)) {
      return;
    }

    try {
      setMsg({ text: `Removendo câmera "${camera_name}"...`, type: "info" });
      const res = await api.deleteCamera(camera_uid, user.id);
      if (res.success) {
        setMsg({ text: "Câmera removida com sucesso!", type: "success" });
        loadData();
      } else {
        setMsg({ text: res.message || "Erro ao remover", type: "error" });
      }
    } catch (err) {
      setMsg({ text: "Erro: " + err.message, type: "error" });
    }
  };

  const toggleFullScreen = (camId) => {
    if (fullScreenCam === camId) {
      setFullScreenCam(null);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } else {
      setFullScreenCam(camId);
      const targetEl = document.getElementById(`cam-card-${camId}`);
      if (targetEl && targetEl.requestFullscreen) {
        targetEl.requestFullscreen().catch(() => {});
      }
    }
  };

  // Câmera está realmente ativa e capturando?
  const isCameraLive = Boolean(cameraStatus && cameraStatus.running);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Topo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600 }}>Câmeras do Sistema</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Visualização de câmeras conectadas, mosaico operacional e modo tela cheia.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={loadData} className="btn-secondary" style={{ height: "38px" }} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Atualizar
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ height: "38px" }}>
            <Plus size={14} /> Adicionar Câmera
          </button>
        </div>
      </div>

      {/* Mensagens de Feedback */}
      {msg.text && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor:
              msg.type === "success"
                ? "rgba(39, 201, 133, 0.12)"
                : msg.type === "error"
                ? "rgba(240, 68, 82, 0.12)"
                : "rgba(245, 185, 66, 0.12)",
            border: `1px solid ${
              msg.type === "success"
                ? "rgba(39, 201, 133, 0.25)"
                : msg.type === "error"
                ? "rgba(240, 68, 82, 0.25)"
                : "rgba(245, 185, 66, 0.25)"
            }`,
            color:
              msg.type === "success"
                ? "var(--success-green)"
                : msg.type === "error"
                ? "var(--danger-red)"
                : "var(--warning-yellow)",
          }}
        >
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Mosaico de Câmeras */}
      <div
        ref={gridContainerRef}
        style={{
          display: "grid",
          gridTemplateColumns: (() => {
            const totalCams = cameras.length + (isCameraLive ? 1 : 0);
            if (totalCams === 0) return "1fr";
            if (totalCams === 1) return "1fr";
            if (totalCams === 2) return "repeat(2, 1fr)";
            return "repeat(auto-fit, minmax(380px, 1fr))";
          })(),
          gap: "16px",
          width: "100%",
        }}
      >
        {/* Se não houver câmera conectada / rodando */}
        {!isCameraLive && cameras.length === 0 ? (
          <div
            className="card-panel"
            style={{
              padding: "40px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              gridColumn: "1 / -1",
            }}
          >
            <Camera size={36} color="#555a66" />
            <div style={{ fontSize: "15px", fontWeight: 600 }}>Nenhuma câmera ativa no momento</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", maxWidth: "440px" }}>
              Nenhum dispositivo de vídeo foi detectado como ativo pelo servidor. Acople uma câmera abaixo (USB ou IP) para iniciar a transmissão.
            </p>
          </div>
        ) : (
          <>
            {/* Feed Ativo (Somente se cameraStatus.running for true) */}
            {isCameraLive && (
              <div
                id="cam-card-live"
                className="card-panel"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "12px",
                  position: fullScreenCam === "live" ? "fixed" : "relative",
                  inset: fullScreenCam === "live" ? "0" : "auto",
                  zIndex: fullScreenCam === "live" ? 9999 : 1,
                  backgroundColor: "#08090C",
                  borderRadius: fullScreenCam === "live" ? 0 : "var(--radius-sm)",
                  height: fullScreenCam === "live" ? "100vh" : "auto",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="pulse-dot online" />
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>Câmera Ativa</span>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      ({cameraStatus?.source || "0"})
                    </span>
                  </div>

                  <button
                    onClick={() => toggleFullScreen("live")}
                    className="btn-secondary"
                    style={{ height: "28px", width: "28px", padding: 0 }}
                    title={fullScreenCam === "live" ? "Sair de tela cheia" : "Tela cheia"}
                  >
                    {fullScreenCam === "live" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>

                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: fullScreenCam === "live" ? "auto" : "16 / 9",
                    flex: fullScreenCam === "live" ? 1 : "unset",
                    backgroundColor: "#000000",
                    borderRadius: "var(--radius-xs)",
                    overflow: "hidden",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={api.getStreamUrl(true)}
                    alt="Stream da Câmera"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "rgba(0, 0, 0, 0.65)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "#fff",
                    }}
                  >
                    <span className="pulse-dot recording" /> AO VIVO
                  </div>
                </div>
              </div>
            )}

            {/* Outras Câmeras cadastradas pelo operador */}
            {cameras.map((cam) => {
              const isSameSource = cameraStatus && String(cameraStatus.source) === String(cam.source);
              if (isSameSource && isCameraLive) return null; // Já está exibida no feed ativo

              const isFullScreen = fullScreenCam === cam.id;
              return (
                <div
                  key={cam.id}
                  id={`cam-card-${cam.id}`}
                  className="card-panel"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "12px",
                    position: isFullScreen ? "fixed" : "relative",
                    inset: isFullScreen ? "0" : "auto",
                    zIndex: isFullScreen ? 9999 : 1,
                    backgroundColor: "#08090C",
                    borderRadius: isFullScreen ? 0 : "var(--radius-sm)",
                    height: isFullScreen ? "100vh" : "auto",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{cam.name}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "6px" }}>
                        ({cam.source})
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        onClick={() => handleSwitch(cam.source)}
                        className="btn-primary"
                        style={{ height: "28px", fontSize: "11px", padding: "0 10px" }}
                      >
                        <Play size={12} /> Conectar
                      </button>
                      <button
                        onClick={() => toggleFullScreen(cam.id)}
                        className="btn-secondary"
                        style={{ height: "28px", width: "28px", padding: 0 }}
                        title={isFullScreen ? "Sair de tela cheia" : "Tela cheia"}
                      >
                        {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteCamera(cam.camera_uid, cam.name)}
                        className="btn-secondary"
                        style={{ 
                          height: "28px", 
                          width: "28px", 
                          padding: 0,
                          backgroundColor: "rgba(240, 68, 82, 0.1)",
                          borderColor: "rgba(240, 68, 82, 0.3)",
                        }}
                        title="Remover câmera"
                      >
                        <Trash2 size={14} color="var(--danger-red)" />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      aspectRatio: isFullScreen ? "auto" : "16 / 9",
                      flex: isFullScreen ? 1 : "unset",
                      backgroundColor: "#000000",
                      borderRadius: "var(--radius-xs)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                    }}
                  >
                    <Camera size={28} color="#555a66" />
                    <span>Em Espera (Desconectada)</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Modal de Adicionar Câmera */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div className="card-panel" style={{ maxWidth: "560px", width: "100%", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={18} color="var(--primary-red)" /> Acoplar Nova Câmera
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-secondary"
                style={{ width: "32px", height: "32px", padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCamera} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Identificador (UID):
                </label>
                <input
                  type="text"
                  placeholder="ex: cam_portaria ou cam_01"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Nome da Câmera:
                </label>
                <input
                  type="text"
                  placeholder="ex: Câmera Recepção"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Fonte de Conexão:
                </label>
                <input
                  type="text"
                  placeholder="0 (USB), http://IP:8080/video (IP Webcam) ou rtsp://..."
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  required
                />
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Para IP Webcam Android:{" "}
                  <code style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "3px" }}>
                    http://SEU_IP:8080/video
                  </code>
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, height: "40px" }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, height: "40px" }}>
                  <Plus size={14} /> Acoplar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up de Alerta de Anomalia */}
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
