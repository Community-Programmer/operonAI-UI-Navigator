import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getSessions } from "@/lib/api";
import type { SessionSummary } from "@/types";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  AlertTriangle,
  Search,
  StopCircle,
  XCircle,
} from "lucide-react";

const STATUS_MAP: Record<
  string,
  { icon: typeof CheckCircle2; iconColor: string; bgColor: string; textColor: string; label: string }
> = {
  complete: {
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    label: "Complete",
  },
  failed: {
    icon: XCircle,
    iconColor: "text-rose-500",
    bgColor: "bg-rose-50",
    textColor: "text-rose-700",
    label: "Failed",
  },
  running: {
    icon: Loader2,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    label: "Running",
  },
  completed: {
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    label: "Completed",
  },
  error: {
    icon: XCircle,
    iconColor: "text-rose-500",
    bgColor: "bg-rose-50",
    textColor: "text-rose-700",
    label: "Error",
  },
  interrupted: {
    icon: StopCircle,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    label: "Interrupted",
  },
  max_iterations: {
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    label: "Max Iterations",
  },
  needs_human: {
    icon: AlertTriangle,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    label: "Needs Human",
  },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getSessions(token, { limit: 100, status: statusFilter || undefined })
      .then((res) => {
        setSessions(res.sessions);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  const filtered = sessions.filter(
    (s) =>
      !searchQuery ||
      s.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.device_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const completedCount = sessions.filter((s) => s.status === "complete" || s.status === "completed").length;
  const failedCount = sessions.filter((s) => s.status === "failed" || s.status === "error").length;
  const runningCount = sessions.filter((s) => s.status === "running").length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#2D2018]">Session Logs</h1>
        <p className="mt-0.5 text-sm text-[#6B5046]">
          Browse all agent sessions — goals, actions, reasoning, and screenshots
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: total, accent: "border-l-[#C9A48C]" },
          { label: "Completed", value: completedCount, accent: "border-l-emerald-500" },
          { label: "Failed", value: failedCount, accent: "border-l-rose-500" },
          { label: "Running", value: runningCount, accent: "border-l-[#9B3C3C]" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-lg border border-[#E8DDD4] border-l-[3px] ${stat.accent} bg-white px-4 py-3 shadow-sm`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A7060]">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-[#2D2018]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 rounded-lg border border-[#E8DDD4] bg-white px-4 py-2.5 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-[#8A7060]" />
        <input
          type="text"
          placeholder="Search by goal or device…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2D2018] outline-none placeholder:text-[#C9A48C]"
        />
        <div className="h-5 w-px bg-[#E8DDD4]" />
        <Filter className="h-4 w-4 shrink-0 text-[#8A7060]" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-transparent text-sm font-medium text-[#5C3D2E] outline-none"
        >
          <option value="">All</option>
          <option value="complete">Complete</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
          <option value="interrupted">Interrupted</option>
          <option value="max_iterations">Max Iterations</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[#C9A48C]" />
          <span className="ml-2 text-sm text-[#6B5046]">Loading sessions…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8DDD4] bg-white py-16">
          <Clock className="h-8 w-8 text-[#D4B8A0]" />
          <p className="mt-3 text-sm font-medium text-[#5C3D2E]">No sessions found</p>
          <p className="mt-1 text-xs text-[#8A7060]">
            Sessions appear here after you run agent tasks
          </p>
        </div>
      ) : (
        /* Table-like layout */
        <div className="overflow-hidden rounded-xl border border-[#E8DDD4] bg-white shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_100px_90px_80px_28px] items-center gap-3 border-b border-[#E8DDD4] bg-[#FAF5F0]/60 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8A7060]">
            <span>Goal</span>
            <span>Device</span>
            <span>Status</span>
            <span>Duration</span>
            <span>When</span>
            <span />
          </div>

          {/* Rows */}
          {filtered.map((session) => {
            const cfg = STATUS_MAP[session.status] ?? STATUS_MAP.running;
            const Icon = cfg.icon;
            return (
              <button
                key={session.session_id}
                onClick={() => navigate(`/app/sessions/${session.session_id}`)}
                className="group grid w-full grid-cols-[1fr_120px_100px_90px_80px_28px] items-center gap-3 border-b border-[#F5EDE6] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#FAF5F0]"
              >
                {/* Goal */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-[#2D2018]">
                      {session.goal}
                    </p>
                    {session.mode === "voice" && (
                      <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-600">
                        Voice
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#8A7060]">
                    {session.total_iterations} iteration{session.total_iterations !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Device */}
                <span className="truncate text-xs text-[#6B5046]">
                  {session.device_name}
                </span>

                {/* Status */}
                <span
                  className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bgColor} ${cfg.textColor}`}
                >
                  <Icon
                    className={`h-3 w-3 ${cfg.iconColor} ${session.status === "running" ? "animate-spin" : ""}`}
                  />
                  {cfg.label}
                </span>

                {/* Duration */}
                <span className="text-xs tabular-nums text-[#5C3D2E]">
                  {formatDuration(session.duration_seconds)}
                </span>

                {/* When */}
                <span className="text-[11px] text-[#8A7060]">
                  {formatDate(session.started_at)}
                </span>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-[#D4B8A0] transition-colors group-hover:text-[#5C3D2E]" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
