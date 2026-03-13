// ── API request / response types ────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: string;
}

export interface TokenResponse {
  device_token: string;
  device_id: string;
  device_name: string;
  session_minutes: number;
  expires_at: string;
}

export interface PairDeviceRequest {
  device_name: string;
  session_minutes: number;
}

export interface DeviceInfo {
  device_id: string;
  user_id: string;
  device_name: string;
  online: boolean;
  screen_width: number;
  screen_height: number;
  session_minutes: number;
  session_expires_at: string;
  last_seen_at: string;
}

export interface ActiveSystemsResponse {
  systems: DeviceInfo[];
  online_count: number;
}

// ── WebSocket event types ──────────────────────────────────────

export interface DashboardEvent {
  type: "screenshot" | "log" | "status" | "error" | "done";
  data: Record<string, unknown>;
}

export interface NavigateMessage {
  type: "navigate";
  goal: string;
  device_id: string;
}

export interface StopMessage {
  type: "stop";
  device_id: string;
}

// ── UI types ───────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: number;
  type: "agent_response" | "thinking" | "tool" | "tool_result" | "status" | "error" | "done" | "warning" | "user_voice" | "agent_voice";
  message: string;
  author?: string;
}
