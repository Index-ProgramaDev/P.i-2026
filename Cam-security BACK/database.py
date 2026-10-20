"""Gerenciador e cliente do banco de dados Neon (PostgreSQL).

Suporta inicialização automática da tabela de eventos de segurança,
inserção de eventos em tempo de execução e consultas filtradas para a API REST.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

logger = logging.getLogger("camsecurity.database")


class NeonDatabase:
    """Cliente para persistência de eventos no PostgreSQL Neon."""

    def __init__(self, dsn: Optional[str] = None):
        load_dotenv()
        self.dsn = dsn or os.getenv("Neon_KEY") or os.getenv("DATABASE_URL")
        self._enabled = bool(self.dsn)
        if not self._enabled:
            logger.warning("Neon_KEY não configurada no ambiente. Persistência em banco desativada.")
        else:
            self._init_schema()

    def is_enabled(self) -> bool:
        return self._enabled

    def _get_connection(self):
        """Retorna nova conexão com autocommit e row_factory como dict."""
        return psycopg.connect(self.dsn, autocommit=True, row_factory=dict_row)

    def _init_schema(self) -> None:
        """Garante a existência da tabela de eventos."""
        ddl = """
        CREATE TABLE IF NOT EXISTS security_events (
            id SERIAL PRIMARY KEY,
            event_id VARCHAR(32) NOT NULL,
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

        CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_security_events_kind ON security_events (kind);
        CREATE INDEX IF NOT EXISTS idx_security_events_event_id ON security_events (event_id);
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(ddl)
            logger.info("Tabela security_events verificada/inicializada no Neon.")
        except Exception as e:
            logger.error("Falha ao inicializar schema no Neon: %s", e)
            self._enabled = False

    def insert_event(
        self,
        event_id: str,
        kind: str,
        timestamp: float,
        frame_seq: int,
        ucf_score: Optional[float],
        detections: str,
        frame_path: Optional[str] = None,
        video_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[int]:
        """Insere um novo evento e retorna o ID gerado."""
        if not self._enabled:
            return None

        sql = """
        INSERT INTO security_events (
            event_id, kind, timestamp, frame_seq, ucf_score, detections,
            frame_path, video_path, metadata
        ) VALUES (
            %(event_id)s, %(kind)s, %(timestamp)s, %(frame_seq)s, %(ucf_score)s, %(detections)s,
            %(frame_path)s, %(video_path)s, %(metadata)s
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
                    new_id = row["id"] if row else None
                    logger.info("Evento %s persistido no Neon com ID %s", event_id, new_id)
                    return new_id
        except Exception as e:
            logger.error("Erro ao inserir evento %s no Neon: %s", event_id, e)
            return None

    def update_video_path(self, event_id: str, video_path: str) -> bool:
        """Atualiza o caminho do vídeo no registro do evento."""
        if not self._enabled:
            return False

        sql = "UPDATE security_events SET video_path = %(video_path)s WHERE event_id = %(event_id)s"
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, {"video_path": video_path, "event_id": event_id})
                    logger.info("Video path do evento %s atualizado no Neon para %s", event_id, video_path)
                    return True
        except Exception as e:
            logger.error("Erro ao atualizar video_path do evento %s no Neon: %s", event_id, e)
            return False

    def list_events(
        self,
        kind: Optional[str] = None,
        min_score: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Lista eventos gravados com paginação e filtros opcionais."""
        if not self._enabled:
            return []

        conditions = ["1=1"]
        params: Dict[str, Any] = {"limit": limit, "offset": offset}

        if kind:
            conditions.append("kind = %(kind)s")
            params["kind"] = kind
        if min_score is not None:
            conditions.append("ucf_score >= %(min_score)s")
            params["min_score"] = float(min_score)

        sql = f"""
        SELECT id, event_id, kind, timestamp, created_at, frame_seq,
               ucf_score, detections, frame_path, video_path, metadata
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
                    # Converte datetime para ISO string para JSON serializable
                    for r in rows:
                        if isinstance(r.get("created_at"), datetime):
                            r["created_at"] = r["created_at"].isoformat()
                    return rows
        except Exception as e:
            logger.error("Erro ao consultar eventos no Neon: %s", e)
            return []

    def get_event_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Obtém um evento específico por event_id ou id numérico."""
        if not self._enabled:
            return None

        sql = """
        SELECT id, event_id, kind, timestamp, created_at, frame_seq,
               ucf_score, detections, frame_path, video_path, metadata
        FROM security_events
        WHERE event_id = %(id_str)s OR CAST(id AS TEXT) = %(id_str)s
        ORDER BY id DESC
        LIMIT 1;
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
            logger.error("Erro ao buscar evento %s no Neon: %s", event_id, e)
            return None

    def clear_all_events(self) -> int:
        """Limpa todos os eventos da tabela (usado por scripts de limpeza)."""
        if not self._enabled:
            return 0
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("TRUNCATE TABLE security_events RESTART IDENTITY;")
            logger.info("Tabela security_events truncada no Neon.")
            return 1
        except Exception as e:
            logger.error("Erro ao limpar security_events no Neon: %s", e)
            return 0
