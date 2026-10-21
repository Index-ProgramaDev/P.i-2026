import argparse
import logging
import sys
import time
import threading
from pathlib import Path

import cv2
import yaml

from capture import CameraCapture
from ai import AnomalyProcessor, AnomalyResult
from events import EventManager, EventKind
from storage import StorageManager
from video_buffer import VideoBuffer

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
# Logger principal em INFO, outros em WARNING
logging.getLogger("camsecurity.main").setLevel(logging.INFO)
logger = logging.getLogger("camsecurity.main")


class SharedState:
    """Estado compartilhado entre as threads de captura, IA e exibição."""

    def __init__(self):
        self._frame = None
        self._seq = -1
        self._captured_at = 0.0
        self._lock = threading.Lock()

        # Metadados da IA — trocados atomicamente (sem lock)
        self._ai_meta = {
            "detections": [], "ucf_score": None,
            "is_anomalous": False, "yolo_ms": 0.0, "ucf_ms": 0.0, "ready": False,
        }
        self._latest_result = None
        self._shutdown = False

        # Contadores de FPS
        self._cap_fps = 0.0
        self._cap_frames = 0
        self._cap_start = time.perf_counter()
        self._disp_fps = 0.0
        self._disp_frames = 0
        self._disp_start = time.perf_counter()

    def shutdown(self):
        self._shutdown = True

    def should_stop(self):
        return self._shutdown

    def update_frame(self, frame, seq, captured_at):
        with self._lock:
            self._frame = frame
            self._seq = seq
            self._captured_at = captured_at
            self._cap_frames += 1
            elapsed = time.perf_counter() - self._cap_start
            if elapsed >= 1.0:
                self._cap_fps = self._cap_frames / elapsed
                self._cap_frames = 0
                self._cap_start = time.perf_counter()

    def update_result(self, result):
        self._latest_result = result
        self._ai_meta = {
            "detections":   result.yolo_detections if result else [],
            "ucf_score":    result.ucf_score if result else None,
            "is_anomalous": result.is_anomalous if result else False,
            "yolo_ms":      result.yolo_ms if result else 0.0,
            "ucf_ms":       result.ucf_ms if result else 0.0,
            "ready": True,
        }

    def get_display_frame(self):
        with self._lock:
            frame = self._frame.copy() if self._frame is not None else None
            if frame is not None:
                self._disp_frames += 1
                elapsed = time.perf_counter() - self._disp_start
                if elapsed >= 1.0:
                    self._disp_fps = self._disp_frames / elapsed
                    self._disp_frames = 0
                    self._disp_start = time.perf_counter()
        return frame, self._ai_meta

    def get_frame_for_ai(self):
        with self._lock:
            if self._frame is None:
                return None, -1, 0.0
            return self._frame.copy(), self._seq, self._captured_at

    def get_fps_stats(self):
        return {"capture": self._cap_fps, "display": self._disp_fps}


def load_config(path: str = "config.yaml") -> dict:
    p = Path(path)
    if not p.exists():
        logger.error("Config não encontrado: %s", p)
        sys.exit(1)
    with open(p, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    logger.info("Config carregado: %s", p)
    return cfg


def _ai_thread(shared_state, processor, events, ucf_enabled):
    """Thread de inferência — processa frames sem bloquear a exibição."""
    LAG_WARN_MS = 500  # Aumentado para reduzir logs
    last_seq = -1
    inf_frames = 0
    inf_start = time.perf_counter()
    last_log = time.perf_counter()

    logger.info("Thread de IA iniciada")

    while not shared_state.should_stop():
        frame, seq, captured_at = shared_state.get_frame_for_ai()
        if frame is None:
            time.sleep(0.01)
            continue
        if seq == last_seq:
            time.sleep(0.005)
            continue

        lag_ms = (time.perf_counter() - captured_at) * 1000
        if lag_ms > LAG_WARN_MS:
            logger.warning("IA atrasada: frame=%d  %.0fms", seq, lag_ms)

        last_seq = seq

        try:
            if ucf_enabled:
                result = processor.process_frame(frame, seq, captured_at)
            else:
                t0 = time.perf_counter()
                detections = processor._run_yolo(frame)
                result = AnomalyResult(
                    frame_seq=seq, timestamp=captured_at,
                    yolo_detections=detections, yolo_ms=(time.perf_counter() - t0) * 1000,
                )

            shared_state.update_result(result)
            events.process(result)
            inf_frames += 1
        except Exception as e:
            logger.error("Erro na IA: %s", e, exc_info=False)
            time.sleep(0.1)

        now = time.perf_counter()
        if now - last_log >= 10.0:  # Log a cada 10s ao invés de 5s
            inf_fps = inf_frames / (now - inf_start) if now > inf_start else 0
            fps = shared_state.get_fps_stats()
            logger.info("FPS | Cap: %.1f | IA: %.1f | Display: %.1f",
                        fps["capture"], inf_fps, fps["display"])
            inf_frames = 0
            inf_start = now
            last_log = now

    logger.info("Thread de IA encerrada")


def run(
    config: dict,
    display: bool = False,
    config_path: str = "config.yaml",
    enable_server: bool = True,
    server_host: str = "0.0.0.0",
    server_port: int = 8000,
):
    import uvicorn
    from server import CamSecurityServer
    from database import NeonDatabase

    ucf_enabled = config.get("ucf", {}).get("enabled", True)
    vid_cfg = config.get("video", {})
    pre_sec = float(vid_cfg.get("pre_event_seconds", 5))
    vid_fps = float(vid_cfg.get("fps", 30))

    state = SharedState()
    buf = VideoBuffer(buffer_seconds=pre_sec, fps=vid_fps)

    camera = CameraCapture(config_path=config_path, shared_state=state, video_buffer=buf)
    processor = AnomalyProcessor(config)
    events = EventManager(config)
    storage = StorageManager(config)

    # Neon Database
    db = NeonDatabase()

    # Servidor Web / API REST / WebSocket / Streaming
    server = None
    uvi_server = None
    if enable_server:
        server = CamSecurityServer(
            shared_state=state,
            processor=processor,
            storage_manager=storage,
            db=db,
            config=config,
            camera=camera,
        )

        def _run_uvicorn():
            uvi_config = uvicorn.Config(
                server.app,
                host=server_host,
                port=server_port,
                log_level="warning",
                access_log=False,
            )
            nonlocal uvi_server
            uvi_server = uvicorn.Server(uvi_config)
            uvi_server.run()

        server_thread = threading.Thread(target=_run_uvicorn, daemon=True, name="cam-webserver")
        server_thread.start()
        logger.info("API REST & Streaming rodando em http://%s:%d (Docs: /docs, Stream: /stream)",
                    "127.0.0.1" if server_host == "0.0.0.0" else server_host, server_port)

    storage.set_video_buffer(buf)
    events.on_event(storage.save_event)
    events.set_storage_manager(storage)

    def _on_confirmado(event):
        if event.kind == EventKind.ANOMALY_CONFIRMED:
            ids = [d.track_id for d in event.yolo_detections if d.track_id is not None]
            if ids:
                processor.mark_suspects(ids)
        if server:
            server.broadcast_event({
                "type": "ALERT",
                "kind": event.kind.name,
                "timestamp": event.timestamp,
                "score": float(event.ucf_score),
                "detections": event.yolo_summary,
            })

    events.on_event(_on_confirmado)

    logger.info("Iniciando captura...")
    camera.start()

    # Aguarda o primeiro frame (até 2s)
    for _ in range(20):
        frame, _, _ = state.get_frame_for_ai()
        if frame is not None:
            break
        time.sleep(0.1)
    else:
        logger.error("Nenhum frame recebido após 2 segundos!")

    # Ajusta FPS real da fonte
    if camera.real_fps != vid_fps:
        buf.resize_buffer(camera.real_fps)

    logger.info("Carregando modelos de IA...")
    processor.start()

    ai = threading.Thread(target=_ai_thread,
                          args=(state, processor, events, ucf_enabled), daemon=True)
    ai.start()

    logger.info("CamSecurity rodando. Pressione Q na janela ou CTRL+C para sair.")
    loop_start = time.perf_counter()

    if display:
        cv2.namedWindow("CamSecurity", cv2.WINDOW_NORMAL)

    try:
        while not state.should_stop():
            if display:
                disp_frame, ai_meta = state.get_display_frame()
                if disp_frame is not None:
                    frame_out = (
                        processor._draw_overlays(
                            disp_frame,
                            ai_meta["detections"], ai_meta["ucf_score"],
                            ai_meta["is_anomalous"], ai_meta["yolo_ms"], ai_meta["ucf_ms"],
                        ) if ai_meta["ready"] else disp_frame
                    )
                    cv2.imshow("CamSecurity", frame_out)
                else:
                    time.sleep(0.005)

                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), ord("Q")):
                    logger.info("Q pressionado — encerrando.")
                    state.shutdown()
                    break
            else:
                time.sleep(0.1)
    except KeyboardInterrupt:
        logger.info("Interrompido pelo usuário.")
        state.shutdown()
    finally:
        state.shutdown()
        if uvi_server:
            uvi_server.should_exit = True
        if ai.is_alive():
            ai.join(timeout=2.0)
        processor.stop()
        camera.stop()
        if display:
            cv2.destroyAllWindows()
        elapsed = time.perf_counter() - loop_start
        fps = state.get_fps_stats()
        logger.info("Encerrado. Tempo: %.1fs | FPS Captura: %.1f | Exibição: %.1f",
                    elapsed, fps["capture"], fps["display"])


def main():
    parser = argparse.ArgumentParser(description="CamSecurity backend")
    parser.add_argument("--config", default="config.yaml", help="Caminho para o config (padrão: config.yaml)")
    parser.add_argument("--display", action="store_true", help="Abre janela gráfica do OpenCV no desktop")
    parser.add_argument("--no-server", action="store_true", help="Desativa o servidor FastAPI/WebSocket")
    parser.add_argument("--port", type=int, default=8000, help="Porta do servidor Web (padrão: 8000)")
    parser.add_argument("--host", default="0.0.0.0", help="Host do servidor Web (padrão: 0.0.0.0)")
    args = parser.parse_args()
    run(
        load_config(args.config),
        display=args.display,
        config_path=args.config,
        enable_server=not args.no_server,
        server_host=args.host,
        server_port=args.port,
    )


if __name__ == "__main__":
    main()
