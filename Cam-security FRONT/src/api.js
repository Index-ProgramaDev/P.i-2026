const API_BASE = "http://127.0.0.1:8000";
const WS_BASE = "ws://127.0.0.1:8000/ws/events";

export const api = {
  baseUrl: API_BASE,
  wsUrl: WS_BASE,

  // Health
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch (e) {
      return { status: "offline", db: false, error: e.message };
    }
  },

  // Auth (com tratamento de HTTP 400/401/503 e extração de detail)
  async login(username_or_email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username_or_email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Erro na autenticação (código ${res.status})`);
    }
    return data;
  },

  async register(username, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Erro no cadastro (código ${res.status})`);
    }
    return data;
  },

  // Cameras
  async getCameras(userId) {
    const res = await fetch(`${API_BASE}/cameras?user_id=${userId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Falha ao carregar câmeras");
    }
    return res.json();
  },

  async registerCamera(camera_uid, name, source, user_id) {
    const res = await fetch(`${API_BASE}/cameras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ camera_uid, name, source, user_id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Falha ao vincular câmera");
    }
    return data;
  },

  async deleteCamera(camera_uid, user_id) {
    const res = await fetch(`${API_BASE}/cameras/${camera_uid}?user_id=${user_id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Falha ao remover câmera");
    }
    return data;
  },

  async getCameraStatus() {
    const res = await fetch(`${API_BASE}/camera/status`);
    return res.json();
  },

  async switchCamera(source) {
    const res = await fetch(`${API_BASE}/camera/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Falha ao alterar fonte");
    }
    return data;
  },

  // Events & Alerts
  async getEvents({ minScore = 0.0, limit = 50, offset = 0, kind = null, camera_uid = null, user_id = null, user_email = null } = {}) {
    let url = `${API_BASE}/events?limit=${limit}&offset=${offset}`;
    if (minScore > 0) url += `&min_score=${minScore}`;
    if (kind) url += `&kind=${encodeURIComponent(kind)}`;
    if (camera_uid) url += `&camera_uid=${encodeURIComponent(camera_uid)}`;
    if (user_id) url += `&user_id=${user_id}`;
    if (user_email) url += `&requesting_user_email=${encodeURIComponent(user_email)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { total: 0, items: [] };
    }
    return res.json();
  },

  async getEventById(eventId, user_id = null, user_email = null) {
    let url = `${API_BASE}/events/${eventId}`;
    const params = [];
    if (user_id) params.push(`user_id=${user_id}`);
    if (user_email) params.push(`requesting_user_email=${encodeURIComponent(user_email)}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Evento não encontrado");
    }
    return res.json();
  },

  async reviewEvent(eventId, { decision, operator = "operador", justification = "" }) {
    const res = await fetch(`${API_BASE}/events/${eventId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, operator, justification }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Falha ao salvar decisão");
    }
    return data;
  },

  async confirmAnomalyFromOperator({ decision, operator = "operador", justification = "" }) {
    const res = await fetch(`${API_BASE}/events/confirm-anomaly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, operator, justification }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Falha ao salvar decisão");
    }
    return data;
  },

  async getLocalEvidences() {
    const res = await fetch(`${API_BASE}/evidencias/local`);
    if (!res.ok) {
      return { total: 0, items: [] };
    }
    return res.json();
  },

  getStreamUrl(overlays = true) {
    return `${API_BASE}/stream?overlays=${overlays}`;
  },

  getEventFrameUrl(eventId, user_id = null, user_email = null) {
    let url = `${API_BASE}/events/${eventId}/frame`;
    const params = [];
    if (user_id) params.push(`user_id=${user_id}`);
    if (user_email) params.push(`requesting_user_email=${encodeURIComponent(user_email)}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return url;
  },

  getEventVideoUrl(eventId, user_id = null, user_email = null) {
    let url = `${API_BASE}/events/${eventId}/video`;
    const params = [];
    if (user_id) params.push(`user_id=${user_id}`);
    if (user_email) params.push(`requesting_user_email=${encodeURIComponent(user_email)}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return url;
  },
};
