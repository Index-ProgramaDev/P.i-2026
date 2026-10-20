"""FastAPI Backend Server para CamSecurity.

Recursos:
1. Streaming de vídeo MJPEG em tempo real com overlays (/stream)
2. Alertas e eventos em tempo real via WebSocket (/ws/events) ou SSE (/events/sse)
3. Endpoints REST para listagem, filtros e metadados (/events, /events/{id})
4. Streaming com suporte a Range requests para reprodução fluida de MP4 (/events/{id}/video, /events/{id}/frame)
5. Status e saúde do sistema (/status, /health)
"""

import asyncio
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional, Set

import cv2
from fastapi import FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger("camsecurity.server")


class EventFilterParams(BaseModel):
    kind: Optional[str] = None
    min_score: Optional[float] = None
    limit: int = 50
    offset: int = 0


class CamSecurityServer:
    """Encapsula a aplicação FastAPI e integração com o pipeline de visão/IA."""

    def __init__(self, shared_state=None, processor=None, storage_manager=None, db=None, config=None):
        self.shared_state = shared_state
        self.processor = processor
        self.storage_manager = storage_manager
        self.db = db
        self.config = config or {}

        self.storage_root = Path(self.config.get("storage", {}).get("root", "storage"))
        self.events_dir = self.storage_root / "events"

        # Conexões WebSocket ativas
        self._ws_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock() if asyncio.get_event_loop().is_running() else None

        # Fila de eventos para broadcast e SSE
        self._event_subscribers: List[asyncio.Queue] = []

        self.app = FastAPI(
            title="Cam-Security AI Backend",
            description="API REST, Streaming de Vídeo e Alertas em Tempo Real",
            version="2.0.0",
        )
        self._setup_cors()
        self._setup_routes()

    def _setup_cors(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def broadcast_event(self, event_data: dict):
        """Dispara evento assincronamente para todos os WebSockets e canais SSE."""
        # Se chamado a partir de thread do pipeline (não-async)
        for q in list(self._event_subscribers):
            try:
                q.put_nowait(event_data)
            except Exception:
                pass

    def _setup_routes(self):
        app = self.app

        @app.get("/health")
        def health_check():
            return {
                "status": "online",
                "timestamp": time.time(),
                "db_enabled": bool(self.db and self.db.is_enabled()),
            }

        @app.get("/status")
        def system_status():
            stats = self.shared_state.get_fps_stats() if self.shared_state else {}
            latest_ai = self.shared_state._ai_meta if self.shared_state else {}
            return {
                "fps": stats,
                "ai_state": latest_ai,
                "db_connected": bool(self.db and self.db.is_enabled()),
                "total_ws_clients": len(self._ws_connections),
            }

        # ── 1. Streaming de Vídeo MJPEG ──────────────────────────────────────
        @app.get("/stream")
        def video_stream(overlays: bool = True):
            """Streaming MJPEG da câmera em tempo real para ser consumido via tag <img src="/stream">."""
            return StreamingResponse(
                self._generate_mjpeg_stream(draw_overlays=overlays),
                media_type="multipart/x-mixed-replace; boundary=frame",
            )

        # ── 2. Alertas em Tempo Real (WebSocket & SSE) ───────────────────────
        @app.websocket("/ws/events")
        async def websocket_events(websocket: WebSocket):
            await websocket.accept()
            self._ws_connections.add(websocket)
            q = asyncio.Queue()
            self._event_subscribers.append(q)
            logger.info("Cliente WebSocket conectado. Total: %d", len(self._ws_connections))

            try:
                # Envia confirmação inicial de handshake
                await websocket.send_text(json.dumps({"type": "CONNECTED", "msg": "CamSecurity WS pronto"}))

                while True:
                    # Espera novo evento na fila ou timeout para ping
                    try:
                        event_data = await asyncio.wait_for(q.get(), timeout=15.0)
                        await websocket.send_text(json.dumps(event_data))
                    except asyncio.TimeoutError:
                        await websocket.send_text(json.dumps({"type": "PING", "time": time.time()}))
            except WebSocketDisconnect:
                logger.info("Cliente WebSocket desconectado.")
            except Exception as e:
                logger.warning("Erro no WebSocket: %s", e)
            finally:
                self._ws_connections.discard(websocket)
                if q in self._event_subscribers:
                    self._event_subscribers.remove(q)

        @app.get("/events/sse")
        async def sse_events():
            """Server-Sent Events (SSE) alternativo para navegadores."""
            async def event_generator() -> AsyncGenerator[str, None]:
                q = asyncio.Queue()
                self._event_subscribers.append(q)
                try:
                    yield "event: connected\ndata: {\"status\": \"ok\"}\n\n"
                    while True:
                        try:
                            item = await asyncio.wait_for(q.get(), timeout=15.0)
                            yield f"event: alert\ndata: {json.dumps(item)}\n\n"
                        except asyncio.TimeoutError:
                            yield f": ping {time.time()}\n\n"
                finally:
                    if q in self._event_subscribers:
                        self._event_subscribers.remove(q)

            return StreamingResponse(event_generator(), media_type="text/event-stream")

        # ── 3. Listagem e Filtro de Eventos REST ──────────────────────────────
        @app.get("/events")
        def list_events(
            kind: Optional[str] = Query(None, description="Ex: ANOMALY_CONFIRMED"),
            min_score: Optional[float] = Query(None, description="Score mínimo do UCF"),
            limit: int = Query(50, ge=1, le=200),
            offset: int = Query(0, ge=0),
        ):
            """Lista eventos com suporte a Neon Database prioritário e fallback JSONL."""
            if self.db and self.db.is_enabled():
                events = self.db.list_events(kind=kind, min_score=min_score, limit=limit, offset=offset)
                return {"source": "neon_db", "total": len(events), "items": events}

            # Fallback local via JSONL
            records = self.storage_manager.load_events() if self.storage_manager else []
            if kind:
                records = [r for r in records if r.get("kind") == kind]
            if min_score is not None:
                records = [r for r in records if (r.get("ucf_score") or 0.0) >= min_score]

            total = len(records)
            paged = records[offset : offset + limit]
            return {"source": "jsonl", "total": total, "items": paged}

        @app.get("/events/{event_id}")
        def get_event(event_id: str):
            """Retorna detalhes de um evento específico."""
            if self.db and self.db.is_enabled():
                ev = self.db.get_event_by_id(event_id)
                if ev:
                    return ev

            if self.storage_manager:
                records = self.storage_manager.load_events()
                for r in records:
                    if r.get("event_id") == str(event_id):
                        return r

            raise HTTPException(status_code=404, detail="Evento não encontrado")

        # ── 4. Reprodução de Evidências: Vídeo MP4 & Frame JPG ───────────────
        @app.get("/events/{event_id}/frame")
        def get_event_frame(event_id: str):
            """Serve o frame representativo (.jpg) do evento."""
            frame_file = self._find_event_file(event_id, "frame.jpg")
            if not frame_file or not frame_file.exists():
                raise HTTPException(status_code=404, detail="Frame do evento não encontrado")
            return FileResponse(frame_file, media_type="image/jpeg")

        @app.get("/events/{event_id}/video")
        def get_event_video(event_id: str, request: Request):
            """Serve o vídeo da evidência em MP4 com suporte a HTTP Range (Seeking no player)."""
            video_file = self._find_event_file(event_id, "event.mp4")
            if not video_file or not video_file.exists():
                # Tenta .avi como fallback para eventos antigos
                video_file = self._find_event_file(event_id, "event.avi")

            if not video_file or not video_file.exists():
                raise HTTPException(status_code=404, detail="Vídeo de evidência não encontrado")

            return self._stream_video_range(video_file, request)

    def _find_event_file(self, event_id: str, filename: str) -> Optional[Path]:
        """Localiza arquivo de evidência dentro do diretório de eventos correspondente."""
        if not self.events_dir.exists():
            return None

        # Procura pastas que terminem com _event_id ou coincidam
        for p in self.events_dir.iterdir():
            if p.is_dir() and (p.name.endswith(f"_{event_id}") or p.name == event_id):
                target = p / filename
                if target.exists():
                    return target

        # Busca recursiva ampla por fallback
        for f in self.events_dir.rglob(filename):
            if f.parent.name.endswith(f"_{event_id}") or f.parent.name == event_id:
                return f
        return None

    def _generate_mjpeg_stream(self, draw_overlays: bool = True):
        """Gera o stream contínuo de frames JPEG para a rota /stream."""
        while True:
            if not self.shared_state:
                time.sleep(0.05)
                continue

            frame, ai_meta = self.shared_state.get_display_frame()
            if frame is None:
                time.sleep(0.02)
                continue

            if draw_overlays and self.processor and ai_meta.get("ready"):
                frame = self.processor._draw_overlays(
                    frame,
                    ai_meta.get("detections", []),
                    ai_meta.get("ucf_score"),
                    ai_meta.get("is_anomalous", False),
                    ai_meta.get("yolo_ms", 0.0),
                    ai_meta.get("ucf_ms", 0.0),
                )

            success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not success:
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
            )
            time.sleep(0.03)  # ~30 FPS

    def _stream_video_range(self, path: Path, request: Request) -> Response:
        """Manipulador com suporte a HTTP 206 Partial Content para streaming perfeito de MP4."""
        file_size = path.stat().st_size
        range_header = request.headers.get("range")

        content_type = "video/mp4" if path.suffix.lower() == ".mp4" else "video/x-msvideo"

        if not range_header:
            return FileResponse(path, media_type=content_type)

        range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if not range_match:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        start = int(range_match.group(1))
        end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        def iter_chunks():
            with open(path, "rb") as f:
                f.seek(start)
                remaining = length
                chunk_size = 1024 * 1024  # 1MB
                while remaining > 0:
                    read_len = min(chunk_size, remaining)
                    chunk = f.read(read_len)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": content_type,
        }
        return StreamingResponse(iter_chunks(), status_code=206, headers=headers)
