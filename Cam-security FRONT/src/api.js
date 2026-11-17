const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws") + "/ws/events";

let _token = null;

export function setAuthToken(token) {
  _token = token || null;
}

export function getAuthToken() {
  return _token;
}

export function clearAuthToken() {
  _token = null;
}

function authHeaders(hasBody = false) {
  const headers = {};
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

function requestHeaders(hasBody, auth) {
  const headers = auth ? authHeaders(hasBody) : {};
  if (hasBody && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  return headers;
}

function withToken(url) {
  if (!_token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(_token)}`;
}

async function req(path, { method = "GET", body = null, auth = true, raw = false } = {}) {
  const headers = requestHeaders(body != null, auth);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) {
      window.dispatchEvent(new Event("camsec:unauthorized"));
    }
    const err = new Error(data.detail || `Erro na requisição (código ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  baseUrl: API_BASE,

  getWsUrl() {
    return withToken(WS_BASE);
  },

  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch (e) {
      return { status: "offline", db: false, error: e.message };
    }
  },

  async login(username_or_email, password) {
    return req("/auth/login", {
      method: "POST",
      body: { username_or_email, password },
      auth: false,
    });
  },

  async register(username, email, password) {
    return req("/auth/register", {
      method: "POST",
      body: { username, email, password },
      auth: false,
    });
  },

  async getCameras() {
    return req("/cameras");
  },

  async registerCamera(camera_uid, name, source, user_id = null) {
    return req("/cameras", {
      method: "POST",
      body: { camera_uid, name, source, user_id },
    });
  },

  async deleteCamera(camera_uid, user_id = null) {
    const qs = user_id ? `?user_id=${user_id}` : "";
    return req(`/cameras/${camera_uid}${qs}`, { method: "DELETE" });
  },

  async getCameraStatus() {
    return req("/camera/status");
  },

  async switchCamera(source) {
    return req("/camera/switch", { method: "POST", body: { source } });
  },

  async getEvents({ minScore = 0.0, limit = 50, offset = 0, kind = null, camera_uid = null, user_id = null } = {}) {
    let url = `/events?limit=${limit}&offset=${offset}`;
    if (minScore > 0) url += `&min_score=${minScore}`;
    if (kind) url += `&kind=${encodeURIComponent(kind)}`;
    if (camera_uid) url += `&camera_uid=${encodeURIComponent(camera_uid)}`;
    if (user_id) url += `&user_id=${user_id}`;
    try {
      return await req(url);
    } catch {
      return { total: 0, items: [] };
    }
  },

  async getEventById(eventId) {
    return req(`/events/${eventId}`);
  },

  async reviewEvent(eventId, { decision, operator = "operador", justification = "" } = {}) {
    return req(`/events/${eventId}/review`, {
      method: "POST",
      body: { decision, operator, justification },
    });
  },

  async confirmAnomalyFromOperator({ decision, operator = "operador", justification = "", event_id } = {}) {
    if (!event_id) {
      throw new Error("event_id é obrigatório");
    }
    return req(`/events/confirm-anomaly?event_id=${encodeURIComponent(event_id)}`, {
      method: "POST",
      body: { decision, operator, justification },
    });
  },

  getStreamUrl(overlays = true) {
    return withToken(`${API_BASE}/stream?overlays=${overlays}`);
  },

  getEventFrameUrl(eventId) {
    return withToken(`${API_BASE}/events/${eventId}/frame`);
  },

  getEventVideoUrl(eventId) {
    return withToken(`${API_BASE}/events/${eventId}/video`);
  },
};
