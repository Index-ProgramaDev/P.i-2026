import hashlib
import json
import logging
import os
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

logger = logging.getLogger("camsecurity.database")


class NeonDatabase:
    """Cliente Neon PostgreSQL para eventos, câmeras e autenticação multiusuário."""

    _schema_initialized = False

    def __init__(self, dsn: Optional[str] = None):
        load_dotenv()
        self.dsn = dsn or os.getenv("Neon_KEY") or os.getenv("DATABASE_URL")
        self._enabled = bool(self.dsn)
        if not self._enabled:
            logger.warning("Neon_KEY não configurada. Operando sem banco remoto.")
        elif not NeonDatabase._schema_initialized:
            self._init_schema()
            NeonDatabase._schema_initialized = True

    def is_enabled(self) -> bool:
        return self._enabled

    def _get_connection(self):
        return psycopg.connect(self.dsn, autocommit=True, row_factory=dict_row, connect_timeout=10)

    def _init_schema(self) -> None:
        """Cria e atualiza o schema de usuários, câmeras e eventos no Neon."""
        ddl = """
        -- Tabela de usuários para isolamento multiusuário
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(64) UNIQUE NOT NULL,
            email VARCHAR(128) UNIQUE NOT NULL,
            password_hash VARCHAR(128) NOT NULL,
            salt VARCHAR(64) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Câmeras registradas pertencentes a usuários (suporte multi-câmera)
        CREATE TABLE IF NOT EXISTS cameras (
            id SERIAL PRIMARY KEY,
            camera_uid VARCHAR(64) UNIQUE NOT NULL,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(128) NOT NULL,
            source VARCHAR(256) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Eventos de segurança vinculados a câmera e usuário
        CREATE TABLE IF NOT EXISTS security_events (
            id SERIAL PRIMARY KEY,
            event_id VARCHAR(32) NOT NULL,
            camera_uid VARCHAR(64) DEFAULT 'cam_default',
            user_id INT REFERENCES users(id) ON DELETE SET NULL,
            kind VARCHAR(32) NOT NULL,
            timestamp DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            frame_seq INT NOT NULL,
            ucf_score DOUBLE PRECISION,
            detections TEXT,
            frame_path TEXT,
            video_path TEXT,
            metadata JSONB DEFAULT '{}'::jsonb
        );

        -- Migrações incrementais caso a tabela security_events já exista
        ALTER TABLE security_events ADD COLUMN IF NOT EXISTS camera_uid VARCHAR(64) DEFAULT 'cam_default';
        ALTER TABLE security_events ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_security_events_cam_user ON security_events (camera_uid, user_id);
        CREATE INDEX IF NOT EXISTS idx_cameras_user ON cameras (user_id);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(ddl)
        except Exception as e:
            logger.error("Falha ao inicializar schema Neon: %s", e)
            self._enabled = False

    # ── Módulo de Usuários e Autenticação ────────────────────────────────────

    @staticmethod
    def _hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
        salt = salt or secrets.token_hex(16)
        pw_hash = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return pw_hash, salt

    def register_user(self, username: str, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Registra novo usuário com hash SHA-256 e salt seguro."""
        if not self._enabled:
            return None
        pw_hash, salt = self._hash_password(password)
        sql = """
        INSERT INTO users (username, email, password_hash, salt)
        VALUES (%(username)s, %(email)s, %(pw_hash)s, %(salt)s)
        RETURNING id, username, email, is_active, created_at;
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"username": username, "email": email, "pw_hash": pw_hash, "salt": salt})
                    row = cur.fetchone()
                    if row and isinstance(row.get("created_at"), datetime):
                        row["created_at"] = row["created_at"].isoformat()
                    return row
        except Exception as e:
            logger.error("Falha ao registrar usuário %s: %s", username, e)
            return None

    def authenticate_user(self, username_or_email: str, password: str) -> Optional[Dict[str, Any]]:
        """Autentica usuário verificando salt e hash de senha."""
        if not self._enabled:
            return None
        sql = "SELECT * FROM users WHERE username = %(key)s OR email = %(key)s LIMIT 1;"
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"key": username_or_email})
                    u = cur.fetchone()
                    if not u or not u.get("is_active"):
                        return None
                    expected_hash, _ = self._hash_password(password, u["salt"])
                    if expected_hash == u["password_hash"]:
                        return {
                            "id": u["id"],
                            "username": u["username"],
                            "email": u["email"],
                            "created_at": u["created_at"].isoformat() if isinstance(u.get("created_at"), datetime) else None,
                        }
                    return None
        except Exception as e:
            logger.error("Erro na autenticação: %s", e)
            return None

    # ── Módulo de Câmeras (Multi-Camera Isoladas por Usuário) ─────────────────

    def register_camera(self, camera_uid: str, name: str, source: str, user_id: int) -> Optional[int]:
        """Vincula uma nova câmera a um usuário para isolamento de stream e alertas."""
        if not self._enabled:
            return None
        sql = """
        INSERT INTO cameras (camera_uid, user_id, name, source)
        VALUES (%(uid)s, %(user_id)s, %(name)s, %(source)s)
        ON CONFLICT (camera_uid) DO UPDATE SET name = EXCLUDED.name, source = EXCLUDED.source, last_ping = NOW()
        RETURNING id;
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"uid": camera_uid, "user_id": user_id, "name": name, "source": source})
                    row = cur.fetchone()
                    return row["id"] if row else None
        except Exception as e:
            logger.error("Erro ao registrar câmera: %s", e)
            return None

    def list_user_cameras(self, user_id: int) -> List[Dict[str, Any]]:
        """Lista apenas as câmeras pertencentes ao usuário autenticado."""
        if not self._enabled:
            return []
        sql = "SELECT id, camera_uid, name, source, is_active, last_ping, created_at FROM cameras WHERE user_id = %(user_id)s;"
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"user_id": user_id})
                    rows = cur.fetchall()
                    for r in rows:
                        for k in ("last_ping", "created_at"):
                            if isinstance(r.get(k), datetime):
                                r[k] = r[k].isoformat()
                    return rows
        except Exception as e:
            logger.error("Erro ao listar câmeras: %s", e)
            return []

    def delete_camera(self, camera_uid: str, user_id: int) -> bool:
        """Remove uma câmera vinculada ao usuário."""
        if not self._enabled:
            return False
        sql = "DELETE FROM cameras WHERE camera_uid = %(camera_uid)s AND user_id = %(user_id)s;"
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"camera_uid": str(camera_uid), "user_id": int(user_id)})
                    return cur.rowcount > 0
        except Exception as e:
            logger.error("Erro ao deletar câmera %s: %s", camera_uid, e)
            return False

    # ── Módulo de Eventos ───────────────────────────────────────────────────

    def insert_event(
        self,
        event_id: str,
        kind: str,
        timestamp: float,
        frame_seq: int,
        ucf_score: Optional[float],
        detections: str,
        camera_uid: str = "cam_default",
        user_id: Optional[int] = None,
        frame_path: Optional[str] = None,
        video_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[int]:
        if not self._enabled:
            return None

        sql = """
        INSERT INTO security_events (
            event_id, camera_uid, user_id, kind, timestamp, frame_seq,
            ucf_score, detections, frame_path, video_path, metadata
        ) VALUES (
            %(event_id)s, %(camera_uid)s, %(user_id)s, %(kind)s, %(timestamp)s, %(frame_seq)s,
            %(ucf_score)s, %(detections)s, %(frame_path)s, %(video_path)s, %(metadata)s
        )
        RETURNING id;
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        sql,
                        {
                            "event_id": event_id,
                            "camera_uid": camera_uid,
                            "user_id": user_id,
                            "kind": kind,
                            "timestamp": timestamp,
                            "frame_seq": frame_seq,
                            "ucf_score": float(ucf_score) if ucf_score is not None else None,
                            "detections": detections or "",
                            "frame_path": frame_path,
                            "video_path": video_path,
                            "metadata": json.dumps(metadata or {}),
                        },
                    )
                    row = cur.fetchone()
                    return row["id"] if row else None
        except Exception as e:
            logger.error("Erro ao inserir evento no Neon: %s", e)
            return None

    def update_video_path(self, event_id: str, video_path: str) -> bool:
        if not self._enabled:
            return False
        sql = "UPDATE security_events SET video_path = %(video_path)s WHERE event_id = %(event_id)s"
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"video_path": video_path, "event_id": event_id})
                    return True
        except Exception as e:
            logger.error("Erro ao atualizar video_path: %s", e)
            return False

    def list_events(
        self,
        camera_uid: Optional[str] = None,
        user_id: Optional[int] = None,
        kind: Optional[str] = None,
        min_score: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        if not self._enabled:
            return []

        conditions = ["1=1"]
        params: Dict[str, Any] = {"limit": limit, "offset": offset}

        if camera_uid:
            conditions.append("camera_uid = %(camera_uid)s")
            params["camera_uid"] = camera_uid
        if user_id is not None:
            conditions.append("user_id = %(user_id)s")
            params["user_id"] = user_id
        if kind:
            conditions.append("kind = %(kind)s")
            params["kind"] = kind
        if min_score is not None:
            conditions.append("ucf_score >= %(min_score)s")
            params["min_score"] = float(min_score)

        sql = f"""
        SELECT id, event_id, camera_uid, user_id, kind, timestamp, created_at,
               frame_seq, ucf_score, detections, frame_path, video_path, metadata
        FROM security_events
        WHERE {' AND '.join(conditions)}
        ORDER BY timestamp DESC
        LIMIT %(limit)s OFFSET %(offset)s;
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    for r in rows:
                        if isinstance(r.get("created_at"), datetime):
                            r["created_at"] = r["created_at"].isoformat()
                    return rows
        except Exception as e:
            logger.error("Erro ao listar eventos: %s", e)
            return []

    def get_event_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        if not self._enabled:
            return None
        sql = """
        SELECT id, event_id, camera_uid, user_id, kind, timestamp, created_at,
               frame_seq, ucf_score, detections, frame_path, video_path, metadata
        FROM security_events
        WHERE event_id = %(id_str)s OR CAST(id AS TEXT) = %(id_str)s
        ORDER BY id DESC LIMIT 1;
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"id_str": str(event_id)})
                    row = cur.fetchone()
                    if row and isinstance(row.get("created_at"), datetime):
                        row["created_at"] = row["created_at"].isoformat()
                    return row
        except Exception as e:
            logger.error("Erro ao buscar evento: %s", e)
            return None

    def review_event(
        self,
        event_id: str,
        decision: str,
        operator: str = "operador",
        justification: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Registra a decisão do operador (confirmar, investigar, falso_positivo) no metadata do evento."""
        if not self._enabled:
            return None
        ev = self.get_event_by_id(event_id)
        if not ev:
            return None
        
        meta = ev.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        
        history = meta.get("review_history", [])
        entry = {
            "decision": decision,
            "operator": operator,
            "justification": justification,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        history.append(entry)
        meta["status"] = decision
        meta["last_decision"] = decision
        meta["last_reviewed_at"] = entry["timestamp"]
        meta["review_history"] = history

        sql = """
        UPDATE security_events
        SET metadata = %(metadata)s
        WHERE event_id = %(event_id)s OR CAST(id AS TEXT) = %(event_id)s
        RETURNING id, event_id, camera_uid, user_id, kind, timestamp, created_at,
                  frame_seq, ucf_score, detections, frame_path, video_path, metadata;
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"metadata": json.dumps(meta), "event_id": str(event_id)})
                    row = cur.fetchone()
                    if row and isinstance(row.get("created_at"), datetime):
                        row["created_at"] = row["created_at"].isoformat()
                    return row
        except Exception as e:
            logger.error("Erro ao revisar evento %s: %s", event_id, e)
            return None

    def clear_all_events(self) -> int:
        if not self._enabled:
            return 0
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("TRUNCATE TABLE security_events RESTART IDENTITY;")
            return 1
        except Exception as e:
            logger.error("Erro ao truncar eventos: %s", e)
            return 0

