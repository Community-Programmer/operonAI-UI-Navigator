import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getSessionDetail } from "@/lib/api";
import type { SessionDetail, SessionIteration } from "@/types";
import {
  ArrowLeft,
  Brain,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  Loader2,
  MousePointerClick,
  XCircle,
  Zap,
  ListChecks,
  AlertTriangle,
  StopCircle,
  ImageOff,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  complete: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Complete" },
  failed: { icon: XCircle, color: "text-red-700", bg: "bg-red-50 border-red-200", label: "Failed" },
  running: { icon: Loader2, color: "text-blue-700", bg: "bg-blue-50 border-blue-200", label: "Running" },
  interrupted: { icon: StopCircle, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Interrupted" },
  max_iterations: { icon: AlertTriangle, color: "text-orange-700", bg: "bg-orange-50 border-orange-200", label: "Max Iterations" },
  needs_human: { icon: AlertTriangle, color: "text-purple-700", bg: "bg-purple-50 border-purple-200", label: "Needs Human" },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function IterationCard({ iter, index }: { iter: SessionIteration; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [imgError, setImgError] = useState(false);
  const hasScreenshot = !!iter.screenshot_url;
  const hasVerification = !!iter.verification;
  const isVerificationOnly = iter.agent_reasoning?.startsWith("[Verification]");

  return (
    <div className="group rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {/* Step indicator */}
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          hasVerification
            ? iter.verification?.status === "complete"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-blue-100 text-blue-700"
            : "bg-slate-100 text-slate-600"
        }`}>
          {iter.iteration + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">
              {isVerificationOnly ? "Verification" : `Iteration ${iter.iteration + 1}`}
            </span>
            {iter.actions.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {iter.actions.length} action{iter.actions.length !== 1 ? "s" : ""}
              </span>
            )}
            {hasVerification && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                iter.verification?.status === "complete"
                  ? "bg-emerald-50 text-emerald-700"
                  : iter.verification?.status === "failed"
                  ? "bg-red-50 text-red-700"
                  : "bg-blue-50 text-blue-700"
              }`}>
                {iter.verification?.progress_percent}%
              </span>
            )}
          </div>
          {iter.agent_reasoning && !isVerificationOnly && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {iter.agent_reasoning.slice(0, 120)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          {hasScreenshot && <Camera className="h-3.5 w-3.5" />}
          {iter.element_count > 0 && (
            <span>{iter.element_count} elements</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Screenshot */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Camera className="h-3.5 w-3.5" />
                Screenshot
              </h4>
              {hasScreenshot && !imgError ? (
                <a href={iter.screenshot_url!} target="_blank" rel="noopener noreferrer">
                  <img
                    src={iter.screenshot_url!}
                    alt={`Iteration ${iter.iteration + 1}`}
                    className="w-full rounded-lg border shadow-sm transition-transform hover:scale-[1.02]"
                    onError={() => setImgError(true)}
                  />
                </a>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-slate-50">
                  <div className="text-center">
                    <ImageOff className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-1 text-xs text-slate-400">
                      {imgError ? "Failed to load" : "No screenshot"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Reasoning + Actions */}
            <div className="space-y-4">
              {/* Agent Reasoning */}
              {iter.agent_reasoning && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Brain className="h-3.5 w-3.5" />
                    Agent Reasoning
                  </h4>
                  <div className="rounded-lg bg-gradient-to-br from-violet-50 to-indigo-50 p-3 text-xs leading-relaxed text-slate-700 border border-violet-100">
                    {iter.agent_reasoning}
                  </div>
                </div>
              )}

              {/* Actions */}
              {iter.actions.length > 0 && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MousePointerClick className="h-3.5 w-3.5" />
                    Actions ({iter.actions.length})
                  </h4>
                  <div className="space-y-1.5">
                    {iter.actions.map((action, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100"
                      >
                        <Zap className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                          action.status === "success" ? "text-emerald-500" : "text-red-500"
                        }`} />
                        <div className="min-w-0 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-slate-800">
                              {action.action}
                            </span>
                            {action.target && (
                              <span className="font-mono text-slate-400">
                                → {action.target}
                              </span>
                            )}
                          </div>
                          {action.reason && (
                            <p className="mt-0.5 text-slate-500">{action.reason}</p>
                          )}
                          {action.message && (
                            <p className="mt-0.5 text-slate-400 italic">{action.message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification */}
              {hasVerification && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Crosshair className="h-3.5 w-3.5" />
                    Verification
                  </h4>
                  <div className={`rounded-lg p-3 border text-xs ${
                    iter.verification?.status === "complete"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : iter.verification?.status === "failed"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-blue-50 border-blue-200 text-blue-800"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize">{iter.verification?.status}</span>
                      <span className="font-bold">{iter.verification?.progress_percent}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/60">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          iter.verification?.status === "complete"
                            ? "bg-emerald-500"
                            : iter.verification?.status === "failed"
                            ? "bg-red-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${iter.verification?.progress_percent ?? 0}%` }}
                      />
                    </div>
                    {iter.verification?.reasoning && (
                      <p className="mt-2 leading-relaxed">{iter.verification.reasoning}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !sessionId) return;
    setLoading(true);
    getSessionDetail(sessionId, token)
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading session...</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="py-20 text-center">
        <XCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 text-sm text-red-600">{error || "Session not found"}</p>
        <button
          onClick={() => navigate("/app/sessions")}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Back to sessions
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.running;
  const StatusIcon = cfg.icon;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back button + Title */}
      <div>
        <button
          onClick={() => navigate("/app/sessions")}
          className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sessions
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{session.goal}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="font-mono">{session.device_name}</span>
              <span>·</span>
              <span>{session.device_id}</span>
              <span>·</span>
              <span>{new Date(session.started_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Status badge */}
          <div className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 ${cfg.bg}`}>
            <StatusIcon className={`h-4 w-4 ${cfg.color} ${session.status === "running" ? "animate-spin" : ""}`} />
            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Duration</p>
          <p className="mt-1 text-lg font-bold text-slate-800">
            <Clock className="mr-1 inline h-4 w-4 text-slate-400" />
            {formatDuration(session.duration_seconds)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Iterations</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{session.total_iterations}</p>
        </div>
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Progress</p>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {session.final_verification?.progress_percent ?? 0}%
          </p>
        </div>
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Plan Steps</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{session.plan?.total_steps ?? 0}</p>
        </div>
      </div>

      {/* Plan */}
      {session.plan && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ListChecks className="h-4 w-4 text-blue-500" />
            Plan
          </h2>
          {session.plan.reasoning && (
            <p className="mt-2 text-xs italic text-slate-500">{session.plan.reasoning}</p>
          )}
          <ol className="mt-3 space-y-2">
            {session.plan.steps.map((step) => (
              <li
                key={step.step_number}
                className="flex items-start gap-3 rounded-lg bg-slate-50 p-2.5 border border-slate-100"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                  {step.step_number}
                </span>
                <div className="text-xs">
                  <p className="font-medium text-slate-800">{step.description}</p>
                  {step.expected_state && (
                    <p className="mt-0.5 text-slate-400">Expected: {step.expected_state}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Final Verification */}
      {session.final_verification && (
        <div className={`rounded-xl border p-4 ${
          session.final_verification.status === "complete"
            ? "bg-emerald-50 border-emerald-200"
            : session.final_verification.status === "failed"
            ? "bg-red-50 border-red-200"
            : "bg-blue-50 border-blue-200"
        }`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Crosshair className="h-4 w-4" />
            Final Verification — {session.final_verification.progress_percent}%
          </h2>
          <p className="mt-1 text-xs leading-relaxed">{session.final_verification.reasoning}</p>
        </div>
      )}

      {/* Iteration Timeline */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          Iteration Timeline ({session.iterations.length})
        </h2>

        {session.iterations.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center">
            <p className="text-sm text-slate-400">No iterations recorded</p>
          </div>
        ) : (
          <div className="relative space-y-3">
            {/* Timeline line */}
            <div className="absolute left-[1.9rem] top-0 bottom-0 w-px bg-slate-200" />

            {session.iterations.map((iter, i) => (
              <IterationCard key={`${iter.iteration}-${i}`} iter={iter} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
