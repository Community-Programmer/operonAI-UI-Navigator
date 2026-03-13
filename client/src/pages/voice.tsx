import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceSocket } from "@/hooks/use-voice-socket";
import {
  ArrowLeft,
  Brain,
  Check,
  ImageIcon,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import type { LogEntry } from "@/types";

export function VoicePage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { token } = useAuth();
  const nav = useNavigate();
  const {
    connected,
    listening,
    logs,
    screenshot,
    connect,
    disconnect,
    startMic,
    stopMic,
    sendText,
    clearLogs,
  } = useVoiceSocket(token, deviceId ?? null);

  const [textInput, setTextInput] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function handleTextSend() {
    if (!textInput.trim()) return;
    sendText(textInput.trim());
    setTextInput("");
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <Card className="border-slate-200 bg-white/95 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-700 hover:bg-slate-100" onClick={() => nav(`/app/navigate/${deviceId}`)}>
            <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Voice Control</h1>
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
            {connected ? (
              <Button variant="destructive" size="sm" onClick={disconnect}>
                <PhoneOff className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            ) : (
              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={connect}>
                <Phone className="mr-2 h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-h-0 flex-col gap-4">
          <Card className="min-h-0 flex-1 overflow-hidden border-slate-200 bg-white/95 shadow-sm">
            {screenshot ? (
              <div className="flex h-full items-center justify-center bg-black p-2">
                <img
                  src={screenshot}
                  alt="Remote screen"
                  className="max-h-full max-w-full rounded object-contain"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300">
                <ImageIcon className="h-12 w-12 opacity-30" />
                <p className="text-sm">
                  {connected
                    ? "Screenshot will appear when the agent takes one"
                    : "Connect to start voice control"}
                </p>
              </div>
            )}
          </Card>

          <Card className="shrink-0 border-slate-200 bg-white/95 shadow-sm">
            <CardContent className="flex items-center justify-center gap-4 py-4">
              <button
                onClick={listening ? stopMic : startMic}
                disabled={!connected}
                className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all focus:outline-none disabled:opacity-40 ${
                  listening
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {listening && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-25" />
                )}
                {listening ? (
                  <MicOff className="relative z-10 h-7 w-7" />
                ) : (
                  <Mic className="relative z-10 h-7 w-7" />
                )}
              </button>
              <p className="text-sm text-slate-600">
                {!connected
                  ? "Connect first"
                  : listening
                    ? "Listening… speak a command"
                    : "Click to start"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-col overflow-hidden border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="flex-row items-center justify-between py-3">
            <CardTitle className="text-sm text-slate-900">Transcript</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={clearLogs}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <Separator className="bg-slate-200" />
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <div className="space-y-2 py-3">
              {logs.length === 0 && (
                <p className="text-center text-xs text-slate-500">
                  Voice transcript will appear here
                </p>
              )}
              {logs.map((log) => (
                <VoiceLogItem key={log.id} log={log} />
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
              handleTextSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder={connected ? "Or type a command…" : "Connect first…"}
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={!connected}
            />
            <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800" disabled={!connected || !textInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function VoiceLogItem({ log }: { log: LogEntry }) {
  if (log.type === "user_voice") {
    return (
      <div className="flex items-start gap-2 text-xs">
        <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
          You
        </Badge>
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
          {log.message}
        </span>
      </div>
    );
  }

  if (log.type === "agent_voice") {
    return (
      <div className="flex items-start gap-2 text-xs">
        <Badge className="mt-0.5 shrink-0 text-[10px]">Agent</Badge>
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
          {log.message}
        </span>
      </div>
    );
  }

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

  if (log.type === "tool_result") {
    return (
      <div className="flex items-start gap-2 text-xs">
        <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono leading-relaxed text-slate-600">
          {log.message}
        </span>
      </div>
    );
  }

  const variant =
    log.type === "error" || log.type === "warning"
      ? "destructive"
      : log.type === "status"
        ? "secondary"
        : "secondary";

  return (
    <div className="flex items-start gap-2 text-xs">
      <Badge variant={variant} className="mt-0.5 shrink-0 text-[10px]">
        {log.type}
      </Badge>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
        {log.message}
      </span>
    </div>
  );
}
