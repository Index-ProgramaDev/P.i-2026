import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle,
  HelpCircle,
  XCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  History,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AlertReviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [justification, setJustification] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);

  const fetchEventDetails = async () => {
    setLoading(true);
    setError("");
    try {
      if (!eventId) {
        const res = await api.getEvents({
          limit: 1,
          user_id: user?.id || null,
          user_email: user?.email || null,
        });
        if (res.items && res.items.length > 0) {
          setEventData(res.items[0]);
        } else {
          setError("Nenhum evento registrado disponível para revisão.");
        }
      } else {
        const ev = await api.getEventById(eventId, user?.id || null, user?.email || null);
        setEventData(ev);
      }
    } catch (err) {
      setError(err.message || "Falha ao carregar metadados do evento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const handleDecision = async (decision) => {
    if (!eventData) return;
    const confirmMsg =
      decision === "confirmado"
        ? "Deseja confirmar este evento como INCIDENTE REAL?"
        : "Deseja descartar este alerta como FALSO POSITIVO?";

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    setActionSuccess("");
    try {
      const targetId = eventData.event_id || eventData.id;
      const res = await api.reviewEvent(targetId, {
        decision,
        operator: user?.username || "operador_central",
        justification: justification.trim(),
        user_id: user?.id || null,
        user_email: user?.email || null,
      });
      setActionSuccess(`Decisão "${decision}" gravada com sucesso no histórico operacional!`);
      if (res.event) {
        setEventData(res.event);
      }
      setJustification("");
    } catch (err) {
      alert("Erro ao persistir decisão: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  let detections = [];
  try {
    const metaDet = typeof eventData?.metadata === "string"
      ? JSON.parse(eventData.metadata || "{}").detections
      : eventData?.metadata?.detections;
    if (Array.isArray(metaDet) && metaDet.length > 0) {
      detections = metaDet;
    } else if (typeof eventData?.detections === "string" && eventData.detections) {
      const parsed = JSON.parse(eventData.detections);
      detections = Array.isArray(parsed) ? parsed : [];
    } else if (Array.isArray(eventData?.detections)) {
      detections = eventData.detections;
    }
  } catch {
    detections = [];
  }

  const meta =
    typeof eventData?.metadata === "string"
      ? JSON.parse(eventData.metadata || "{}")
      : eventData?.metadata || {};

  const currentStatus = (meta.status === "pending" ? "pendente" : meta.status) || "pendente";
  const reviewHistory = meta.review_history || [];
  const ucfScore = eventData?.ucf_score !== null && eventData?.ucf_score !== undefined
    ? (eventData.ucf_score * 100).toFixed(1)
    : "N/A";

  const videoUrl = eventData
    ? api.getEventVideoUrl(eventData.event_id || eventData.id, user?.id || null, user?.email || null)
    : null;
  const frameUrl = eventData
    ? api.getEventFrameUrl(eventData.event_id || eventData.id, user?.id || null, user?.email || null)
    : null;

  if (loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
        Carregando metadados da ocorrência...
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="card-panel" style={{ textAlign: "center", padding: "40px" }}>
        <ShieldAlert size={36} color="var(--primary-red)" style={{ margin: "0 auto 12px" }} />
        <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Evento não localizado</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
          {error || "Selecione um evento da lista de alertas para abrir a revisão operacional."}
        </p>
        <button onClick={() => navigate("/dashboard")} className="btn-secondary">
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary"
            style={{ width: "36px", height: "36px", padding: 0 }}
            title="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-main)" }}>
              Revisão de alerta
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
              Triagem operacional e validação de inferência por operador.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className={`badge ${
              currentStatus === "confirmado"
                ? "badge-danger"
                : currentStatus === "falso_positivo"
                ? "badge-neutral"
                : currentStatus === "investigacao"
                ? "badge-warning"
                : "badge-warning"
            }`}
            style={{ padding: "4px 10px", fontSize: "12px" }}
          >
            STATUS: {currentStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {actionSuccess && (
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
          <CheckCircle size={16} /> {actionSuccess}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(460px, 100%), 1fr))",
          gap: "18px",
        }}
      >
        <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Evidência em Vídeo (MP4 / Frame)</span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {eventData.camera_uid || "cam_default"}
            </span>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              backgroundColor: "#000000",
              borderRadius: "var(--radius-xs)",
              overflow: "hidden",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!videoError ? (
              <video
                ref={videoRef}
                src={videoUrl}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) setDuration(videoRef.current.duration);
                }}
                onError={() => setVideoError(true)}
              />
            ) : (
              <img
                src={frameUrl}
                alt="Frame de evidência"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            )}

            {detections.map((det, idx) => {
              if (!det.box || det.box.length < 4) return null;
              // Assumindo normalização 0-1 ou resolução 640x480
              const [x1, y1, x2, y2] = det.box;
              const isNorm = x2 <= 1.0 && y2 <= 1.0;
              const left = isNorm ? `${x1 * 100}%` : `${(x1 / 640) * 100}%`;
              const top = isNorm ? `${y1 * 100}%` : `${(y1 / 480) * 100}%`;
              const width = isNorm ? `${(x2 - x1) * 100}%` : `${((x2 - x1) / 640) * 100}%`;
              const height = isNorm ? `${(y2 - y1) * 100}%` : `${((y2 - y1) / 480) * 100}%`;

              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left,
                    top,
                    width,
                    height,
                    border: "2px solid var(--primary-red)",
                    borderRadius: "2px",
                    boxShadow: "0 0 4px rgba(214, 40, 54, 0.6)",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "-18px",
                      left: "-2px",
                      backgroundColor: "var(--primary-red)",
                      color: "#FFFFFF",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "1px 5px",
                      borderRadius: "2px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Track #{det.track_id || idx} ({det.confidence ? `${(det.confidence * 100).toFixed(0)}%` : "AI"})
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              backgroundColor: "var(--bg-surface-elevated)",
              padding: "10px 14px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              style={{
                height: "6px",
                padding: 0,
                accentColor: "var(--primary-red)",
                cursor: "pointer",
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="btn-secondary"
                  style={{ height: "32px", width: "32px", padding: 0 }}
                  title={isPlaying ? "Pausar" : "Reproduzir"}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="btn-secondary"
                  style={{ height: "32px", width: "32px", padding: 0 }}
                  title={isMuted ? "Ativar som" : "Silenciar"}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>

                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {currentTime.toFixed(1)}s / {duration ? `${duration.toFixed(1)}s` : "0.0s"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                className="btn-secondary"
                style={{ height: "30px", fontSize: "11px", padding: "0 8px" }}
              >
                <RotateCcw size={12} /> Reiniciar
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Parâmetros da Ocorrência</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "10px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>ID DO EVENTO</span>
                <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                  {eventData.event_id || eventData.id}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>TIPO DA OCORRÊNCIA</span>
                <div style={{ fontWeight: 600, color: "var(--primary-red)" }}>
                  {eventData.kind || "ANOMALY_CONFIRMED"}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>CÂMERA DE ORIGEM</span>
                <div style={{ fontWeight: 600 }}>{eventData.camera_uid || "cam_default"}</div>
              </div>

              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>DATA E HORÁRIO</span>
                <div style={{ fontWeight: 600 }}>
                  {eventData.created_at
                    ? new Date(eventData.created_at).toLocaleString("pt-BR")
                    : new Date((eventData.timestamp || 0) * 1000).toLocaleString("pt-BR")}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>CONFIANÇA DO MODELO</span>
                <div style={{ fontWeight: 600, color: "var(--warning-yellow)" }}>
                  {ucfScore !== "N/A" ? `${ucfScore}%` : "Inconclusivo"}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>TRACK ID(S)</span>
                <div style={{ fontWeight: 600 }}>
                  {detections.map((d) => `#${d.track_id}`).filter(Boolean).join(", ") || "Nenhum"}
                </div>
              </div>
            </div>
          </div>

          <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Decisão Operacional</h2>

            <div>
              <label
                style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}
              >
                Justificativa do Operador (Opcional)
              </label>
              <textarea
                placeholder="Insira detalhes ou anotações sobre o incidente..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleDecision("confirmado")}
                className="btn-danger"
                disabled={actionLoading}
                style={{ height: "40px", fontSize: "12px" }}
                title="Confirma incidente real no sistema"
              >
                <CheckCircle size={14} /> Confirmar
              </button>

              <button
                type="button"
                onClick={() => handleDecision("investigacao")}
                className="btn-secondary"
                disabled={actionLoading}
                style={{ height: "40px", fontSize: "12px", color: "var(--warning-yellow)" }}
                title="Marca para análise investigativa"
              >
                <HelpCircle size={14} /> Investigar
              </button>

              <button
                type="button"
                onClick={() => handleDecision("falso_positivo")}
                className="btn-secondary"
                disabled={actionLoading}
                style={{ height: "40px", fontSize: "12px" }}
                title="Descarta sem apagar a evidência"
              >
                <XCircle size={14} /> Descartar
              </button>
            </div>
          </div>

          <div className="card-panel" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <History size={16} color="var(--text-secondary)" />
              <h2 style={{ fontSize: "14px", fontWeight: 600 }}>Histórico de Decisões</h2>
            </div>

            {reviewHistory.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                Nenhuma decisão registrada até o momento para este alerta.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {reviewHistory.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "8px 10px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                        {h.decision.toUpperCase()} por {h.operator}
                      </span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                        {new Date(h.timestamp).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                    {h.justification && (
                      <div style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                        "{h.justification}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
