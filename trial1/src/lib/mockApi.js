// trial1/src/lib/mockApi.js
// Backend-backed API adapter.
// Uses Vite proxy and relative `/api` paths exclusively.

const SESSION_KEY = "hr_automator_session";
const STORAGE_KEY = "hr_automator_case";

function _parseJsonSafe(res) {
  return res.json().catch(() => ({}));
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function requireSession() {
  const s = getSession();
  if (!s || !s.caseId) throw new Error("No active session");
  return s;
}

export async function jsonFetch(url, options = {}) {
  const opts = { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options };
  const res = await fetch(url, opts);
  const data = await _parseJsonSafe(res);
  if (!res.ok) {
    const message = data?.detail || data?.error || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  if (data?.error) {
    const err = new Error(data.error || "API error");
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  // Candidate login by application code
  login: async (applicationCode) => {
    if (!applicationCode) throw new Error("Application code required");
    const code = String(applicationCode).trim();
    const res = await jsonFetch("/api/case/init", {
      method: "POST",
      body: JSON.stringify({ applicationCode: code }),
    });

    if (!res?.caseId || !res?.applicationNumber) throw new Error("Invalid application code response");

    // Persist for UI
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
    setSession({ caseId: res.caseId, applicationNumber: res.applicationNumber });
    return res;
  },

  getCase: async () => {
    const s = getSession();
    if (!s?.caseId) return null;
    return jsonFetch(`/api/case/${s.caseId}`);
  },

  saveStep: async (stepKey, payload = {}, nextStepIndex = null) => {
    const s = requireSession();
    return jsonFetch(`/api/case/${s.caseId}/step/${stepKey}`, {
      method: "POST",
      body: JSON.stringify({ payload, nextStepIndex }),
    });
  },

  submitStep: async (stepKey, payload = {}, nextStepIndex = null) => {
    return api.saveStep(stepKey, payload, nextStepIndex);
  },

  setStatus: async (status) => {
    const s = requireSession();
    return jsonFetch(`/api/case/${s.caseId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  runAgents: async (notes = "") => {
    const s = requireSession();
    return jsonFetch(`/api/onboard/run/${s.caseId}`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  },

  wsUrl: () => {
    const s = getSession();
    if (!s?.caseId) throw new Error("No active session");
    try {
      const hostname = window.location.hostname || "localhost";
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      // Prefer Vite dev proxy port (5173) for websockets in dev
      const port = 5173;
      return `${proto}://${hostname}:${port}/ws/${s.caseId}`;
    } catch (e) {
      // Fallback to relative
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${window.location.host}/ws/${s.caseId}`;
    }
  },

  simulateDocAnalysis: async (fileName) => {
    await new Promise((r) => setTimeout(r, 800));
    const rand = Math.random();
    if (rand > 0.95) return { status: "error", message: "Wrong document type" };
    if (rand > 0.8) return { status: "warning", message: "Low quality" };
    return { status: "success", message: "Looks good" };
  },
};

export const hrLogin = async (username, password) => {
  return jsonFetch("/api/hr/login", { method: "POST", body: JSON.stringify({ username, password }) });
};

export const createCase = async (payload) => {
  return jsonFetch("/api/hr/cases", { method: "POST", body: JSON.stringify(payload) });
};

export const generateApplicationCode = async (caseId) => {
  return jsonFetch(`/api/hr/cases/${caseId}/generate_code`, { method: "POST" });
};

export const listCases = async () => {
  return jsonFetch("/api/hr/cases", { method: "GET" });
};
