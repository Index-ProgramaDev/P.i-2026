import { useEffect, useRef } from "react";
import { api } from "../api";

export function useAlertSocket({ user, onAnomaly, onAlert }) {
  const cbRef = useRef({ onAnomaly, onAlert });
  const wsRef = useRef(null);

  useEffect(() => {
    cbRef.current = { onAnomaly, onAlert };
  });

  useEffect(() => {
    let closed = false;
    let retryTimer = null;

    const connect = () => {
      try {
        const ws = new WebSocket(api.getWsUrl());

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type !== "ALERT") return;

            if (data.kind === "ANOMALY_CONFIRMED") {
              if (data.user_id != null && user?.id != null && data.user_id !== user.id) return;
              cbRef.current.onAnomaly?.({
                id: data.id,
                user_id: data.user_id,
                kind: data.kind,
                timestamp: data.timestamp,
                score: data.score,
                detections: Array.isArray(data.detections_list) && data.detections_list.length
                  ? data.detections_list
                  : data.detections || [],
                detections_list: data.detections_list || [],
                camera_uid: data.camera_uid,
              });
            }

            cbRef.current.onAlert?.(data);
          } catch (err) {
            console.error("Erro ao processar mensagem WebSocket:", err);
          }
        };

        ws.onerror = (error) => console.error("Erro WebSocket:", error);
        ws.onclose = (event) => {
          if (closed) return;
          if (event.code === 4401) return;
          retryTimer = setTimeout(connect, 5000);
        };
        wsRef.current = ws;
      } catch (err) {
        console.error("Erro ao conectar WebSocket:", err);
      }
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
