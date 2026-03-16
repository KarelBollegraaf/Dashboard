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

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json();
}

// Overview
export function fetchOverview(): Promise<OverviewData> {
  return fetchJson("/overview");
}

export function fetchOverviewWithRange(from: string, to: string): Promise<OverviewData> {
  const sp = new URLSearchParams();
  sp.set("from", from);
  sp.set("to", to);
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