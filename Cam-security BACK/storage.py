import logging
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
import cv2
import numpy as np

logger = logging.getLogger("camsecurity.storage")


class StorageManager:
    """Gerencia a gravação de frames e clipes MP4 de evidências e sincronização com Neon."""

    def __init__(self, config: dict):
        st = config.get("storage", {})
        vid = config.get("video", {})

        root = Path(st.get("root", "storage"))
        self._events_dir = root / "events"
        self._save_frames = bool(st.get("save_frames", True))
        self._jpeg_q = int(st.get("jpeg_quality", 85))
        self._event_count = 0

        self._pre_sec = float(vid.get("pre_event_seconds", 5))
        self._post_sec = float(vid.get("post_event_seconds", 15))
        self._vid_fps = float(vid.get("fps", 30))
        self._vid_codec = str(vid.get("codec", "avc1"))  # H.264 para compatibilidade
        self._vid_fmt = str(vid.get("format", "mp4")).lstrip(".")

        self._video_buffer = None
        self._lock = threading.Lock()

        try:
            from database import NeonDatabase
            self._db = NeonDatabase()
        except Exception:
            self._db = None

        self._events_dir.mkdir(parents=True, exist_ok=True)
        if self._events_dir.exists():
            self._event_count = sum(1 for p in self._events_dir.iterdir() if p.is_dir())

    def set_video_buffer(self, video_buffer) -> None:
        self._video_buffer = video_buffer

    def set_capture_fps(self, fps: float) -> None:
        if fps > 0 and fps != self._vid_fps:
            self._vid_fps = fps

    def save_event(self, event, camera_uid: Optional[str] = None, user_id: Optional[int] = None) -> Path:
        """Salva snapshot e agenda gravação do clipe de vídeo do evento.
        APENAS para eventos já revisados/confirmados.
        """
        from events import EventKind

        with self._lock:
            seq_str = f"{self._event_count + 1:04d}"
            event.event_id = seq_str  # ← Atualiza o ID no evento
            event.camera_uid = camera_uid or event.camera_uid or "cam_default"
            user_id = user_id if user_id is not None else event.user_id
            
            ts_str = datetime.fromtimestamp(time.time()).strftime("%Y-%m-%d_%H-%M-%S")
            event_dir = self._events_dir / f"{ts_str}_{seq_str}"
            event_dir.mkdir(parents=True, exist_ok=True)

            frame_rel = None
            if self._save_frames and event.frame is not None and isinstance(event.frame, np.ndarray) and event.frame.size > 0:
                fp = event_dir / "frame.jpg"
                cv2.imwrite(str(fp), event.frame, [cv2.IMWRITE_JPEG_QUALITY, self._jpeg_q])
                frame_rel = str(fp.relative_to(self._events_dir.parent))

            video_filename = f"event.{self._vid_fmt}"
            video_path = event_dir / video_filename
            video_rel = None

            if self._video_buffer and event.kind == EventKind.ANOMALY_CONFIRMED:
                self._video_buffer.start_recording(
                    duration_seconds=self._post_sec,
                    event_timestamp=event.timestamp,
                    pre_seconds=self._pre_sec,
                    on_done=self._on_recording_done,
                    metadata={"event_id": seq_str, "video_path": video_path},
                )
                video_rel = str(video_path.relative_to(self._events_dir.parent))

            # Persiste diretamente no Neon PostgreSQL
            if self._db and self._db.is_enabled():
                self._db.insert_event(
                    event_id=seq_str,
                    camera_uid=event.camera_uid,
                    user_id=user_id,
                    kind=event.kind.name,
                    timestamp=time.time(),
                    frame_seq=event.frame_seq,
                    ucf_score=event.ucf_score,
                    detections=event.yolo_summary,
                    frame_path=frame_rel,
                    video_path=video_rel,
                    metadata={"source": "camsecurity", "status": "pending", "awaiting_review": True},
                )

            self._event_count += 1
            return event_dir

    def _on_recording_done(self, pre: list, post: list, meta: dict) -> None:
        threading.Thread(
            target=self._write_video,
            args=(pre, post, meta.get("video_path"), meta.get("event_id")),
            daemon=True,
            name=f"rec-{meta.get('event_id')}",
        ).start()

    def _write_video(self, pre: list, post: list, output_path: Path, event_id: Optional[str]) -> None:
        frames = pre + post
        if not frames:
            return
        try:
            h, w = frames[0].frame.shape[:2]
            writer = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*self._vid_codec), self._vid_fps, (w, h))
            if not writer.isOpened():
                logger.error("Falha ao abrir VideoWriter para %s", output_path)
                return
            for bf in frames:
                writer.write(bf.frame)
            writer.release()

            video_rel = str(output_path.relative_to(self._events_dir.parent))
            logger.info("Evidência MP4 gravada: %s (%d frames)", output_path.name, len(frames))

            if event_id and self._db and self._db.is_enabled():
                self._db.update_video_path(event_id, video_rel)
        except Exception as e:
            logger.error("Erro ao gravar vídeo %s: %s", output_path, e)
