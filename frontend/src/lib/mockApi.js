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

  submitCase: async (notes = "") => {
    const s = requireSession();
    return jsonFetch(`/api/case/${s.caseId}/submit`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  },

  wsUrl: () => {
    const s = getSession();
    if (!s?.caseId) throw new Error("No active session");
    try {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${window.location.host}/ws/${s.caseId}`;
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

export const deleteCase = async (caseId) => {
  return jsonFetch(`/api/hr/cases/${caseId}`, { method: "DELETE" });
};

export const resumeCase = async (caseId) => {
  return jsonFetch(`/api/hr/cases/${caseId}/resume`, { method: "POST" });
};

export const updateCase = async (caseId, payload) => {
  return jsonFetch(`/api/hr/cases/${caseId}`, { method: "PUT", body: JSON.stringify(payload) });
};

// Orchestrator - triggers AI agents to assign laptops and desks
export const runOrchestrator = async (caseId) => {
  return jsonFetch(`/api/hr/cases/${caseId}/orchestrate`, { method: "POST" });
};

export async function sendLowStockEmail(caseId, it_email, requested_model, missing_or_low = []) {
  return jsonFetch(`/api/email/it_low_stock/${caseId}`, {
    method: "POST",
    body: JSON.stringify({ it_email, requested_model, missing_or_low }),
  });
}

export async function stockCheck(requested_model) {
  return jsonFetch(`/api/it/stock_check`, {
    method: "POST",
    body: JSON.stringify({ requested_model }),
  });
}

// Employee-related API calls
export const listEmployees = async () => {
  try {
    return await jsonFetch("/api/hr/employees", { method: "GET" });
  } catch (e) {
    // Return mock data if backend endpoint is not available
    console.warn("Employees endpoint not available, using mock data");
    return getMockEmployees();
  }
};

export const getEmployeeDetails = async (employeeId) => {
  try {
    return await jsonFetch(`/api/hr/employees/${employeeId}`, { method: "GET" });
  } catch (e) {
    // Return mock data if backend endpoint is not available
    console.warn("Employee details endpoint not available, using mock data");
    const employees = getMockEmployees();
    return employees.find((emp) => emp.employee_id === employeeId) || null;
  }
};

// Mock employee data for development
const getMockEmployees = () => [
  {
    employee_id: "EMP-001",
    case_id: "case-abc123",
    full_name: "Rikhil Sharma",
    email: "rikhil.sharma@company.com",
    department: "Engineering",
    role: "Software Engineer",
    start_date: "2026-03-01",
    status: "ONBOARDING_IN_PROGRESS",
    steps: {
      offer: { decision: "ACCEPTED" },
      identity: {
        fullName: "Rikhil Sharma",
        email: "rikhil.sharma@company.com",
        phone: "+971 50 123 4567",
        country: "India"
      },
      documents: {
        passport: { name: "passport_rikhil.pdf", size: 245000, status: "verified" },
        nationalId: { name: "national_id_rikhil.pdf", size: 180000, status: "verified" },
        visa: { name: "visa_rikhil.pdf", size: 120000, status: "pending" }
      },
      workAuth: {
        workLocation: "Dubai, UAE",
        sponsorship: "Required"
      }
    },
    assets: {
      laptop: { assigned: true, model: "MacBook Pro 14 inch", asset_id: "LAP-2026-0042" },
      seat: { assigned: true, location: "Floor 3, Desk 12B" }
    }
  },
  {
    employee_id: "EMP-002",
    case_id: "case-def456",
    full_name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    department: "Marketing",
    role: "Marketing Manager",
    start_date: "2026-03-15",
    status: "SUBMITTED_FOR_HR_REVIEW",
    steps: {
      offer: { decision: "ACCEPTED" },
      identity: {
        fullName: "Sarah Johnson",
        email: "sarah.johnson@company.com",
        phone: "+1 555 123 4567",
        country: "USA"
      },
      documents: {
        passport: { name: "passport_sarah.pdf", size: 280000, status: "verified" },
        nationalId: { name: "license_sarah.pdf", size: 150000, status: "verified" },
        visa: null
      },
      workAuth: {
        workLocation: "New York, USA",
        sponsorship: "Not Required"
      }
    },
    assets: {
      laptop: { assigned: false, model: null, asset_id: null },
      seat: { assigned: false, location: null }
    }
  },
  {
    employee_id: "EMP-003",
    case_id: "case-ghi789",
    full_name: "Ahmed Al-Rashid",
    email: "ahmed.rashid@company.com",
    department: "Finance",
    role: "Financial Analyst",
    start_date: "2026-02-20",
    status: "ONBOARDING_COMPLETE",
    steps: {
      offer: { decision: "ACCEPTED" },
      identity: {
        fullName: "Ahmed Al-Rashid",
        email: "ahmed.rashid@company.com",
        phone: "+971 55 987 6543",
        country: "UAE"
      },
      documents: {
        passport: { name: "passport_ahmed.pdf", size: 210000, status: "verified" },
        nationalId: { name: "emirates_id_ahmed.pdf", size: 195000, status: "verified" },
        visa: null
      },
      workAuth: {
        workLocation: "Abu Dhabi, UAE",
        sponsorship: "Not Required"
      }
    },
    assets: {
      laptop: { assigned: true, model: "Dell XPS 15", asset_id: "LAP-2026-0038" },
      seat: { assigned: true, location: "Floor 2, Desk 5A" }
    }
  }
];

// Update employee assets (laptop/seat)
export const updateEmployeeAssets = async (employeeId, assets) => {
  try {
    return await jsonFetch(`/api/hr/employees/${employeeId}/assets`, {
      method: "PUT",
      body: JSON.stringify(assets)
    });
  } catch (e) {
    console.warn("Employee assets endpoint not available, returning mock response");
    return { success: true, employeeId, assets };
  }
};
