import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardSocket } from "@/hooks/use-dashboard-socket";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Circle,
  ImageOff,
  ListChecks,
  Loader2,
  Mic,
  OctagonX,
  PlayCircle,
  Send,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  Zap,
} from "lucide-react";
import type { LogEntry, Plan, VerificationResult } from "@/types";

type Tab = "plan" | "reasoning" | "actions" | "log";

export function NavigatePage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const {
    connected,
    screenshot,
    logs,
    taskRunning,
    plan,
    verification,
    navigate: sendGoal,
    stop,
    clearLogs,
  } = useDashboardSocket(token);

  const [goal, setGoal] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, activeTab]);

  // Auto-switch tab when new data arrives
  useEffect(() => {
    if (plan) setActiveTab("plan");
  }, [plan]);

  function handleSend() {
    if (!goal.trim() || !deviceId) return;
    sendGoal(goal.trim(), deviceId);
    setGoal("");
  }

  function handleStop() {
    if (!deviceId) return;
    stop(deviceId);
  }

  const thinkingLogs = logs.filter((l) => l.type === "thinking");
  const toolLogs = logs.filter((l) => l.type === "tool");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "plan", label: "Plan", count: plan?.steps.length ?? 0 },
    { key: "reasoning", label: "Reasoning", count: thinkingLogs.length },
    { key: "actions", label: "Actions", count: toolLogs.length },
    { key: "log", label: "Log", count: logs.length },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
            onClick={() => navigate("/app/devices")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-900">Navigate</h1>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  connected
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {connected ? (
                  <><Wifi className="mr-1 h-3 w-3" /> Connected</>
                ) : (
                  <><WifiOff className="mr-1 h-3 w-3" /> Disconnected</>
                )}
              </Badge>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">{deviceId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {taskRunning && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleStop}
            >
              <OctagonX className="h-3.5 w-3.5" />
              Stop
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-slate-200 text-xs"
            onClick={() => navigate(`/app/voice/${deviceId}`)}
          >
            <Mic className="h-3.5 w-3.5" />
            Voice
          </Button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_420px]">
        {/* Left: screenshot */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Live View</span>
            {taskRunning && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-blue-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-600" />
                </span>
                Agent active
              </span>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center bg-slate-950 p-2">
            {screenshot ? (
              <img
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Device screen"
                className="max-h-full max-w-full rounded object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <ImageOff className="h-8 w-8 opacity-40" />
                <p className="text-xs">Waiting for screenshot…</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: tabbed execution panel */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Tabs */}
          <div className="flex shrink-0 border-b border-slate-100">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                      activeTab === tab.key
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "plan" && (
              <PlanContent plan={plan} verification={verification} taskRunning={taskRunning} />
            )}
            {activeTab === "reasoning" && (
              <div className="p-3">
                {thinkingLogs.length === 0 ? (
                  <EmptyState icon={<Brain className="h-6 w-6" />} text="Reasoning will appear when the agent thinks" />
                ) : (
                  <div className="space-y-2">
                    {thinkingLogs.map((log, i) => (
                      <div key={log.id} className="rounded-lg bg-violet-50 p-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <Brain className="h-3 w-3 text-violet-500" />
                          <span className="text-[10px] font-bold uppercase text-violet-500">
                            Thought {i + 1}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">
                          {log.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === "actions" && (
              <div className="p-3">
                {toolLogs.length === 0 ? (
                  <EmptyState icon={<Wrench className="h-6 w-6" />} text="Tool calls will appear here" />
                ) : (
                  <div className="space-y-1.5">
                    {toolLogs.map((log, i) => (
                      <div key={log.id} className="flex items-start gap-2.5 rounded-lg bg-blue-50 p-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                          {i + 1}
                        </div>
                        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-slate-700">
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === "log" && (
              <div className="p-3">
                {logs.length === 0 ? (
                  <EmptyState icon={<Zap className="h-6 w-6" />} text="Enter a goal below to get started" />
                ) : (
                  <div className="space-y-1">
                    {logs.map((log) => (
                      <LogItem key={log.id} log={log} />
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {logs.length > 0 && (
            <div className="shrink-0 border-t border-slate-100 px-3 py-1.5">
              <button
                onClick={clearLogs}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3"
        >
          <Input
            placeholder={
              taskRunning
                ? "Task in progress…"
                : connected
                  ? "Describe what you want the agent to do…"
                  : "Waiting for connection…"
            }
            className="border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={taskRunning || !connected}
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 gap-1.5 bg-slate-900 px-4 text-white hover:bg-slate-800"
            disabled={taskRunning || !connected || !goal.trim()}
          >
            {taskRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Execute</span>
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
      {icon}
      <p className="mt-2 text-xs text-slate-400">{text}</p>
    </div>
  );
}

/* ── Log Item ── */
function LogItem({ log }: { log: LogEntry }) {
  const styles: Record<string, { icon: React.ReactNode; bg: string }> = {
    thinking: { icon: <Brain className="h-3 w-3 text-violet-500" />, bg: "bg-violet-50" },
    tool: { icon: <Wrench className="h-3 w-3 text-blue-500" />, bg: "bg-blue-50" },
    error: { icon: <OctagonX className="h-3 w-3 text-rose-500" />, bg: "bg-rose-50" },
    warning: { icon: <OctagonX className="h-3 w-3 text-amber-500" />, bg: "bg-amber-50" },
    done: { icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" />, bg: "bg-emerald-50" },
    agent_response: { icon: <Zap className="h-3 w-3 text-blue-500" />, bg: "bg-blue-50/50" },
    status: { icon: <Circle className="h-3 w-3 text-slate-400" />, bg: "" },
  };

  const style = styles[log.type] ?? styles.status;

  return (
    <div className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-[11px] ${style.bg}`}>
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
        {log.message}
      </span>
    </div>
  );
}

/* ── Plan Content ── */
function PlanContent({
  plan,
  verification,
  taskRunning,
}: {
  plan: Plan | null;
  verification: VerificationResult | null;
  taskRunning: boolean;
}) {
  if (!plan && !taskRunning) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListChecks className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-xs font-medium text-slate-500">No active plan</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Submit a goal to see the step-by-step plan
        </p>
      </div>
    );
  }

  if (!plan && taskRunning) {
    return (
      <div className="flex items-center gap-3 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        <div>
          <p className="text-xs font-semibold text-slate-700">Planning…</p>
          <p className="text-[11px] text-slate-400">Analyzing your request</p>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const completedCount = plan.steps.filter((s) => s.completed).length;
  const progress =
    plan.steps.length > 0
      ? Math.round((completedCount / plan.steps.length) * 100)
      : 0;

  return (
    <div>
      {/* Progress header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-[11px] font-medium text-slate-500">
          {completedCount}/{plan.steps.length} steps completed
        </span>
        <div className="flex items-center gap-2">
          {verification && (
            <Badge
              variant="outline"
              className={`text-[10px] ${
                verification.status === "complete"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : verification.status === "failed"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
              }`}
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              {verification.progress_percent}%
            </Badge>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-0.5 p-3">
        {plan.steps.map((step) => {
          const isCurrent = step.step_number === plan.current_step && !step.completed;
          return (
            <div
              key={step.step_number}
              className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[12px] transition-colors ${
                step.completed
                  ? "text-slate-400"
                  : isCurrent
                    ? "bg-blue-50/80 text-slate-800"
                    : "text-slate-500"
              }`}
            >
              {step.completed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : isCurrent ? (
                <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
              )}
              <div className="min-w-0 flex-1">
                <span className={step.completed ? "line-through" : "font-medium"}>
                  {step.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification reasoning */}
      {verification?.reasoning && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-600">Verification: </span>
            {verification.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
