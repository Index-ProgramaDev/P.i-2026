import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  FileText,
  Video,
  Image as ImageIcon,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scan,
  User,
  Clock,
  Hash,
  Tag,
  Crosshair,
  Loader2,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

const QUICK_TAGS = [
  "Vandalismo",
  "Abuso",
  "Agressão",
  "Porte de Arma",
  "Furto/Roubo",
  "Invasão",
];

function Kbd({ children }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
      style={{
        background: "rgba(255,255,255,0.22)",
        border: "1px solid rgba(255,255,255,0.55)",
        color: "#FFFFFF",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </span>
  );
}

export default function AnomalyAlert({
  event,
  onConfirm,
  onReject,
  onClose,
  userId = null,
  userEmail = null,
  cameraName = null,
}) {
  const { user } = useAuth();
  const [justification, setJustification] = useState("");
  const [quickTag, setQuickTag] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frameError, setFrameError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoRetry, setVideoRetry] = useState(0);
  const videoRetryTimer = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const [mediaSize, setMediaSize] = useState({ w: 0, h: 0 });

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const imgRef = useRef(null);

  const eventRef = useRef(event);
  eventRef.current = event;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const onRejectRef = useRef(onReject);
  onRejectRef.current = onReject;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const justificationRef = useRef(justification);
  justificationRef.current = justification;
  const quickTagRef = useRef(quickTag);
  quickTagRef.current = quickTag;
  const processingRef = useRef(processing);
  processingRef.current = processing;

  const detList = Array.isArray(event?.detections_list)
    ? event.detections_list
    : Array.isArray(event?.detections)
      ? event.detections
      : [];

  const buildJustification = useCallback(() => {
    const parts = [];
    if (quickTagRef.current) parts.push(`[${quickTagRef.current}]`);
    const note = justificationRef.current.trim();
    if (note) parts.push(note);
    return parts.join(" ") || undefined;
  }, []);

  const doConfirm = useCallback(async () => {
    if (processingRef.current) return;
    setProcessing(true);
    try {
      await onConfirmRef.current(eventRef.current, buildJustification());
      onCloseRef.current();
    } catch (err) {
      console.error("Erro ao confirmar:", err);
      setProcessing(false);
    }
  }, [buildJustification]);

  const doReject = useCallback(async () => {
    if (processingRef.current) return;
    setProcessing(true);
    try {
      await onRejectRef.current(eventRef.current, buildJustification());
      onCloseRef.current();
    } catch (err) {
      console.error("Erro ao rejeitar:", err);
      setProcessing(false);
    }
  }, [buildJustification]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key.toLowerCase() === "f") { e.preventDefault(); doReject(); return; }
      if (e.key === "Enter") { e.preventDefault(); doConfirm(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doConfirm, doReject]);

  // O event.mp4 só existe ~20s após o alerta (gravação pré+pós). Se der 404,
  // retentamos a cada 4s por até ~2min enquanto a evidência é gravada.
  const handleVideoError = () => {
    if (videoRetry < 30) {
      videoRetryTimer.current = setTimeout(() => setVideoRetry((r) => r + 1), 4000);
    } else {
      setVideoError(true);
    }
  };

  useEffect(() => () => clearTimeout(videoRetryTimer.current), []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    if (videoRef.current && showVideo) {
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [showVideo]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause();
    else v.play().catch(() => {});
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  };

  const zoomBy = (delta) => {
    setZoom((z) => Math.min(3, Math.max(1, +(z + delta).toFixed(1))));
  };

  const score = event?.score != null ? event.score : null;
  const scorePct = score != null ? Math.round(score * 1000) / 10 : null;
  // timestamp pode vir como perf_counter (backend antigo) — valida ano >= 2001
  const tsMs = event?.timestamp ? event.timestamp * 1000 : 0;
  const ts = tsMs > 978307200000 ? new Date(tsMs) : new Date();
  const eventId = event?.id || event?.event_id || "—";
  const cameraLabel = cameraName || event?.camera_uid || "Câmera Principal";
  const operatorName = user?.username || userId || "operador";

  const detClasses = [...new Set(detList.map((d) => d.class_name).filter(Boolean))];

  const videoUrl = event?.id
    ? api.getEventVideoUrl(event.id, userId, userEmail) + (videoRetry ? `&r=${videoRetry}` : "")
    : null;
  const frameUrl = event?.id ? api.getEventFrameUrl(event.id, userId, userEmail) : null;

  // Boxes em % do viewport do media (coords são pixels do frame fonte)
  const renderBoxes = (w, h) => {
    if (!showBoxes || w <= 0 || h <= 0) return null;
    return detList
      .filter((d) => d.box && d.box.length >= 4)
      .map((d, i) => {
        const [x1, y1, x2, y2] = d.box;
        const left = (x1 / w) * 100;
        const top = (y1 / h) * 100;
        const width = ((x2 - x1) / w) * 100;
        const height = ((y2 - y1) / h) * 100;
        if (width <= 0 || height <= 0) return null;
        return (
          <div
            key={i}
            className="pointer-events-none absolute border-2 border-red-500"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              boxShadow: "0 0 12px rgba(239,68,68,0.35), inset 0 0 12px rgba(239,68,68,0.15)",
            }}
          >
            <span className="absolute -top-5 left-0 whitespace-nowrap bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {d.class_name || "OBJ"} {d.confidence != null ? `${Math.round(d.confidence * 100)}%` : ""}
              {d.track_id != null ? ` · T${d.track_id}` : ""}
            </span>
          </div>
        );
      });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      style={{ animation: "socFadeIn 0.25s ease-out" }}
      onClick={(e) => e.target === e.currentTarget && !processing && onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-[#090D16] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]"
        style={{ animation: "socSlideUp 0.3s cubic-bezier(0.22,1,0.36,1)" }}
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 bg-[#0B101B] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-400">
              Anomalia Detectada
            </span>
          </div>

          <div className="mx-1 h-5 w-px bg-slate-700/60" />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{cameraLabel}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              {event?.camera_uid || "cam_default"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {ts && (
              <div className="hidden text-right sm:block">
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Timestamp</p>
                <p className="font-mono text-xs text-slate-300">
                  {ts.toLocaleDateString("pt-BR")} {ts.toLocaleTimeString("pt-BR")}
                </p>
              </div>
            )}
            <div className="hidden text-right sm:block">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Operador</p>
              <p className="flex items-center gap-1.5 text-xs text-slate-300">
                <User size={11} className="text-slate-500" /> {operatorName}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-500 bg-slate-800/80 text-slate-100 transition-colors hover:border-slate-400 hover:bg-slate-700 disabled:opacity-40"
              aria-label="Fechar"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[1.6fr_1fr]">
          <div className="flex min-w-0 flex-col border-b border-slate-800/80 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-1 border-b border-slate-800/60 px-4 pt-3">
              {[
                { id: "video", label: "VIDEO", icon: Video },
                { id: "frame", label: "FOTO", icon: ImageIcon },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setShowVideo(t.id === "video"); setMediaError(false); }}
                  className={`flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    (t.id === "video") === showVideo
                      ? "border-red-500 text-slate-100"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <t.icon size={12} /> {t.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 pb-1">
                <button
                  onClick={() => setShowBoxes((v) => !v)}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    showBoxes
                      ? "border-red-500/40 bg-red-500/10 text-red-300"
                      : "border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}
                  title="Alternar bounding boxes de IA"
                >
                  <Scan size={11} /> AI Overlay
                </button>
              </div>
            </div>

            <div className="bg-black p-3">
              <div
                className="relative mx-auto w-full overflow-hidden rounded-md border border-slate-800 bg-black"
                style={{ aspectRatio: "16/9", maxHeight: "52vh" }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s ease" }}
                >
                  {showVideo ? (
                    videoError ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-600">
                        <Video size={28} />
                        <span className="text-xs">Vídeo de evidência indisponível</span>
                      </div>
                    ) : (
                      <>
                        {!videoLoaded && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80">
                            <Loader2 size={26} className="animate-spin text-red-500" />
                            <div className="text-center">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Evidência em gravação
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                O clipe fica disponível ~20s após o alerta — tentando novamente…
                              </p>
                            </div>
                          </div>
                        )}
                        <video
                          key={videoRetry}
                          ref={videoRef}
                          src={videoUrl}
                          className="h-full w-full object-contain"
                          onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
                          onLoadedMetadata={() => {
                            setVideoLoaded(true);
                            if (videoRef.current) {
                              setDuration(videoRef.current.duration);
                              setMediaSize({ w: videoRef.current.videoWidth, h: videoRef.current.videoHeight });
                            }
                          }}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onEnded={() => setIsPlaying(false)}
                          onError={handleVideoError}
                        />
                      </>
                    )
                  ) : !frameError && frameUrl ? (
                    <img
                      ref={imgRef}
                      src={frameUrl}
                      alt="Frame capturado"
                      className="h-full w-full object-contain"
                      onLoad={(e) => setMediaSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                      onError={() => setFrameError(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-600">
                      <ImageIcon size={28} />
                      <span className="text-xs">Frame indisponível</span>
                    </div>
                  )}
                </div>

                {showVideo && showBoxes && mediaSize.w > 0 && renderBoxes(mediaSize.w, mediaSize.h)}

                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.05]"
                  style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 3px)" }}
                />
              </div>

              {showVideo && !videoError && videoLoaded && (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-800 bg-[#0B101B] px-3 py-2">
                  <button onClick={togglePlay} className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800" title={isPlaying ? "Pausar" : "Reproduzir"}>
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button onClick={toggleMute} className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800" title={isMuted ? "Ativar som" : "Silenciar"}>
                    {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="h-1 flex-1 cursor-pointer accent-red-500"
                  />
                  <span className="font-mono text-[10px] text-slate-500">
                    {currentTime.toFixed(1)}s / {duration ? `${duration.toFixed(1)}s` : "--"}
                  </span>
                  <div className="mx-1 h-4 w-px bg-slate-700" />
                  <button onClick={() => zoomBy(-0.25)} className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800" title="Reduzir zoom">
                    <ZoomOut size={13} />
                  </button>
                  <span className="w-9 text-center font-mono text-[10px] text-slate-400">{zoom.toFixed(1)}×</span>
                  <button onClick={() => zoomBy(0.25)} className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800" title="Ampliar zoom">
                    <ZoomIn size={13} />
                  </button>
                  <button onClick={() => setZoom(1)} className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800" title="Zoom 100%">
                    <Maximize2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4">
            <section>
              <p className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Telemetria do Evento
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="col-span-2 rounded-lg border border-slate-800 bg-[#0B101B] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <Crosshair size={11} /> Confiança da Anomalia
                    </span>
                    <span className="font-mono text-sm font-bold text-red-400">
                      {scorePct != null ? `${scorePct}%` : "N/A"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${scorePct ?? 0}%`,
                        background: scorePct != null && scorePct >= 85 ? "#EF4444" : scorePct != null && scorePct >= 60 ? "#F59E0B" : "#EAB308",
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <User size={11} /> Pessoas / Objetos
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-100">{detList.length > 0 ? detList.length : "—"}</p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <Clock size={11} /> Ocorrido em
                  </p>
                  <p className="mt-1 font-mono text-[11px] font-semibold text-slate-200">
                    {ts ? ts.toLocaleTimeString("pt-BR") : "—"}
                  </p>
                  <p className="font-mono text-[10px] text-slate-500">
                    {ts ? ts.toLocaleDateString("pt-BR") : ""}
                  </p>
                </div>

                <div className="col-span-2 rounded-lg border border-slate-800 bg-[#0B101B] p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <Hash size={11} /> ID do Evento
                  </p>
                  <p className="truncate font-mono text-xs font-semibold text-slate-200">{eventId}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {event?.kind || "ANOMALY_CONFIRMED"}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Tag size={11} className="text-slate-600" />
                {detClasses.length > 0 ? (
                  detClasses.map((c) => (
                    <span key={c} className="rounded border border-slate-700/70 bg-slate-800/50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                      {c.replace(/_/g, " ")}
                    </span>
                  ))
                ) : (
                  <span className="rounded border border-slate-700/70 bg-slate-800/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Sem classificação
                  </span>
                )}
              </div>
            </section>

            <section className="mt-auto flex flex-col gap-3">
              <div>
                <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Categorização rápida
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuickTag((t) => (t === tag ? "" : tag))}
                      disabled={processing}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                        quickTag === tag
                          ? "border-red-500/60 bg-red-500/15 text-red-300"
                          : "border-slate-700/70 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  <FileText size={11} /> Observações do operador
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Descreva o contexto observado — ex: 'funcionárioUniforme verde próximo ao acesso norte'…"
                  rows={3}
                  disabled={processing}
                  className="w-full resize-none rounded-md border border-slate-700/70 bg-[#0B101B] px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-red-500/60 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  onClick={doReject}
                  disabled={processing}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-slate-600/60 bg-transparent text-[12px] font-semibold uppercase tracking-wider text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800/50 disabled:opacity-50"
                >
                  <XCircle size={15} className="text-slate-400" />
                  Falso Positivo
                  <Kbd>F</Kbd>
                </button>
                <button
                  onClick={doConfirm}
                  disabled={processing}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-red-600 bg-red-600 text-[12px] font-bold uppercase tracking-wider text-white transition-all hover:bg-red-500 hover:shadow-[0_0_24px_rgba(239,68,68,0.35)] disabled:opacity-50"
                >
                  {processing ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <CheckCircle size={15} />
                  )}
                  Confirmar e Escalar
                  <Kbd>Enter</Kbd>
                </button>
              </div>
              <p className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-600">
                Esc fecha · a decisão é registrada no histórico do evento
              </p>
            </section>
          </div>
        </div>
      </div>

      <audio ref={audioRef}>
        <source
          src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTqfj8LRgGgU2jdXvyn0pBSh+zPLaizsKFV6z6OylUxELSKDf8sFuIAUrlM/y2ok3CBhju+zooE8RDEyn4/C0YBoFN4/W78p9KQUnfszx2os6ChVds+jrpVQRC0mf3/PBbiAFK5PQ8dmKOAgYY7vs6KBPEQ1Mp+TwtV8ZBTiP1u/KfSgEKH3M8dmLOwoVXbPp66VUEQtJn9/zwW4gBSuU0PHZiTgIGGO77OigTxENTKbk8LVfGgU4jtbvyn0oBCh+zPHYizoKFV6z6eqlVBELSZ/f88FuHwUrlM/x2Yk4CBdku+zpok8RDU2m5PC1XxoFOI/W78p9KQUnfszx2os6ChVds+jrpVQRC0mf3/PBbiAFK5PQ8dmKOAgYY7vs6KBPEQ1Mp+TwtV8ZBTiP1u/KfSgEKH3M8dmLOwoVXbPp66VUEQtJn9/zwW4gBSuU0PHZiTgIGGO77OigTxENTKbk8LVfGgU4jtbvyn0oBCh+zPHYizoKFV6z6eqlVBELSZ/f88FuHwUrlM/x2Yk4CBdku+zpok8RDU2m5PC1XxoFOI/W78p9KQUnfszx2os6ChVds+jrpVQRC0mf3/PBbiAFK5PQ8dmKOAgYY7vs6KBPEQ1Mp+TwtV8ZBTiP1u/KfSgEKH3M8dmLOwoVXbPp66VUEQtJn9/zwW4gBSuU0PHZiTgIGGO77OigTxENTKbk8LVfGgU4jtbvyn0oBCh+zPHYizoKFV6z6eqlVBELSZ/f88Fu"
          type="audio/wav"
        />
      </audio>

      <style>{`
        @keyframes socFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes socSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
