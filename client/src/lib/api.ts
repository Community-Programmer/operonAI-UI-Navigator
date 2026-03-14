import type {
  ActiveSystemsResponse,
  DeviceInfo,
  LoginRequest,
  LoginResponse,
  PairDeviceRequest,
  SessionDetail,
  SessionsListResponse,
  TokenResponse,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────

export function register(data: LoginRequest) {
  return request<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function login(data: LoginRequest) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Devices ────────────────────────────────────────────────────

export function getDevices(token: string) {
  return request<DeviceInfo[]>(`/api/devices?token=${encodeURIComponent(token)}`);
}

export function generateDeviceToken(token: string, data: PairDeviceRequest) {
  return request<TokenResponse>(`/api/devices/token?token=${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getActiveSystems(token: string) {
  return request<ActiveSystemsResponse>(
    `/api/systems/active?token=${encodeURIComponent(token)}`,
  );
}

export function killDevice(deviceId: string, token: string) {
  return request<{ status: string }>(
    `/api/devices/${encodeURIComponent(deviceId)}/kill?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
}

// ── Sessions ───────────────────────────────────────────────────

export function getSessions(
  token: string,
  opts?: { limit?: number; skip?: number; status?: string; device_id?: string },
) {
  const params = new URLSearchParams({ token });
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.skip) params.set("skip", String(opts.skip));
  if (opts?.status) params.set("status", opts.status);
  if (opts?.device_id) params.set("device_id", opts.device_id);
  return request<SessionsListResponse>(`/api/sessions?${params.toString()}`);
}

export function getSessionDetail(sessionId: string, token: string) {
  return request<SessionDetail>(
    `/api/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`,
  );
}

// ── Helpers ────────────────────────────────────────────────────

export function wsUrl(path: string, token: string, extra?: Record<string, string>): string {
  const base = API_BASE.replace(/^http/, "ws");
  const params = new URLSearchParams({ token, ...extra });
  return `${base}${path}?${params.toString()}`;
}
