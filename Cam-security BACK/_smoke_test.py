"""Smoke test do contrato frontend<->backend (porta 8001, sem pipeline de captura)."""
import asyncio
import json
import sys
import threading
import time
import urllib.request
import urllib.error
from urllib.parse import urlencode

sys.path.insert(0, ".")
import yaml
import uvicorn
from server import CamSecurityServer
from database import NeonDatabase

BASE = "http://127.0.0.1:8001"
PASS, FAIL = "PASS", "FAIL"
results = []


def check(name, ok, extra=""):
    results.append((name, ok, extra))
    print(f"[{PASS if ok else FAIL}] {name} {extra}")


def req(method, path, body=None, params=None, token=None):
    url = BASE + path
    if params:
        url += ("&" if "?" in url else "?") + urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def main():
    cfg = yaml.safe_load(open("config.yaml", encoding="utf-8"))
    db = NeonDatabase()
    check("db enabled", db.is_enabled())

    srv = CamSecurityServer(shared_state=None, processor=None,
                            storage_manager=None, db=db, config=cfg, camera=None)
    t = threading.Thread(
        target=uvicorn.run,
        args=(srv.app,),
        kwargs={"host": "127.0.0.1", "port": 8001, "log_level": "error"},
        daemon=True)
    t.start()
    time.sleep(2.5)

    ua = db.register_user("smoke_a", "smoke_a@test.dev", "Smoke@123")
    ub = db.register_user("smoke_b", "smoke_b@test.dev", "Smoke@123")
    check("seed users", bool(ua and ub), f"A={ua and ua['id']} B={ub and ub['id']}")
    if not (ua and ub):
        return
    db.register_camera("smoke_cam_a", "Smoke Cam A", "0", ua["id"])
    db.register_camera("smoke_cam_b", "Smoke Cam B", "0", ub["id"])
    ea = db.insert_event(event_id="SMK001", camera_uid="smoke_cam_a", user_id=ua["id"],
                         kind="ANOMALY_CONFIRMED", timestamp=time.time(), frame_seq=1,
                         ucf_score=0.91, detections="person(0.90)",
                         metadata={"status": "pendente",
                                   "detections": [{"class_name": "person", "confidence": 0.9,
                                                   "track_id": 7, "box": [10, 10, 100, 200]}]})
    eb = db.insert_event(event_id="SMK002", camera_uid="smoke_cam_b", user_id=ub["id"],
                         kind="ANOMALY_CONFIRMED", timestamp=time.time(), frame_seq=2,
                         ucf_score=0.88, detections="person(0.88)",
                         metadata={"status": "pendente"})
    check("seed events", bool(ea and eb), f"A={ea} B={eb}")

    st, h = req("GET", "/health")
    check("GET /health publico", st == 200 and h.get("status") == "online" and h.get("db") is True, str(h)[:80])

    st, lg = req("POST", "/auth/login", {"username_or_email": "smoke_a@test.dev", "password": "Smoke@123"})
    tok_a = (lg or {}).get("token")
    check("POST /auth/login retorna token", st == 200 and lg.get("success") and bool(tok_a), f"status={st}")

    st, lg = req("POST", "/auth/login", {"username_or_email": "smoke_b@test.dev", "password": "Smoke@123"})
    tok_b = (lg or {}).get("token")
    check("login user B", st == 200 and bool(tok_b), f"status={st}")

    st, lg = req("POST", "/auth/login", {"username_or_email": "smoke_a@test.dev", "password": "errada"})
    check("login senha errada -> 401", st == 401, f"status={st}")

    st, _ = req("POST", "/auth/register", {"username": "smoke_dup", "email": "smoke_a@test.dev", "password": "X@12345"})
    check("register email duplicado -> 400", st == 400, f"status={st}")

    st, _ = req("GET", "/events")
    check("GET /events anon -> 401", st == 401, f"status={st}")

    st, _ = req("GET", "/events", token="token.invalido.aqui")
    check("GET /events token invalido -> 401", st == 401, f"status={st}")

    st, _ = req("GET", "/cameras")
    check("GET /cameras anon -> 401", st == 401, f"status={st}")

    st, cams = req("GET", "/cameras", token=tok_a)
    check("GET /cameras user A", st == 200 and len(cams.get("cameras", [])) >= 1, f"n={len(cams.get('cameras', []))}")

    st, ev = req("GET", "/events", token=tok_a, params={"limit": 50})
    ids = [e["event_id"] for e in ev.get("items", [])]
    check("GET /events A ve so seus", st == 200 and "SMK001" in ids and "SMK002" not in ids, f"ids={ids[:5]}")

    st, ev = req("GET", "/events", token=tok_b, params={"limit": 50})
    ids = [e["event_id"] for e in ev.get("items", [])]
    check("GET /events B isolado", st == 200 and "SMK002" in ids and "SMK001" not in ids, f"ids={ids[:5]}")

    st, d = req("GET", "/events/SMK001", token=tok_a)
    check("GET /events/SMK001 dono -> 200", st == 200 and d.get("event_id") == "SMK001", f"status={st}")

    st, d = req("GET", "/events/SMK001", token=tok_b)
    check("GET /events/SMK001 outro user -> 403", st == 403, f"status={st}")

    st, d = req("GET", "/events/SMK001", token=tok_a, params={"user_id": ub["id"]})
    check("GET /events/SMK001 user_id alheio ignorado -> 200", st == 200, f"status={st}")

    st, d = req("GET", "/events/SMK001/frame", token=tok_a)
    check("GET frame dono -> nao-403 (404 sem arquivo ok)", st in (200, 404), f"status={st}")

    st, d = req("GET", "/events/SMK001/frame", token=tok_b)
    check("GET frame outro user -> 403", st == 403, f"status={st}")

    st, d = req("GET", "/events/SMK001/video", token=tok_a)
    check("GET video dono -> nao-403", st in (200, 206, 404), f"status={st}")

    st, r = req("POST", "/events/SMK001/review",
                {"decision": "confirmado", "operator": "smoke_a", "justification": "teste"}, token=tok_a)
    ok = st == 200 and r.get("success")
    meta = (r.get("event") or {}).get("metadata") or {}
    check("POST review dono -> 200 + status", ok and meta.get("status") == "confirmado", f"status={st} meta.status={meta.get('status')}")

    st, r = req("POST", "/events/SMK001/review",
                {"decision": "falso_positivo", "operator": "smoke_b"}, token=tok_b)
    check("POST review outro user -> 403", st == 403, f"status={st}")

    st, r = req("POST", "/events/confirm-anomaly?event_id=SMK002",
                {"decision": "falso_positivo", "operator": "smoke_b", "justification": "fp"}, token=tok_b)
    check("POST confirm-anomaly dono -> 200", st == 200 and r.get("success"), f"status={st}")

    st, r = req("POST", "/events/confirm-anomaly?event_id=SMK001",
                {"decision": "confirmado", "operator": "smoke_b"}, token=tok_b)
    check("POST confirm-anomaly em evento alheio -> 403", st == 403, f"status={st}")

    st, _ = req("POST", "/camera/switch", {"source": "0"})
    check("POST /camera/switch anon -> 401", st == 401, f"status={st}")
    st, _ = req("POST", "/camera/switch", {"source": "0"}, token=tok_a)
    check("POST /camera/switch auth -> nao-401 (500 sem camera ok)", st != 401, f"status={st}")

    st, _ = req("GET", "/status")
    check("GET /status anon -> 401", st == 401, f"status={st}")
    st, s = req("GET", "/status", token=tok_a)
    check("GET /status auth", st == 200 and "fps" in s, f"status={st}")

    st, _ = req("GET", "/evidencias/local")
    check("GET /evidencias/local anon -> 401", st == 401, f"status={st}")
    st, _ = req("GET", "/evidencias/local", token=tok_a)
    check("GET /evidencias/local nao-admin -> 403", st == 403, f"status={st}")

    st, _ = req("GET", "/docs")
    check("GET /docs desabilitado -> 404", st == 404, f"status={st}")

    async def ws_check(token):
        import websockets
        url = "ws://127.0.0.1:8001/ws/events" + (f"?token={token}" if token else "")
        try:
            async with websockets.connect(url, open_timeout=5) as ws:
                msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
                return msg.get("type")
        except Exception as ex:
            return f"ERR:{ex}"

    ok = asyncio.run(ws_check(tok_a))
    check("WS com token -> CONNECTED", ok == "CONNECTED", str(ok)[:60])

    ok = asyncio.run(ws_check(None))
    check("WS sem token -> rejeitado", ok != "CONNECTED", str(ok)[:60])

    st, _ = req("GET", "/events", token=tok_a)
    check("rate limit nao bloqueia uso normal", st == 200, f"status={st}")

    try:
        import psycopg
        with psycopg.connect(db.dsn, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM security_events WHERE event_id LIKE 'SMK%'")
                cur.execute("DELETE FROM cameras WHERE camera_uid LIKE 'smoke_%'")
                cur.execute("DELETE FROM users WHERE username LIKE 'smoke_%'")
        check("cleanup seed", True)
    except Exception as ex:
        check("cleanup seed", False, str(ex)[:80])

    fails = [r for r in results if not r[1]]
    print(f"\n=== {len(results) - len(fails)}/{len(results)} PASS ===")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
