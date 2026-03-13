import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardSocket } from "@/hooks/use-dashboard-socket";
import {
  ArrowLeft,
  Brain,
  ImageOff,
  Loader2,
  Mic,
  OctagonX,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import type { LogEntry } from "@/types";

export function NavigatePage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { connected, screenshot, logs, taskRunning, navigate: sendGoal, stop, clearLogs } =
    useDashboardSocket(token);

  const [goal, setGoal] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function handleSend() {
    console.log("[handleSend] called", { goal, deviceId, connected, taskRunning });
    if (!goal.trim() || !deviceId) {
      console.log("[handleSend] blocked — empty goal or no deviceId");
      return;
    }
    console.log("[handleSend] sending goal:", goal.trim(), "to device:", deviceId);
    sendGoal(goal.trim(), deviceId);
    setGoal("");
  }

  function handleStop() {
    if (!deviceId) return;
    stop(deviceId);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <Card className="border-slate-200 bg-white/95 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-700 hover:bg-slate-100" onClick={() => navigate("/app/devices")}>
            <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Navigate Control</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                  {deviceId}
                </span>
                <span className="flex items-center gap-1.5">
                  {connected ? (
                    <>
                      <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                      Connected
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-rose-500" />
                      Disconnected
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {taskRunning ? (
              <Button variant="destructive" size="sm" onClick={handleStop}>
                <OctagonX className="mr-2 h-4 w-4" />
                Stop Task
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                onClick={() => navigate(`/app/voice/${deviceId}`)}
              >
                <Mic className="mr-2 h-4 w-4" />
                Voice Control
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="flex flex-col overflow-hidden border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="shrink-0 py-3">
            <CardTitle className="text-sm text-slate-900">Live View</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center overflow-hidden bg-slate-950 p-2">
            {screenshot ? (
              <img
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Device screen"
                className="max-h-full max-w-full rounded object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-300">
                <ImageOff className="h-10 w-10" />
                <p className="text-sm">No screenshot yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="flex-row items-center justify-between py-3">
            <CardTitle className="text-sm text-slate-900">Activity Log</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={clearLogs}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <Separator className="bg-slate-200" />
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <div className="space-y-2 py-3">
              {logs.length === 0 && (
                <p className="text-center text-xs text-slate-500">
                  Enter a goal below to get started
                </p>
              )}
              {logs.map((log) => (
                <LogItem key={log.id} log={log} />
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="shrink-0 border-slate-200 bg-white/95 shadow-sm">
        <CardContent className="py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("[form] onSubmit fired");
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder={taskRunning ? "Task in progress…" : "Describe what you want to do…"}
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={taskRunning || !connected}
            />
            <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800" disabled={taskRunning || !connected || !goal.trim()}>
              {taskRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  if (log.type === "thinking") {
    return (
      <div className="flex items-start gap-2 rounded-md bg-slate-100 p-2 text-xs">
        <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed text-slate-600">
          {log.message}
        </span>
      </div>
    );
  }

  if (log.type === "tool") {
    return (
      <div className="flex items-start gap-2 text-xs">
        <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono leading-relaxed text-slate-600">
          {log.message}
        </span>
      </div>
    );
  }

  const variant =
    log.type === "error" || log.type === "warning"
      ? "destructive"
      : log.type === "done"
        ? "default"
        : "secondary";

  return (
    <div className="flex items-start gap-2 text-xs">
      <Badge variant={variant} className="mt-0.5 shrink-0 text-[10px]">
        {log.type === "agent_response" ? "response" : log.type}
      </Badge>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
        {log.message}
      </span>
    </div>
  );
}
