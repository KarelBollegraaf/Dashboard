import type {
  OverviewData,
  PaginatedResponse,
  BaleCycle,
  BaleDetail,
  MqttRaw,
  EventRecord,
  ParsedCycle,
  ParsedPressure,
} from "@/types/database";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const AUTH_SESSION_STORAGE_KEY = "dashboard.auth.session.v1";

function getAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as { token?: string };
    return session.token || null;
  } catch {
    return null;
  }
}

function createHeaders(includeJson = false) {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    cache: "no-store",
    headers: createHeaders(),
  });

  return parseApiResponse<T>(res);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    cache: "no-store",
    headers: createHeaders(true),
    body: JSON.stringify(body),
  });

  return parseApiResponse<T>(res);
}

// Overview
export function fetchOverview(): Promise<OverviewData> {
  return fetchJson("/overview");
}

export function fetchOverviewWithRange(params: {
  from: string;
  to: string;
  materials?: string[];
  recipes?: number[];
}): Promise<OverviewData> {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);

  if (params.materials && params.materials.length > 0) {
    sp.set("materials", params.materials.join(","));
  }

  if (params.recipes && params.recipes.length > 0) {
    sp.set("recipes", params.recipes.join(","));
  }

  return fetchJson(`/overview?${sp.toString()}`);
}

export function fetchLatestBale(): Promise<BaleCycle | null> {
  return fetchJson("/latest-bale");
}

// Bales
export function fetchBales(params?: {
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
  material?: string;
  bale_number?: number;
  from?: string;
  to?: string;
  shift?: number;
}): Promise<PaginatedResponse<BaleCycle>> {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  return fetchJson(`/bales?${sp.toString()}`);
}

export function fetchBaleDetail(id: number): Promise<BaleDetail> {
  return fetchJson(`/bales/${id}`);
}

// Raw messages
export function fetchRawMessages(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<MqttRaw>> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  return fetchJson(`/raw?${sp.toString()}`);
}

export function fetchRawDetail(id: number): Promise<MqttRaw> {
  return fetchJson(`/raw/${id}`);
}

// Events
export function fetchEvents(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<EventRecord>> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  return fetchJson(`/events?${sp.toString()}`);
}

// Cycles
export function fetchCycles(rawId: number): Promise<{ cycles: ParsedCycle[] }> {
  return fetchJson(`/cycles/${rawId}`);
}

// Pressure
export function fetchPressure(rawId: number): Promise<{ pressure: ParsedPressure[] }> {
  return fetchJson(`/pressure/${rawId}`);
}

// Auth email actions
export function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  return postJson("/auth/forgot-password", { email });
}

export function resetPasswordWithToken(
  token: string,
  password: string
): Promise<{ ok: boolean; email?: string }> {
  return postJson("/auth/reset-password", { token, password });
}

interface LoginEmailUser {
  id: string;
  email: string;
  name: string;
}

export function sendUserInvite(user: LoginEmailUser): Promise<{ ok: boolean }> {
  return postJson(`/users/${user.id}/send-invite`, {
    email: user.email,
    name: user.name,
  });
}

export function sendUserPasswordReset(user: LoginEmailUser): Promise<{ ok: boolean }> {
  return postJson(`/users/${user.id}/send-password-reset`, {
    email: user.email,
    name: user.name,
  });
}
