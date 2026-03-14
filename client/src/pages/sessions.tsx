import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getSessions } from "@/lib/api";
import type { SessionSummary } from "@/types";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  StopCircle,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  complete: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", label: "Complete" },
  failed: { icon: XCircle, color: "text-red-600 bg-red-50", label: "Failed" },
  running: { icon: Loader2, color: "text-blue-600 bg-blue-50", label: "Running" },
  interrupted: { icon: StopCircle, color: "text-amber-600 bg-amber-50", label: "Interrupted" },
  max_iterations: { icon: AlertTriangle, color: "text-orange-600 bg-orange-50", label: "Max Iterations" },
  needs_human: { icon: AlertTriangle, color: "text-purple-600 bg-purple-50", label: "Needs Human" },
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

  const filtered = sessions.filter((s) =>
    !searchQuery || s.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.device_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Session Logs</h1>
        <p className="text-sm text-slate-500">
          Monitor all agent sessions — commands, screenshots, reasoning, and actions
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Sessions", value: total, color: "text-slate-900" },
          { label: "Completed", value: sessions.filter((s) => s.status === "complete").length, color: "text-emerald-600" },
          { label: "Failed", value: sessions.filter((s) => s.status === "failed").length, color: "text-red-600" },
          { label: "Running", value: sessions.filter((s) => s.status === "running").length, color: "text-blue-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by goal or device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border bg-white py-2 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">All statuses</option>
            <option value="complete">Complete</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="interrupted">Interrupted</option>
            <option value="max_iterations">Max Iterations</option>
          </select>
        </div>
      </div>

      {/* Session List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Loading sessions...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <Clock className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No sessions found</p>
          <p className="mt-1 text-xs text-slate-400">Sessions will appear here after you run agent tasks</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => {
            const cfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.running;
            const Icon = cfg.icon;
            return (
              <button
                key={session.session_id}
                onClick={() => navigate(`/app/sessions/${session.session_id}`)}
                className="group flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                {/* Status Icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                  <Icon className={`h-5 w-5 ${session.status === "running" ? "animate-spin" : ""}`} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {session.goal}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span>{session.device_name}</span>
                    <span>·</span>
                    <span>{session.total_iterations} iterations</span>
                    <span>·</span>
                    <span>{formatDuration(session.duration_seconds)}</span>
                    <span>·</span>
                    <span>{formatDate(session.started_at)}</span>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-blue-500" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
