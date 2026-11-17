import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, List, Optional, Set
import cv2
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from auth import create_token, verify_token

logger = logging.getLogger("camsecurity.server")

ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.getenv("CAMSEC_ADMIN_EMAILS", "fbi@gmail.com").split(",")
    if e.strip()
}


def _is_admin(email: Optional[str]) -> bool:
    return bool(email) and email.strip().lower() in ADMIN_EMAILS


class _RateLimiter:
    def __init__(self):
        self._hits: dict = {}

    def check(self, key: str, limit: int, window_sec: float) -> bool:
        now = time.time()
        hits = [t for t in self._hits.get(key, []) if now - t < window_sec]
        if len(hits) >= limit:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        return True


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
    user_id: Optional[int] = None


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
        self._event_subscribers: List[dict] = []
        self._rate_limiter = _RateLimiter()

        docs_enabled = os.getenv("CAMSEC_ENABLE_DOCS") == "1"
        self.app = FastAPI(
            title="Cam-Security AI Backend",
            version="2.0.0",
            docs_url="/docs" if docs_enabled else None,
            redoc_url="/redoc" if docs_enabled else None,
            openapi_url="/openapi.json" if docs_enabled else None,
        )
        self._setup_cors()
        self._setup_routes()

    def _auth_user(self, request: Request) -> dict:
        token = None
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
        if not token:
            token = request.query_params.get("token")
        user = verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Não autenticado")
        user["is_admin"] = _is_admin(user.get("email"))
        return user

    def _require_user(self, request: Request) -> dict:
        return self._auth_user(request)

    def _check_event_access(self, ev: dict, user: dict) -> bool:
        if user.get("is_admin"):
            return True
        return ev.get("user_id") is not None and ev.get("user_id") == user.get("id")

    def _event_visible_to(self, event_data: dict, user: dict) -> bool:
        if user.get("is_admin"):
            return True
        uid = event_data.get("user_id")
        return uid is not None and uid == user.get("id")

    def _setup_cors(self):
        origins_env = os.getenv("CAMSEC_CORS_ORIGINS", "")
        if origins_env.strip():
            self.app.add_middleware(
                CORSMiddleware,
                allow_origins=[o.strip() for o in origins_env.split(",") if o.strip()],
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )
        else:
            self.app.add_middleware(
                CORSMiddleware,
                allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$",
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )

    def broadcast_event(self, event_data: dict):
        for sub in list(self._event_subscribers):
            try:
                if self._event_visible_to(event_data, sub["user"]):
                    sub["q"].put_nowait(event_data)
            except Exception:
                pass

    def _setup_routes(self):
        app = self.app
        require_user = Depends(self._require_user)

        @app.get("/health")
        def health_check():
            return {"status": "online", "timestamp": time.time(), "db": bool(self.db and self.db.is_enabled())}

        @app.get("/status", dependencies=[require_user])
        def system_status():
            stats = self.shared_state.get_fps_stats() if self.shared_state else {}
            latest_ai = self.shared_state._ai_meta if self.shared_state else {}
            return {"fps": stats, "ai_state": latest_ai, "clients": len(self._ws_connections)}

        @app.post("/auth/register")
        def register_user(req: UserRegisterRequest, request: Request):
            client = request.client.host if request.client else "unknown"
            if not self._rate_limiter.check(f"register:{client}", limit=5, window_sec=3600):
                raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente mais tarde.")
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            u = self.db.register_user(req.username, req.email, req.password)
            if not u:
                raise HTTPException(status_code=400, detail="Usuário ou email já cadastrado")
            return {"success": True, "user": u, "token": create_token(u)}

        @app.post("/auth/login")
        def login_user(req: UserLoginRequest, request: Request):
            client = request.client.host if request.client else "unknown"
            if not self._rate_limiter.check(f"login:{client}:{req.username_or_email.lower()}", limit=10, window_sec=300):
                raise HTTPException(status_code=429, detail="Muitas tentativas de login. Aguarde alguns minutos.")
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            u = self.db.authenticate_user(req.username_or_email, req.password)
            if not u:
                raise HTTPException(status_code=401, detail="Credenciais inválidas")
            return {"success": True, "user": u, "token": create_token(u)}

        @app.post("/cameras")
        def register_camera(req: CameraRegisterRequest, user: dict = Depends(self._require_user)):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            owner_id = req.user_id if (user.get("is_admin") and req.user_id) else user["id"]
            cid = self.db.register_camera(req.camera_uid, req.name, req.source, owner_id)
            if not cid:
                raise HTTPException(status_code=400, detail="Falha ao vincular câmera")
            return {"success": True, "camera_id": cid}

        @app.get("/cameras")
        def list_cameras(user_id: Optional[int] = None, user: dict = Depends(self._require_user)):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            target = user_id if (user.get("is_admin") and user_id) else user["id"]
            return {"cameras": self.db.list_user_cameras(target)}

        @app.delete("/cameras/{camera_uid}")
        def delete_camera(camera_uid: str, user_id: Optional[int] = None, user: dict = Depends(self._require_user)):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")
            target = user_id if (user.get("is_admin") and user_id) else user["id"]
            success = self.db.delete_camera(camera_uid, target)
            if not success:
                raise HTTPException(status_code=404, detail="Câmera não encontrada ou sem permissão")
            return {"success": True, "message": "Câmera removida com sucesso"}

        @app.get("/camera/status", dependencies=[require_user])
        def camera_status():
            if not self.camera:
                return {"status": "indisponível", "source": "desconhecido"}
            return {"status": "ok", **self.camera.get_status()}

        @app.post("/camera/switch", dependencies=[require_user])
        def switch_camera(req: CameraSwitchRequest):
            if not self.camera:
                raise HTTPException(status_code=500, detail="Módulo de câmera não injetado no servidor")
            success = self.camera.switch_source(req.source)
            if not success:
                raise HTTPException(status_code=400, detail=f"Não foi possível abrir a fonte: {req.source}")
            return {"success": True, "source": req.source}

        @app.get("/stream", dependencies=[require_user])
        def video_stream(request: Request, overlays: bool = True):
            return StreamingResponse(
                self._generate_mjpeg_stream(draw_overlays=overlays),
                media_type="multipart/x-mixed-replace; boundary=frame",
            )

        @app.websocket("/ws/events")
        async def websocket_events(websocket: WebSocket):
            user = verify_token(websocket.query_params.get("token"))
            if not user:
                await websocket.close(code=4401)
                return
            user["is_admin"] = _is_admin(user.get("email"))
            await websocket.accept()
            self._ws_connections.add(websocket)
            q = asyncio.Queue()
            self._event_subscribers.append({"q": q, "user": user})

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
                self._event_subscribers = [s for s in self._event_subscribers if s["q"] is not q]

        @app.get("/events/sse")
        async def sse_events(request: Request, user: dict = Depends(self._require_user)):
            async def event_generator() -> AsyncGenerator[str, None]:
                q = asyncio.Queue()
                self._event_subscribers.append({"q": q, "user": user})
                try:
                    yield "event: connected\ndata: {\"status\": \"ok\"}\n\n"
                    while True:
                        try:
                            item = await asyncio.wait_for(q.get(), timeout=15.0)
                            yield f"event: alert\ndata: {json.dumps(item)}\n\n"
                        except asyncio.TimeoutError:
                            yield f": ping {time.time()}\n\n"
                finally:
                    self._event_subscribers = [s for s in self._event_subscribers if s["q"] is not q]

            return StreamingResponse(event_generator(), media_type="text/event-stream")

        @app.get("/events")
        def list_events(
            camera_uid: Optional[str] = None,
            user_id: Optional[int] = None,
            kind: Optional[str] = None,
            min_score: Optional[float] = None,
            limit: int = Query(50, ge=1, le=200),
            offset: int = Query(0, ge=0),
            user: dict = Depends(self._require_user),
        ):
            if not self.db or not self.db.is_enabled():
                return {"total": 0, "items": []}

            if user.get("is_admin"):
                filter_user_id = user_id if (user_id and user_id != user["id"]) else None
            else:
                filter_user_id = user["id"]

            events = self.db.list_events(
                camera_uid=camera_uid,
                user_id=filter_user_id,
                kind=kind,
                min_score=min_score,
                limit=limit,
                offset=offset,
            )
            return {"total": len(events), "items": events}

        @app.get("/events/{event_id}")
        def get_event(event_id: str, user: dict = Depends(self._require_user)):
            if self.db and self.db.is_enabled():
                ev = self.db.get_event_by_id(event_id)
                if ev:
                    if self._check_event_access(ev, user):
                        return ev
                    raise HTTPException(status_code=403, detail="Sem permissão para acessar este evento")
            raise HTTPException(status_code=404, detail="Evento não encontrado")

        @app.post("/events/{event_id}/review")
        def review_event_endpoint(
            event_id: str,
            req: ReviewEventRequest,
            user: dict = Depends(self._require_user),
        ):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")

            ev = self.db.get_event_by_id(event_id)
            if not ev:
                raise HTTPException(status_code=404, detail="Evento não encontrado")
            if not self._check_event_access(ev, user):
                raise HTTPException(status_code=403, detail="Sem permissão para revisar este evento")

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
        def confirm_anomaly_from_operator(
            req: ReviewEventRequest,
            event_id: Optional[str] = None,
            user: dict = Depends(self._require_user),
        ):
            if not self.db or not self.db.is_enabled():
                raise HTTPException(status_code=503, detail="Banco Neon indisponível")

            if not event_id:
                raise HTTPException(status_code=400, detail="event_id obrigatório")

            ev = self.db.get_event_by_id(event_id)
            if not ev:
                raise HTTPException(status_code=404, detail="Evento não encontrado")
            if not self._check_event_access(ev, user):
                raise HTTPException(status_code=403, detail="Sem permissão para confirmar este evento")

            updated = self.db.review_event(
                event_id=event_id,
                decision=req.decision,
                operator=req.operator,
                justification=req.justification,
            )

            return {"success": True, "event_id": event_id, "event": updated}

        @app.get("/events/{event_id}/frame")
        def get_event_frame(event_id: str, user: dict = Depends(self._require_user)):
            if self.db and self.db.is_enabled():
                ev = self.db.get_event_by_id(event_id)
                if ev and not self._check_event_access(ev, user):
                    raise HTTPException(status_code=403, detail="Sem permissão para acessar este frame")

            frame_file = self._find_event_file(event_id, "frame.jpg")
            if not frame_file or not frame_file.exists():
                raise HTTPException(status_code=404, detail="Frame não encontrado")
            return FileResponse(frame_file, media_type="image/jpeg")

        @app.get("/events/{event_id}/video")
        def get_event_video(event_id: str, request: Request, user: dict = Depends(self._require_user)):
            if self.db and self.db.is_enabled():
                ev = self.db.get_event_by_id(event_id)
                if ev and not self._check_event_access(ev, user):
                    raise HTTPException(status_code=403, detail="Sem permissão para acessar este vídeo")

            video_file = self._find_event_file(event_id, "event.mp4")
            if not video_file or not video_file.exists():
                raise HTTPException(status_code=404, detail="Vídeo não encontrado")
            return self._stream_video_range(video_file, request)

        @app.get("/evidencias/local")
        def list_local_evidences(user: dict = Depends(self._require_user)):
            if not user.get("is_admin"):
                raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
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
