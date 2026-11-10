import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, CheckCircle, XCircle, FileText, Video, Image } from "lucide-react";

export default function AnomalyAlert({ event, onConfirm, onReject, onClose }) {
  const [justification, setJustification] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Toca som de alerta quando o componente monta (pode ser bloqueado pelo navegador)
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log("Áudio bloqueado pelo navegador:", e));
    }

    // Auto-play do vídeo se disponível
    if (videoRef.current) {
      videoRef.current.play().catch((e) => console.log("Autoplay de vídeo bloqueado:", e));
    }
    
    // Para o som quando o componente desmontar
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await onConfirm(event, justification || "Confirmado pelo operador");
      onClose();
    } catch (err) {
      console.error("Erro ao confirmar:", err);
      alert("Erro ao confirmar anomalia: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await onReject(event, justification || "Falso positivo");
      onClose();
    } catch (err) {
      console.error("Erro ao rejeitar:", err);
      alert("Erro ao rejeitar anomalia: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      {/* Áudio de alerta */}
      <audio ref={audioRef} loop>
        <source
          src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTqfj8LRgGgU2jdXvyn0pBSh+zPLaizsKFV6z6OylUxELSKDf8sFuIAUrlM/y2ok3CBhju+zooE8RDEyn4/C0YBoFN4/W78p9KQUnfszx2os6ChVds+jrpVQRC0mf3/PBbiAFK5PQ8dmKOAgYY7vs6KBPEQ1Mp+TwtV8ZBTiP1u/KfSgEKH3M8dmLOwoVXbPp66VUEQtJn9/zwW4gBSuU0PHZiTgIGGO77OigTxENTKbk8LVfGgU4jtbvyn0oBCh+zPHYizoKFV6z6eqlVBELSZ/f88FuHwUrlM/x2Yk4CBdku+zpok8RDU2m5PC1XxoFOI/W78p9KQQnfsz"
          type="audio/wav"
        />
      </audio>

      {/* Overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.92)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          backdropFilter: "blur(8px)",
          animation: "fadeIn 0.3s ease-out",
        }}
        onClick={(e) => e.target === e.currentTarget && !processing && onClose()}
      >
        {/* Modal */}
        <div
          className="card-panel"
          style={{
            maxWidth: "900px",
            width: "100%",
            padding: 0,
            position: "relative",
            boxShadow: "0 25px 80px rgba(240, 68, 82, 0.5), 0 0 0 3px var(--danger-red)",
            border: "none",
            borderRadius: "16px",
            overflow: "hidden",
            animation: "slideUp 0.4s ease-out",
          }}
        >
          {/* Header com Gradiente */}
          <div
            style={{
              background: "linear-gradient(135deg, #F04452 0%, #DC143C 100%)",
              padding: "24px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse 2s infinite",
              }}
            >
              <AlertTriangle size={32} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "0.5px" }}>
                ⚠️ ANOMALIA DETECTADA
              </h2>
              <p style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.9)", margin: "6px 0 0 0", fontWeight: 500 }}>
                Confirmação necessária para registro no sistema
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "#fff",
                cursor: processing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                opacity: processing ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!processing) {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Conteúdo */}
          <div style={{ padding: "28px" }}>
            {/* Vídeo / Frame com Tabs */}
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "12px",
                  borderBottom: "2px solid var(--border-subtle)",
                }}
              >
                <button
                  onClick={() => setShowVideo(true)}
                  disabled={processing}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    backgroundColor: showVideo ? "var(--danger-red)" : "transparent",
                    color: showVideo ? "#fff" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: processing ? "not-allowed" : "pointer",
                    borderRadius: "8px 8px 0 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                    opacity: processing ? 0.5 : 1,
                  }}
                >
                  <Video size={16} />
                  Vídeo
                </button>
                <button
                  onClick={() => setShowVideo(false)}
                  disabled={processing}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    backgroundColor: !showVideo ? "var(--danger-red)" : "transparent",
                    color: !showVideo ? "#fff" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: processing ? "not-allowed" : "pointer",
                    borderRadius: "8px 8px 0 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                    opacity: processing ? 0.5 : 1,
                  }}
                >
                  <Image size={16} />
                  Frame
                </button>
              </div>

              <div
                style={{
                  width: "100%",
                  aspectRatio: "16/9",
                  backgroundColor: "#000",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                  border: "2px solid var(--danger-red)",
                }}
              >
                {showVideo && event.id ? (
                  <video
                    ref={videoRef}
                    src={`http://127.0.0.1:8000/events/${event.id}/video`}
                    controls
                    loop
                    autoPlay
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      console.error("Erro ao carregar vídeo:", e);
                      setShowVideo(false);
                    }}
                  />
                ) : (
                  <img
                    src={event.id ? `http://127.0.0.1:8000/events/${event.id}/frame` : "/placeholder.jpg"}
                    alt="Frame da anomalia"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E%3Crect fill='%23222' width='800' height='450'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' text-anchor='middle' dy='.3em' font-family='Arial' font-size='20'%3EFrame indisponível%3C/text%3E%3C/svg%3E";
                    }}
                  />
                )}
              </div>
            </div>

            {/* Informações do Evento */}
            <div
              style={{
                padding: "16px",
                backgroundColor: "rgba(240, 68, 82, 0.08)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "20px",
                border: "1px solid rgba(240, 68, 82, 0.2)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Score de Anomalia:</span>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--danger-red)", marginTop: "4px" }}>
                    {event.score != null ? (event.score * 100).toFixed(1) : "N/A"}%
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Pessoas Detectadas:</span>
                  <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                    {event.detections?.length || 0}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Horário:</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>
                    {new Date(event.timestamp * 1000).toLocaleTimeString("pt-BR")}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Tipo:</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>
                    {event.kind || "ANOMALY_CONFIRMED"}
                  </div>
                </div>
              </div>
            </div>

            {/* Justificativa */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                }}
              >
                <FileText size={14} />
                Justificativa / Observações (opcional):
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva o que foi observado..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xs)",
                  color: "var(--text-main)",
                  fontSize: "13px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                disabled={processing}
              />
            </div>

            {/* Botões de Ação */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={handleReject}
                className="btn-secondary"
                disabled={processing}
                style={{ flex: 1, height: "48px", fontSize: "14px" }}
              >
                <XCircle size={18} />
                {processing ? "Processando..." : "Falso Positivo"}
              </button>
              <button
                onClick={handleConfirm}
                className="btn-primary"
                disabled={processing}
                style={{
                  flex: 1,
                  height: "48px",
                  fontSize: "14px",
                  backgroundColor: "var(--danger-red)",
                  borderColor: "var(--danger-red)",
                }}
              >
                <CheckCircle size={18} />
                {processing ? "Processando..." : "Confirmar Anomalia"}
              </button>
            </div>

            <p style={{ fontSize: "11px", color: "var(--text-secondary)", textAlign: "center", marginTop: "16px" }}>
              Esta ação registrará o evento no banco de dados para análise posterior
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
          }
          50% { 
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
          }
        }
      `}</style>
    </>
  );
}
