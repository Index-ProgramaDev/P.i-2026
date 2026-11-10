import asyncio
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional, Set
import cv2
from fastapi import FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger("camsecurity.server")


class UserLoginRequest(BaseModel):
    username_or_email: str
    password: str


class UserRegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class CameraRegisterRequest(BaseModel):
    camera_uid: str
    name: str
    source: str
    user_id: int


class CameraSwitchRequest(BaseModel):
    source: str


class ReviewEventRequest(BaseModel):
    decision: str
    operator: str = "operador"
    justification: str = ""


class CamSecurityServer:
    """Servidor FastAPI: Streaming MJPEG, Alertas WebSockets/SSE e endpoints REST."""

    def __init__(self, shared_state=None, processor=None, storage_manager=None, db=None, config=None, camera=None):
        self.shared_state = shared_state
        self.processor = processor
        self.storage_manager = storage_manager
        self.db = db
        self.config = config or {}
        self.camera = camera

        self.storage_root = Path(self.config.get("storage", {}).get("root", "storage"))
        self.events_dir = self.storage_root / "events"

        self._ws_connections: Set[WebSocket] = set()
        self._event_subscribers: List[asyncio.Queue] = []

        self.app = FastAPI(title="Cam-Security AI Backend", version="2.0.0")
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
        for q in list(self._event_subscribers):
            try:
                q.put_nowait(event_data)
            except Exception:
                pass

    def _setup_routes(self):
        app = self.app

        @app.get("/health")
        def health_check():
            return {"status": "online", "timestamp": time.time(), "db": bool(self.db and self.db.is_enabled())}

        @app.get("/status")
        def system_status():
            stats = self.shared_state.get_fps_stats() if self.shared_state else {}
            latest_ai = self.shared_state._ai_meta if self.shared_state else {}
            return {"fps": stats, "ai_state": latest_ai, "clients": len(self._ws_connections)}

        # ── Autenticação & Usuários ──────────────────────────────────────────
        @app.post("/auth/register")
        def register_user(req: UserRegisterRequest):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            u = self.db.register_user(req.username, req.email, req.password)
            if not u:
                raise HTTPException(status_code=400, detail="Usuário ou email já cadastrado")
            return {"success": True, "user": u}

        @app.post("/auth/login")
        def login_user(req: UserLoginRequest):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            u = self.db.authenticate_user(req.username_or_email, req.password)
            if not u:
                raise HTTPException(status_code=401, detail="Credenciais inválidas")
            return {"success": True, "user": u}

        # ── Câmeras (Multi-Camera Isoladas por Usuário) ───────────────────────
        @app.post("/cameras")
        def register_camera(req: CameraRegisterRequest):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            cid = self.db.register_camera(req.camera_uid, req.name, req.source, req.user_id)
            if not cid:
                raise HTTPException(status_code=400, detail="Falha ao vincular câmera")
            return {"success": True, "camera_id": cid}

        @app.get("/cameras")
        def list_cameras(user_id: int):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            return {"cameras": self.db.list_user_cameras(user_id)}

        @app.delete("/cameras/{camera_uid}")
        def delete_camera(camera_uid: str, user_id: int):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            success = self.db.delete_camera(camera_uid, user_id)
            if not success:
                raise HTTPException(status_code=404, detail="Câmera não encontrada ou sem permissão")
            return {"success": True, "message": "Câmera removida com sucesso"}

        @app.get("/camera/status")
        def camera_status():
            if not self.camera:
                return {"status": "indisponível", "source": "desconhecido"}
            return {"status": "ok", **self.camera.get_status()}

        @app.post("/camera/switch")
        def switch_camera(req: CameraSwitchRequest):
            if not self.camera:
                raise HTTPException(status_code=500, detail="Módulo de câmera não injetado no servidor")
            success = self.camera.switch_source(req.source)
            if not success:
                raise HTTPException(status_code=400, detail=f"Não foi possível abrir a fonte: {req.source}")
            return {"success": True, "source": req.source}

        # ── Streaming de Vídeo MJPEG ─────────────────────────────────────────
        @app.get("/stream")
        def video_stream(overlays: bool = True):
            return StreamingResponse(
                self._generate_mjpeg_stream(draw_overlays=overlays),
                media_type="multipart/x-mixed-replace; boundary=frame",
            )

        # ── Alertas em Tempo Real ────────────────────────────────────────────
        @app.websocket("/ws/events")
        async def websocket_events(websocket: WebSocket):
            await websocket.accept()
            self._ws_connections.add(websocket)
            q = asyncio.Queue()
            self._event_subscribers.append(q)

            try:
                await websocket.send_text(json.dumps({"type": "CONNECTED", "time": time.time()}))
                while True:
                    try:
                        ev = await asyncio.wait_for(q.get(), timeout=15.0)
                        await websocket.send_text(json.dumps(ev))
                    except asyncio.TimeoutError:
                        await websocket.send_text(json.dumps({"type": "PING", "time": time.time()}))
            except WebSocketDisconnect:
                pass
            finally:
                self._ws_connections.discard(websocket)
                if q in self._event_subscribers:
                    self._event_subscribers.remove(q)

        @app.get("/events/sse")
        async def sse_events():
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

        # ── Eventos REST & Evidências ────────────────────────────────────────
        @app.get("/events")
        def list_events(
            camera_uid: Optional[str] = None,
            user_id: Optional[int] = None,
            kind: Optional[str] = None,
            min_score: Optional[float] = None,
            limit: int = Query(50, ge=1, le=200),
            offset: int = Query(0, ge=0),
            requesting_user_email: Optional[str] = Query(None),
        ):
            if not self.db or not self.db.is_enabled():
                return {"total": 0, "items": []}
            
            # Se for ADMIN (FBI@gmail.com), vê todos os eventos
            is_admin = requesting_user_email and requesting_user_email.lower() == "fbi@gmail.com"
            
            # Se não for admin e não passou user_id, retorna vazio (segurança)
            if not is_admin and user_id is None:
                return {"total": 0, "items": []}
            
            # Admin vê tudo, usuários comuns só veem os seus
            filter_user_id = None if is_admin else user_id
            
            events = self.db.list_events(
                camera_uid=camera_uid, 
                user_id=filter_user_id, 
                kind=kind, 
                min_score=min_score, 
                limit=limit, 
                offset=offset
            )
            return {"total": len(events), "items": events}

        @app.get("/events/{event_id}")
        def get_event(event_id: str, requesting_user_email: Optional[str] = Query(None), user_id: Optional[int] = Query(None)):
            if self.db and self.db.is_enabled():
                ev = self.db.get_event_by_id(event_id)
                if ev:
                    # Verifica permissões
                    is_admin = requesting_user_email and requesting_user_email.lower() == "fbi@gmail.com"
                    is_owner = user_id and ev.get("user_id") == user_id
                    
                    if is_admin or is_owner or ev.get("user_id") is None:
                        return ev
                    else:
                        raise HTTPException(status_code=403, detail="Sem permissão para acessar este evento")
            raise HTTPException(status_code=404, detail="Evento não encontrado")

        @app.post("/events/{event_id}/review")
        def review_event_endpoint(event_id: str, req: ReviewEventRequest):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            
            # Se a decisão é confirmar, precisa salvar o evento primeiro
            if req.decision == "confirmado" and self.storage_manager:
                # Busca o último evento ANOMALY_CONFIRMED do buffer
                # Como não temos o evento completo, vamos apenas atualizar o metadata
                pass
            
            updated = self.db.review_event(
                event_id=event_id,
                decision=req.decision,
                operator=req.operator,
                justification=req.justification,
            )
            if not updated:
                raise HTTPException(status_code=404, detail="Falha ao atualizar revisão do evento")
            return {"success": True, "event": updated}

        @app.post("/events/confirm-anomaly")
        def confirm_anomaly_from_operator(req: ReviewEventRequest, event_id: Optional[str] = None):
            """Salva anomalia no banco APENAS quando operador confirmar."""
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            
            # Se não passou event_id, retorna erro
            if not event_id:
                raise HTTPException(status_code=400, detail="event_id obrigatório")
            
            # Busca o evento já existente (foi salvo pelo storage_manager)
            ev = self.db.get_event_by_id(event_id)
            if not ev:
                raise HTTPException(status_code=404, detail="Evento não encontrado")
            
            # Atualiza com a decisão do operador
            updated = self.db.review_event(
                event_id=event_id,
                decision=req.decision,
                operator=req.operator,
                justification=req.justification,
            )
            
            return {"success": True, "event_id": event_id, "event": updated}

        @app.get("/events/{event_id}/frame")
        def get_event_frame(event_id: str, requesting_user_email: Optional[str] = Query(None), user_id: Optional[int] = Query(None)):
            # Verifica permissões antes de retornar o frame
            if self.db and self.db.is_enabled():
                ev = self.db.get_event_by_id(event_id)
                if ev:
                    is_admin = requesting_user_email and requesting_user_email.lower() == "fbi@gmail.com"
                    is_owner = user_id and ev.get("user_id") == user_id
                    
                    if not (is_admin or is_owner or ev.get("user_id") is None):
                        raise HTTPException(status_code=403, detail="Sem permissão para acessar este frame")
            
            frame_file = self._find_event_file(event_id, "frame.jpg")
            if not frame_file or not frame_file.exists():
                raise HTTPException(status_code=404, detail="Frame não encontrado")
            return FileResponse(frame_file, media_type="image/jpeg")

        @app.get("/events/{event_id}/video")
        def get_event_video(event_id: str, request: Request, requesting_user_email: Optional[str] = Query(None), user_id: Optional[int] = Query(None)):
            # Verifica permissões antes de retornar o vídeo
            if self.db and self.db.is_enabled():
                ev = self.db.get_event_by_id(event_id)
                if ev:
                    is_admin = requesting_user_email and requesting_user_email.lower() == "fbi@gmail.com"
                    is_owner = user_id and ev.get("user_id") == user_id
                    
                    if not (is_admin or is_owner or ev.get("user_id") is None):
                        raise HTTPException(status_code=403, detail="Sem permissão para acessar este vídeo")
            
            video_file = self._find_event_file(event_id, "event.mp4")
            if not video_file or not video_file.exists():
                raise HTTPException(status_code=404, detail="Vídeo não encontrado")
            return self._stream_video_range(video_file, request)

        @app.get("/evidencias/local")
        def list_local_evidences():
            """Lista evidências salvas localmente em storage/events/"""
            if not self.storage_manager:
                return {"total": 0, "items": []}
            
            evidences = []
            events_dir = self.storage_root / "events"
            
            if events_dir.exists():
                for event_folder in sorted(events_dir.iterdir(), reverse=True):
                    if not event_folder.is_dir():
                        continue
                    
                    frame_path = event_folder / "frame.jpg"
                    video_path = event_folder / "event.mp4"
                    
                    evidences.append({
                        "id": event_folder.name,
                        "frame_exists": frame_path.exists(),
                        "video_exists": video_path.exists(),
                        "frame_size": frame_path.stat().st_size if frame_path.exists() else 0,
                        "video_size": video_path.stat().st_size if video_path.exists() else 0,
                        "created_at": datetime.fromtimestamp(event_folder.stat().st_mtime).isoformat(),
                    })
            
            return {"total": len(evidences), "items": evidences}

    def _find_event_file(self, event_id: str, filename: str) -> Optional[Path]:
        if not self.events_dir.exists():
            return None
        for p in self.events_dir.iterdir():
            if p.is_dir() and (p.name.endswith(f"_{event_id}") or p.name == event_id):
                target = p / filename
                if target.exists():
                    return target
        return None

    def _generate_mjpeg_stream(self, draw_overlays: bool = True):
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

            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
            time.sleep(0.03)

    def _stream_video_range(self, path: Path, request: Request) -> Response:
        file_size = path.stat().st_size
        range_header = request.headers.get("range")
        if not range_header:
            return FileResponse(path, media_type="video/mp4")

        range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if not range_match:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        start = int(range_match.group(1))
        end = min(int(range_match.group(2)) if range_match.group(2) else file_size - 1, file_size - 1)
        length = end - start + 1

        def iter_chunks():
            with open(path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    read_len = min(1024 * 1024, remaining)
                    chunk = f.read(read_len)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(iter_chunks(), status_code=206, headers=headers)
