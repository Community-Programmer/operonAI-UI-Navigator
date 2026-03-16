import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getSessionDetail, screenshotUrl } from "@/lib/api";
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
  Mic,
  MousePointerClick,
  XCircle,
  Zap,
  ListChecks,
  AlertTriangle,
  StopCircle,
  ImageOff,
  MessageSquare,
} from "lucide-react";

/* ── Status config ── */
const STATUS_CFG: Record<
  string,
  { icon: typeof CheckCircle2; iconColor: string; bgColor: string; textColor: string; label: string }
> = {
  complete: { icon: CheckCircle2, iconColor: "text-[#9B3C3C]", bgColor: "bg-[#FAF5F0]", textColor: "text-[#9B3C3C]", label: "Complete" },
  failed: { icon: XCircle, iconColor: "text-[#5C3D2E]", bgColor: "bg-[#E8DDD4]", textColor: "text-[#5C3D2E]", label: "Failed" },
  running: { icon: Loader2, iconColor: "text-[#C9A48C]", bgColor: "bg-[#FAF5F0]", textColor: "text-[#C9A48C]", label: "Running" },
  interrupted: { icon: StopCircle, iconColor: "text-[#6B5046]", bgColor: "bg-[#E8DDD4]", textColor: "text-[#6B5046]", label: "Interrupted" },
  max_iterations: { icon: AlertTriangle, iconColor: "text-[#5C3D2E]", bgColor: "bg-[#E8DDD4]", textColor: "text-[#5C3D2E]", label: "Max Iterations" },
  needs_human: { icon: AlertTriangle, iconColor: "text-[#8A7060]", bgColor: "bg-[#FAF5F0]", textColor: "text-[#8A7060]", label: "Needs Human" },
  completed: { icon: CheckCircle2, iconColor: "text-[#9B3C3C]", bgColor: "bg-[#FAF5F0]", textColor: "text-[#9B3C3C]", label: "Completed" },
  error: { icon: XCircle, iconColor: "text-[#5C3D2E]", bgColor: "bg-[#E8DDD4]", textColor: "text-[#5C3D2E]", label: "Error" },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/* ── Screenshot with fallback ── */
function ScreenshotImage({
  src,
  fallbackSrc,
  alt,
}: {
  src: string;
  fallbackSrc: string;
  alt: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[#E8DDD4] bg-[#FAF5F0]">
        <div className="text-center">
          <ImageOff className="mx-auto h-5 w-5 text-[#D4B8A0]" />
          <p className="mt-1 text-[11px] text-[#8A7060]">Screenshot unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <a href={currentSrc} target="_blank" rel="noopener noreferrer">
      <img
        src={currentSrc}
        alt={alt}
        className="w-full rounded-lg border border-[#E8DDD4] shadow-sm transition-transform hover:scale-[1.01]"
        onError={() => {
          if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
          else setFailed(true);
        }}
      />
    </a>
  );
}

/* ── Iteration Card ── */
function IterationCard({
  iter,
  index,
  sessionId,
  token,
}: {
  iter: SessionIteration;
  index: number;
  sessionId: string;
  token: string;
}) {
  const [expanded, setExpanded] = useState(index === 0);

  const fallbackUrl = screenshotUrl(sessionId, iter.iteration, token);
  const imgSrc = iter.screenshot_url || fallbackUrl;
  const hasVerification = !!iter.verification;
  const isVerificationOnly = iter.agent_reasoning?.startsWith("[Verification]");

  return (
    <div className="relative ml-8">
      {/* Timeline dot */}
      <div
        className={`absolute -left-8 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold shadow-sm ${
          hasVerification && iter.verification?.status === "complete"
            ? "bg-[#FAF5F0] text-white"
            : hasVerification
              ? "bg-[#FAF5F0] text-white"
              : "bg-[#E8DDD4] text-[#6B5046]"
        }`}
      >
        {iter.iteration + 1}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E8DDD4] bg-white shadow-sm">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAF5F0]/60"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#2D2018]">
                {isVerificationOnly ? "Verification" : `Iteration ${iter.iteration + 1}`}
              </span>
              {iter.actions.length > 0 && (
                <span className="rounded bg-[#FAF5F0] px-1.5 py-px text-[10px] font-medium text-[#8A7060]">
                  {iter.actions.length} action{iter.actions.length !== 1 ? "s" : ""}
                </span>
              )}
              {hasVerification && (
                <span
                  className={`rounded px-1.5 py-px text-[10px] font-bold ${
                    iter.verification?.status === "complete"
                      ? "bg-[#FAF5F0] text-[#9B3C3C]"
                      : iter.verification?.status === "failed"
                        ? "bg-[#E8DDD4] text-[#5C3D2E]"
                        : "bg-[#FAF5F0] text-[#C9A48C]"
                  }`}
                >
                  {iter.verification?.progress_percent}%
                </span>
              )}
            </div>
            {iter.agent_reasoning && !isVerificationOnly && (
              <p className="mt-0.5 truncate text-[12px] text-[#8A7060]">
                {iter.agent_reasoning.slice(0, 140)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 text-[#8A7060]">
            {iter.element_count > 0 && (
              <span className="text-[10px] text-[#8A7060]">{iter.element_count} elements</span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-[#E8DDD4]/60 px-4 pb-4 pt-3">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Screenshot */}
              <div>
                <SectionHeader icon={<Camera className="h-3 w-3" />} label="Screenshot" />
                <ScreenshotImage
                  src={imgSrc}
                  fallbackSrc={fallbackUrl}
                  alt={`Iteration ${iter.iteration + 1}`}
                />
              </div>

              {/* Reasoning + Actions */}
              <div className="space-y-4">
                {/* Reasoning */}
                {iter.agent_reasoning && (
                  <div>
                    <SectionHeader icon={<Brain className="h-3 w-3" />} label="Agent Reasoning" />
                    <div className="rounded-lg border border-[#E8DDD4] bg-[#E8DDD4]/60 p-3 text-[12px] leading-relaxed text-[#5C3D2E]">
                      {iter.agent_reasoning}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {iter.actions.length > 0 && (
                  <div>
                    <SectionHeader
                      icon={<MousePointerClick className="h-3 w-3" />}
                      label={`Actions (${iter.actions.length})`}
                    />
                    <div className="space-y-1.5">
                      {iter.actions.map((action, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-lg border border-[#E8DDD4]/60 bg-[#FAF5F0] p-2.5"
                        >
                          <Zap
                            className={`mt-0.5 h-3 w-3 shrink-0 ${
                              action.status === "success"
                                ? "text-[#9B3C3C]"
                                : "text-[#5C3D2E]"
                            }`}
                          />
                          <div className="min-w-0 text-[12px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-[#2D2018]">
                                {action.action}
                              </span>
                              {action.target && (
                                <span className="font-mono text-[#8A7060]">
                                  → {action.target}
                                </span>
                              )}
                            </div>
                            {action.reason && (
                              <p className="mt-0.5 text-[#6B5046]">{action.reason}</p>
                            )}
                            {action.message && (
                              <p className="mt-0.5 italic text-[#8A7060]">
                                {action.message}
                              </p>
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
                    <SectionHeader icon={<Crosshair className="h-3 w-3" />} label="Verification" />
                    <div
                      className={`rounded-lg border p-3 text-[12px] ${
                        iter.verification?.status === "complete"
                          ? "border-[#C9A48C] bg-[#FAF5F0] text-[#9B3C3C]"
                          : iter.verification?.status === "failed"
                            ? "border-[#D4B8A0] bg-[#E8DDD4] text-[#5C3D2E]"
                            : "border-[#E8DDD4] bg-[#FAF5F0] text-[#C9A48C]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">
                          {iter.verification?.status}
                        </span>
                        <span className="font-bold">
                          {iter.verification?.progress_percent}%
                        </span>
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/60">
                        <div
                          className={`h-1 rounded-full transition-all ${
                            iter.verification?.status === "complete"
                              ? "bg-[#FAF5F0]"
                              : iter.verification?.status === "failed"
                                ? "bg-[#E8DDD4]"
                                : "bg-[#FAF5F0]"
                          }`}
                          style={{
                            width: `${iter.verification?.progress_percent ?? 0}%`,
                          }}
                        />
                      </div>
                      {iter.verification?.reasoning && (
                        <p className="mt-2 leading-relaxed">
                          {iter.verification.reasoning}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Reusable section header ── */
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8A7060]">
      {icon}
      {label}
    </h4>
  );
}

/* ── Voice Session Iteration Card ── */
function VoiceIterationCard({
  iter,
  index,
  sessionId,
  token,
}: {
  iter: SessionIteration;
  index: number;
  sessionId: string;
  token: string;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const fallbackUrl = screenshotUrl(sessionId, iter.iteration, token);
  const imgSrc = iter.screenshot_url || fallbackUrl;

  // Parse conversation from agent_reasoning (format: "[role]: text")
  const transcriptLines = (iter.agent_reasoning || "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[(\w+)\]:\s*(.+)$/);
      return match ? { role: match[1], text: match[2] } : { role: "system", text: line };
    });

  return (
    <div className="relative ml-8">
      {/* Timeline dot */}
      <div className="absolute -left-8 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#E8DDD4] text-[9px] font-bold text-white shadow-sm">
        {iter.iteration + 1}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E8DDD4] bg-white shadow-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAF5F0]/60"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#2D2018]">
                Snapshot {iter.iteration + 1}
              </span>
              {iter.actions.length > 0 && (
                <span className="rounded bg-[#E8DDD4] px-1.5 py-px text-[10px] font-medium text-[#6B5046]">
                  {iter.actions.length} action{iter.actions.length !== 1 ? "s" : ""}
                </span>
              )}
              {transcriptLines.length > 0 && (
                <span className="rounded bg-[#E8DDD4] px-1.5 py-px text-[10px] font-medium text-[#5C3D2E]">
                  {transcriptLines.length} message{transcriptLines.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {transcriptLines.length > 0 && (
              <p className="mt-0.5 truncate text-[12px] text-[#8A7060]">
                {transcriptLines[transcriptLines.length - 1].text.slice(0, 100)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[#8A7060]">
            {iter.element_count > 0 && (
              <span className="text-[10px] text-[#8A7060]">{iter.element_count} elements</span>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-[#E8DDD4]/60 px-4 pb-4 pt-3">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Screenshot */}
              <div>
                <SectionHeader icon={<Camera className="h-3 w-3" />} label="Screenshot" />
                <ScreenshotImage src={imgSrc} fallbackSrc={fallbackUrl} alt={`Snapshot ${iter.iteration + 1}`} />
              </div>

              {/* Conversation + Actions */}
              <div className="space-y-4">
                {/* Conversation transcript */}
                {transcriptLines.length > 0 && (
                  <div>
                    <SectionHeader icon={<MessageSquare className="h-3 w-3" />} label="Conversation" />
                    <div className="space-y-2">
                      {transcriptLines.map((line, i) => (
                        <div
                          key={i}
                          className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[90%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                              line.role === "user"
                                ? "rounded-br-md bg-[#2D2018] text-white"
                                : "rounded-bl-md bg-[#E8DDD4] text-[#2D2018]"
                            }`}
                          >
                            <p className={`mb-0.5 text-[10px] font-bold ${line.role === "user" ? "text-[#8A7060]" : "text-[#5C3D2E]"}`}>
                              {line.role === "user" ? "You" : "Agent"}
                            </p>
                            {line.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {iter.actions.length > 0 && (
                  <div>
                    <SectionHeader icon={<MousePointerClick className="h-3 w-3" />} label={`Actions (${iter.actions.length})`} />
                    <div className="space-y-1.5">
                      {iter.actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-lg border border-[#E8DDD4]/60 bg-[#FAF5F0] p-2.5">
                          <Zap className={`mt-0.5 h-3 w-3 shrink-0 ${action.status === "success" ? "text-[#9B3C3C]" : "text-[#5C3D2E]"}`} />
                          <div className="min-w-0 text-[12px]">
                            <span className="font-mono font-semibold text-[#2D2018]">{action.action}</span>
                            {action.reason && <p className="mt-0.5 text-[#6B5046]">{action.reason}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Voice Session Detail Layout ── */
function VoiceSessionDetailView({
  session,
  sessionId,
  token,
  navigate,
}: {
  session: SessionDetail;
  sessionId: string;
  token: string;
  navigate: (path: string) => void;
}) {
  const cfg = STATUS_CFG[session.status] ?? STATUS_CFG.running;
  const StatusIcon = cfg.icon;

  // Extract all transcription lines from iterations for the full conversation
  const allTranscript = session.iterations.flatMap((iter) =>
    (iter.agent_reasoning || "")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\[(\w+)\]:\s*(.+)$/);
        return match ? { role: match[1], text: match[2] } : null;
      })
      .filter(Boolean) as { role: string; text: string }[]
  );

  const totalActions = session.iterations.reduce((sum, it) => sum + it.actions.length, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate("/app/sessions")}
          className="mb-3 flex items-center gap-1 text-sm text-[#8A7060] transition-colors hover:text-[#2D2018]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Sessions
        </button>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E8DDD4] bg-white px-5 py-4 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-[#5C3D2E]" />
              <h1 className="text-lg font-bold text-[#2D2018]">{session.goal}</h1>
              <span className="rounded bg-[#E8DDD4] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C3D2E]">
                Voice
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B5046]">
              <span className="font-medium text-[#2D2018]">{session.device_name}</span>
              <span className="text-[#D4B8A0]">|</span>
              <span className="font-mono text-[11px] text-[#8A7060]">{session.device_id}</span>
              <span className="text-[#D4B8A0]">|</span>
              <span>{new Date(session.started_at).toLocaleString()}</span>
            </div>
          </div>
          <span className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${cfg.bgColor} ${cfg.textColor} border-current/20`}>
            <StatusIcon className={`h-3.5 w-3.5 ${cfg.iconColor} ${session.status === "running" ? "animate-spin" : ""}`} />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Stats — voice-appropriate */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Duration", value: formatDuration(session.duration_seconds), icon: <Clock className="h-3.5 w-3.5 text-[#8A7060]" /> },
          { label: "Snapshots", value: session.total_iterations.toString(), icon: <Camera className="h-3.5 w-3.5 text-[#8A7060]" /> },
          { label: "Messages", value: allTranscript.length.toString(), icon: <MessageSquare className="h-3.5 w-3.5 text-[#8A7060]" /> },
          { label: "Actions", value: totalActions.toString(), icon: <Zap className="h-3.5 w-3.5 text-[#8A7060]" /> },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-[#E8DDD4] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              {stat.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7060]">{stat.label}</span>
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums text-[#2D2018]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Conversation Summary */}
      {allTranscript.length > 0 && (
        <div className="rounded-xl border border-[#E8DDD4] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#E8DDD4]/60 px-5 py-3">
            <MessageSquare className="h-4 w-4 text-[#5C3D2E]" />
            <h2 className="text-sm font-semibold text-[#2D2018]">Conversation</h2>
            <span className="ml-auto text-[11px] font-medium text-[#8A7060]">
              {allTranscript.length} messages
            </span>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto p-4">
            {allTranscript.map((line, i) => (
              <div key={i} className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[12px] leading-relaxed ${
                    line.role === "user"
                      ? "rounded-br-md bg-[#2D2018] text-white"
                      : "rounded-bl-md bg-[#E8DDD4] text-[#2D2018]"
                  }`}
                >
                  <p className={`mb-0.5 text-[10px] font-bold ${line.role === "user" ? "text-[#8A7060]" : "text-[#5C3D2E]"}`}>
                    {line.role === "user" ? "You" : "Agent"}
                  </p>
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Iteration Timeline */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#2D2018]">
          <Camera className="h-4 w-4 text-[#8A7060]" />
          Activity Timeline
          <span className="ml-1 rounded bg-[#FAF5F0] px-1.5 py-px text-[10px] font-bold text-[#8A7060]">
            {session.iterations.length}
          </span>
        </h2>

        {session.iterations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8DDD4] bg-white py-12">
            <Camera className="h-6 w-6 text-[#D4B8A0]" />
            <p className="mt-2 text-sm text-[#8A7060]">No snapshots recorded</p>
          </div>
        ) : (
          <div className="relative space-y-3">
            <div className="absolute bottom-0 left-[0.55rem] top-0 w-px bg-[#E8DDD4]" />
            {session.iterations.map((iter, i) => (
              <VoiceIterationCard
                key={`${iter.iteration}-${i}`}
                iter={iter}
                index={i}
                sessionId={sessionId}
                token={token}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ── */
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
        <Loader2 className="h-5 w-5 animate-spin text-[#8A7060]" />
        <span className="ml-2 text-sm text-[#6B5046]">Loading session…</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="py-20 text-center">
        <XCircle className="mx-auto h-8 w-8 text-[#5C3D2E]" />
        <p className="mt-3 text-sm text-[#5C3D2E]">{error || "Session not found"}</p>
        <button
          onClick={() => navigate("/app/sessions")}
          className="mt-4 text-sm text-[#9B3C3C] hover:underline"
        >
          Back to sessions
        </button>
      </div>
    );
  }

  // Voice sessions get a different layout — no plan/verification/progress
  if (session.mode === "voice") {
    return (
      <VoiceSessionDetailView
        session={session}
        sessionId={sessionId!}
        token={token!}
        navigate={navigate}
      />
    );
  }

  const cfg = STATUS_CFG[session.status] ?? STATUS_CFG.running;
  const StatusIcon = cfg.icon;
  // const completedSteps =
  //   session.plan?.steps.filter(
  //     (_, i) =>
  //       session.iterations.some(
  //         (it) =>
  //           it.verification?.progress_percent !== undefined &&
  //           it.verification.progress_percent >= ((i + 1) / (session.plan?.total_steps ?? 1)) * 100,
  //       ),
  //   ).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate("/app/sessions")}
          className="mb-3 flex items-center gap-1 text-sm text-[#8A7060] transition-colors hover:text-[#2D2018]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Sessions
        </button>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E8DDD4] bg-white px-5 py-4 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#2D2018]">{session.goal}</h1>
              {session.mode === "voice" && (
                <span className="rounded bg-[#E8DDD4] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5C3D2E]">
                  Voice
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B5046]">
              <span className="font-medium text-[#2D2018]">{session.device_name}</span>
              <span className="text-[#D4B8A0]">|</span>
              <span className="font-mono text-[11px] text-[#8A7060]">
                {session.device_id}
              </span>
              <span className="text-[#D4B8A0]">|</span>
              <span>{new Date(session.started_at).toLocaleString()}</span>
            </div>
          </div>

          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${cfg.bgColor} ${cfg.textColor} border-current/20`}
          >
            <StatusIcon
              className={`h-3.5 w-3.5 ${cfg.iconColor} ${session.status === "running" ? "animate-spin" : ""}`}
            />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Duration",
            value: formatDuration(session.duration_seconds),
            icon: <Clock className="h-3.5 w-3.5 text-[#8A7060]" />,
          },
          {
            label: "Iterations",
            value: session.total_iterations.toString(),
            icon: <Zap className="h-3.5 w-3.5 text-[#8A7060]" />,
          },
          {
            label: "Progress",
            value: `${session.final_verification?.progress_percent ?? 0}%`,
            icon: <Crosshair className="h-3.5 w-3.5 text-[#8A7060]" />,
          },
          {
            label: "Plan Steps",
            value: session.plan?.total_steps.toString() ?? "0",
            icon: <ListChecks className="h-3.5 w-3.5 text-[#8A7060]" />,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[#E8DDD4] bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              {stat.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7060]">
                {stat.label}
              </span>
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums text-[#2D2018]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Plan */}
      {session.plan && (
        <div className="rounded-xl border border-[#E8DDD4] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E8DDD4]/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[#9B3C3C]" />
              <h2 className="text-sm font-semibold text-[#2D2018]">Execution Plan</h2>
            </div>
            <span className="text-[11px] font-medium text-[#8A7060]">
              {session.plan.total_steps} steps
            </span>
          </div>

          {session.plan.reasoning && (
            <p className="border-b border-[#FAF5F0] px-5 py-2.5 text-xs italic text-[#6B5046]">
              {session.plan.reasoning}
            </p>
          )}

          <div className="divide-y divide-[#FAF5F0] px-5">
            {session.plan.steps.map((step) => (
              <div key={step.step_number} className="flex items-start gap-3 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FAF5F0] text-[11px] font-bold text-[#9B3C3C]">
                  {step.step_number}
                </span>
                <div className="min-w-0 text-[12px]">
                  <p className="font-medium text-[#2D2018]">{step.description}</p>
                  {step.expected_state && (
                    <p className="mt-0.5 text-[#8A7060]">
                      Expected: {step.expected_state}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Verification */}
      {session.final_verification && (
        <div
          className={`rounded-xl border p-4 ${
            session.final_verification.status === "complete"
              ? "border-[#C9A48C] bg-[#FAF5F0]"
              : session.final_verification.status === "failed"
                ? "border-[#D4B8A0] bg-[#E8DDD4]"
                : "border-[#E8DDD4] bg-[#FAF5F0]"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2
              className={`flex items-center gap-2 text-sm font-semibold ${
                session.final_verification.status === "complete"
                  ? "text-[#9B3C3C]"
                  : session.final_verification.status === "failed"
                    ? "text-[#5C3D2E]"
                    : "text-[#C9A48C]"
              }`}
            >
              <Crosshair className="h-4 w-4" />
              Final Verification
            </h2>
            <span
              className={`text-lg font-bold ${
                session.final_verification.status === "complete"
                  ? "text-[#9B3C3C]"
                  : session.final_verification.status === "failed"
                    ? "text-[#5C3D2E]"
                    : "text-[#C9A48C]"
              }`}
            >
              {session.final_verification.progress_percent}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
            <div
              className={`h-1.5 rounded-full transition-all ${
                session.final_verification.status === "complete"
                  ? "bg-[#FAF5F0]"
                  : session.final_verification.status === "failed"
                    ? "bg-[#E8DDD4]"
                    : "bg-[#FAF5F0]"
              }`}
              style={{
                width: `${session.final_verification.progress_percent}%`,
              }}
            />
          </div>
          {session.final_verification.reasoning && (
            <p
              className={`mt-2 text-xs leading-relaxed ${
                session.final_verification.status === "complete"
                  ? "text-[#9B3C3C]"
                  : session.final_verification.status === "failed"
                    ? "text-[#5C3D2E]"
                    : "text-[#C9A48C]"
              }`}
            >
              {session.final_verification.reasoning}
            </p>
          )}
        </div>
      )}

      {/* Iteration Timeline */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#2D2018]">
          <Clock className="h-4 w-4 text-[#8A7060]" />
          Iteration Timeline
          <span className="ml-1 rounded bg-[#FAF5F0] px-1.5 py-px text-[10px] font-bold text-[#8A7060]">
            {session.iterations.length}
          </span>
        </h2>

        {session.iterations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8DDD4] bg-white py-12">
            <Clock className="h-6 w-6 text-[#D4B8A0]" />
            <p className="mt-2 text-sm text-[#8A7060]">No iterations recorded</p>
          </div>
        ) : (
          <div className="relative space-y-3">
            {/* Timeline line */}
            <div className="absolute bottom-0 left-[0.55rem] top-0 w-px bg-[#E8DDD4]" />

            {session.iterations.map((iter, i) => (
              <IterationCard
                key={`${iter.iteration}-${i}`}
                iter={iter}
                index={i}
                sessionId={sessionId!}
                token={token!}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
