import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Play,
  Image as ImageIcon,
  RefreshCw,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Download,
  Eye,
} from "lucide-react";

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalType, setModalType] = useState(null); // 'review' | 'video' | 'frame'
  const [filter, setFilter] = useState("all"); // 'all' | 'pending' | 'confirmed' | 'rejected'
  const [justification, setJustification] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await api.getEvents({ 
        limit: 200, 
        user_id: user?.id,
        user_email: user?.email,
      });
      setEvents(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 15000);
    return () => clearInterval(interval);
  }, []);

  const getEventStatus = (ev) => {
    if (!ev.metadata) return "pending";
    const meta = typeof ev.metadata === "string" ? JSON.parse(ev.metadata) : ev.metadata;
    return meta.status || meta.last_decision || "pending";
  };

  const filteredEvents = events.filter((ev) => {
    if (filter === "all") return true;
    const status = getEventStatus(ev);
    if (filter === "pending") return status === "pending" || !status;
    if (filter === "confirmed") return status === "confirmado";
    if (filter === "rejected") return status === "falso_positivo";
    return true;
  });

  const handleReview = async (decision) => {
    if (!selectedEvent) return;
    setProcessing(true);
    try {
      await api.reviewEvent(selectedEvent.event_id || selectedEvent.id, {
        decision: decision,
        operator: user?.username || "operador",
        justification: justification || (decision === "confirmado" ? "Confirmado" : "Falso positivo"),
      });
      await fetchEvents();
      closeModal();
      setJustification("");
    } catch (err) {
      console.error("Erro ao revisar evento:", err);
      alert("Erro ao revisar evento: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (ev, type) => {
    setSelectedEvent(ev);
    setModalType(type);
    setJustification("");
  };

  const closeModal = () => {
    setSelectedEvent(null);
    setModalType(null);
    setJustification("");
  };

  const pendingCount = events.filter((e) => {
    const s = getEventStatus(e);
    return s === "pending" || !s;
  }).length;

  const confirmedCount = events.filter((e) => getEventStatus(e) === "confirmado").length;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600 }}>Central de Revisão</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
            Analise eventos detectados e classifique como anomalia confirmada ou falso positivo
          </p>
        </div>

        <button onClick={fetchEvents} className="btn-secondary" style={{ height: "38px" }} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        <div className="card-panel" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
            AGUARDANDO REVISÃO
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--warning-yellow)" }}>
            {pendingCount}
          </div>
        </div>
        <div className="card-panel" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
            CONFIRMADAS
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--danger-red)" }}>
            {confirmedCount}
          </div>
        </div>
        <div className="card-panel" style={{ padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
            TOTAL DE EVENTOS
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700 }}>{events.length}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "btn-primary" : "btn-secondary"}
          style={{ height: "34px", fontSize: "12px" }}
        >
          <Filter size={14} /> Todos ({events.length})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={filter === "pending" ? "btn-primary" : "btn-secondary"}
          style={{ height: "34px", fontSize: "12px" }}
        >
          <AlertTriangle size={14} /> Pendentes ({pendingCount})
        </button>
        <button
          onClick={() => setFilter("confirmed")}
          className={filter === "confirmed" ? "btn-primary" : "btn-secondary"}
          style={{ height: "34px", fontSize: "12px" }}
        >
          <CheckCircle size={14} /> Confirmadas ({confirmedCount})
        </button>
      </div>

      {/* Grid de Eventos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {filteredEvents.length === 0 ? (
          <div
            className="card-panel"
            style={{
              padding: "60px 20px",
              textAlign: "center",
              gridColumn: "1 / -1",
              color: "var(--text-secondary)",
            }}
          >
            <AlertTriangle size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
              Nenhum evento encontrado
            </div>
            <div style={{ fontSize: "13px" }}>
              {filter === "pending"
                ? "Não há eventos aguardando revisão"
                : filter === "confirmed"
                ? "Nenhuma anomalia foi confirmada ainda"
                : "Altere os filtros ou aguarde novos eventos"}
            </div>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const status = getEventStatus(ev);
            const score = ev.ucf_score !== null ? (ev.ucf_score * 100).toFixed(1) : "N/A";
            const isPending = status === "pending" || !status;
            const isConfirmed = status === "confirmado";

            return (
              <div
                key={ev.id || ev.event_id}
                className="card-panel"
                style={{
                  padding: "12px",
                  border: isPending
                    ? "2px solid var(--warning-yellow)"
                    : isConfirmed
                    ? "2px solid var(--danger-red)"
                    : "1px solid var(--border-subtle)",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    backgroundColor: "#000",
                    borderRadius: "var(--radius-xs)",
                    overflow: "hidden",
                    marginBottom: "12px",
                    position: "relative",
                    cursor: "pointer",
                  }}
                  onClick={() => openModal(ev, "frame")}
                >
                  <img
                    src={api.getEventFrameUrl(ev.event_id || ev.id, user?.id, user?.email)}
                    alt="Frame do evento"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: "rgba(0,0,0,0.7)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    Score: {score}%
                  </div>
                  {isPending && (
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        backgroundColor: "var(--warning-yellow)",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#000",
                      }}
                    >
                      PENDENTE
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    {ev.event_id || `Evento #${ev.id}`}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                    {new Date((ev.timestamp || 0) * 1000).toLocaleString("pt-BR")}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Câmera: {ev.camera_uid || "cam_default"}
                  </div>
                </div>

                {/* Status Badge */}
                <div style={{ marginBottom: "12px" }}>
                  <span
                    className={`badge ${
                      isConfirmed
                        ? "badge-danger"
                        : status === "falso_positivo"
                        ? "badge-neutral"
                        : "badge-warning"
                    }`}
                  >
                    {isConfirmed
                      ? "✓ Confirmada"
                      : status === "falso_positivo"
                      ? "✗ Falso Positivo"
                      : "Aguardando"}
                  </span>
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {isPending && (
                    <button
                      onClick={() => openModal(ev, "review")}
                      className="btn-primary"
                      style={{ flex: 1, height: "32px", fontSize: "11px" }}
                    >
                      <Eye size={12} /> Revisar
                    </button>
                  )}
                  <button
                    onClick={() => openModal(ev, "video")}
                    className="btn-secondary"
                    style={{ flex: isPending ? 0 : 1, height: "32px", fontSize: "11px", padding: isPending ? "0 10px" : "0 12px" }}
                  >
                    <Play size={12} /> {isPending ? "" : "Vídeo"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Revisão */}
      {modalType === "review" && selectedEvent && (
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
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="card-panel" style={{ maxWidth: "800px", width: "100%", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Revisar Evento</h2>
              <button onClick={closeModal} className="btn-secondary" style={{ width: "32px", height: "32px", padding: 0 }}>
                <X size={16} />
              </button>
            </div>

            {/* Preview do Evento */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>Frame do Evento</div>
                <img
                  src={api.getEventFrameUrl(selectedEvent.event_id || selectedEvent.id, user?.id, user?.email)}
                  alt="Frame"
                  style={{ width: "100%", borderRadius: "var(--radius-xs)", border: "1px solid var(--border-subtle)" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Evento ID</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{selectedEvent.event_id || selectedEvent.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Score de Anomalia</div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--warning-yellow)" }}>
                    {selectedEvent.ucf_score ? (selectedEvent.ucf_score * 100).toFixed(1) : "N/A"}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Data/Hora</div>
                  <div style={{ fontSize: "13px" }}>
                    {new Date((selectedEvent.timestamp || 0) * 1000).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Câmera</div>
                  <div style={{ fontSize: "13px" }}>{selectedEvent.camera_uid || "cam_default"}</div>
                </div>
              </div>
            </div>

            {/* Justificativa */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                Observações / Justificativa (opcional):
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva o que foi observado no vídeo..."
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

            {/* Botões */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => handleReview("falso_positivo")}
                className="btn-secondary"
                disabled={processing}
                style={{ flex: 1, height: "44px" }}
              >
                <XCircle size={16} />
                {processing ? "Processando..." : "Falso Positivo"}
              </button>
              <button
                onClick={() => handleReview("confirmado")}
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
          </div>
        </div>
      )}

      {/* Modal de Vídeo */}
      {modalType === "video" && selectedEvent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }}>
            <button
              onClick={closeModal}
              className="btn-secondary"
              style={{
                position: "absolute",
                top: "-40px",
                right: "0",
                width: "36px",
                height: "36px",
                padding: 0,
              }}
            >
              <X size={18} />
            </button>
            <video
              controls
              autoPlay
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <source src={api.getEventVideoUrl(selectedEvent.event_id || selectedEvent.id, user?.id, user?.email)} type="video/mp4" />
              Seu navegador não suporta vídeo HTML5.
            </video>
          </div>
        </div>
      )}

      {/* Modal de Frame */}
      {modalType === "frame" && selectedEvent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }}>
            <button
              onClick={closeModal}
              className="btn-secondary"
              style={{
                position: "absolute",
                top: "-40px",
                right: "0",
                width: "36px",
                height: "36px",
                padding: 0,
              }}
            >
              <X size={18} />
            </button>
            <img
              src={api.getEventFrameUrl(selectedEvent.event_id || selectedEvent.id, user?.id, user?.email)}
              alt="Frame do evento"
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                borderRadius: "var(--radius-sm)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
