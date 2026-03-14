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
  type: "screenshot" | "log" | "status" | "error" | "done" | "plan" | "verification" | "plan_step_complete";
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

// ── Agent loop types ───────────────────────────────────────────

export interface PlanStep {
  step_number: number;
  description: string;
  expected_state: string;
  completed: boolean;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  current_step: number;
  reasoning: string;
}

export interface VerificationResult {
  status: "complete" | "in_progress" | "failed" | "blocked" | "needs_human";
  reasoning: string;
  progress_percent: number;
  should_continue: boolean;
}

// ── UI types ───────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: number;
  type: "agent_response" | "thinking" | "tool" | "tool_result" | "status" | "error" | "done" | "warning" | "user_voice" | "agent_voice";
  message: string;
  author?: string;
}

// ── Session monitoring types ───────────────────────────────────

export interface SessionSummary {
  session_id: string;
  device_id: string;
  device_name: string;
  goal: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_iterations: number;
  mode: string;
}

export interface SessionIteration {
  iteration: number;
  timestamp: string;
  screenshot_url: string | null;
  agent_reasoning: string;
  actions: SessionAction[];
  verification: SessionVerification | null;
  element_count: number;
}

export interface SessionAction {
  action: string;
  target: string;
  parameters: Record<string, unknown>;
  reason: string;
  status: string;
  message: string;
}

export interface SessionVerification {
  status: string;
  reasoning: string;
  progress_percent: number;
  should_continue: boolean;
  screenshot_url?: string | null;
}

export interface SessionPlan {
  goal: string;
  steps: { step_number: number; description: string; expected_state: string }[];
  total_steps: number;
  reasoning: string;
}

export interface SessionDetail {
  session_id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  goal: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  plan: SessionPlan | null;
  iterations: SessionIteration[];
  final_verification: SessionVerification | null;
  total_iterations: number;
  mode: string;
}

export interface SessionsListResponse {
  sessions: SessionSummary[];
  total: number;
}
