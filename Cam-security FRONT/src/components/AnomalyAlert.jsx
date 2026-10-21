import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, CheckCircle, XCircle, FileText } from "lucide-react";
import { api } from "../api";

export default function AnomalyAlert({ event, onConfirm, onReject, onClose }) {
  const [justification, setJustification] = useState("");
  const [processing, setProcessing] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Toca som de alerta quando o componente monta
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log("Erro ao tocar som:", e));
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
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          backdropFilter: "blur(4px)",
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Modal */}
        <div
          className="card-panel"
          style={{
            maxWidth: "600px",
            width: "100%",
            padding: "24px",
            position: "relative",
            boxShadow: "0 20px 60px rgba(240, 68, 82, 0.4)",
            border: "2px solid var(--danger-red)",
            animation: "pulse 2s infinite",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(240, 68, 82, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={28} color="var(--danger-red)" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--danger-red)", margin: 0 }}>
                ⚠️ ANOMALIA DETECTADA
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
                Confirmação necessária para registro no sistema
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn-secondary"
              style={{ width: "32px", height: "32px", padding: 0 }}
              disabled={processing}
            >
              <X size={16} />
            </button>
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
                  {event.score ? (event.score * 100).toFixed(1) : "N/A"}%
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
              style={{ flex: 1, height: "44px" }}
            >
              <XCircle size={16} />
              {processing ? "Processando..." : "Falso Positivo"}
            </button>
            <button
              onClick={handleConfirm}
              className="btn-primary"
              disabled={processing}
              style={{
                flex: 1,
                height: "44px",
                backgroundColor: "var(--danger-red)",
                borderColor: "var(--danger-red)",
              }}
            >
              <CheckCircle size={16} />
              {processing ? "Processando..." : "Confirmar Anomalia"}
            </button>
          </div>

          <p style={{ fontSize: "11px", color: "var(--text-secondary)", textAlign: "center", marginTop: "16px" }}>
            Esta ação registrará o evento no banco de dados para análise posterior
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
      `}</style>
    </>
  );
}
