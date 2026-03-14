import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  Zap,
} from "lucide-react";
import type { LogEntry } from "@/types";

type VoiceTab = "chat" | "actions" | "log";

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
  const [activeTab, setActiveTab] = useState<VoiceTab>("chat");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, activeTab]);

  function handleTextSend() {
    if (!textInput.trim()) return;
    sendText(textInput.trim());
    setTextInput("");
  }

  const conversationLogs = logs.filter(
    (l) => l.type === "user_voice" || l.type === "agent_voice" || l.type === "agent_response",
  );
  const toolLogs = logs.filter((l) => l.type === "tool" || l.type === "tool_result");

  const tabs: { key: VoiceTab; label: string; count: number }[] = [
    { key: "chat", label: "Chat", count: conversationLogs.length },
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
            onClick={() => nav(`/app/navigate/${deviceId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-900">Voice</h1>
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
              {listening && (
                <Badge
                  variant="outline"
                  className="border-red-200 bg-red-50 text-[10px] text-red-700"
                >
                  <span className="relative mr-1 flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
                  </span>
                  Listening
                </Badge>
              )}
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">{deviceId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={disconnect}
            >
              <PhoneOff className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-slate-900 text-xs text-white hover:bg-slate-800"
              onClick={connect}
            >
              <Phone className="h-3.5 w-3.5" />
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_420px]">
        {/* Left column: screenshot + mic */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Screenshot */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Live View</span>
              {listening && (
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-red-600">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
                  </span>
                  Mic active
                </span>
              )}
            </div>
            <div className="flex flex-1 items-center justify-center bg-slate-950 p-2">
              {screenshot ? (
                <img
                  src={screenshot}
                  alt="Remote screen"
                  className="max-h-full max-w-full rounded object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <ImageIcon className="h-8 w-8 opacity-30" />
                  <p className="text-xs">
                    {connected
                      ? "Screenshot appears when the agent acts"
                      : "Connect to start voice control"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mic control */}
          <div className="flex items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-3 shadow-sm">
            <button
              onClick={listening ? stopMic : startMic}
              disabled={!connected}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all focus:outline-none disabled:opacity-30 ${
                listening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white hover:shadow-lg"
              }`}
            >
              {listening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-20" />
              )}
              {listening ? (
                <MicOff className="relative z-10 h-5 w-5" />
              ) : (
                <Mic className="relative z-10 h-5 w-5" />
              )}
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {!connected
                  ? "Connect first"
                  : listening
                    ? "Listening… speak a command"
                    : "Click to start speaking"}
              </p>
              <p className="text-[11px] text-slate-400">
                {!connected
                  ? "Press Connect above to begin"
                  : listening
                    ? "The agent hears and responds in real time"
                    : "Or type a message below"}
              </p>
            </div>
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
            {activeTab === "chat" && (
              <div className="p-3">
                {conversationLogs.length === 0 ? (
                  <EmptyState icon={<MessageSquare className="h-6 w-6" />} text="Voice transcript appears here" />
                ) : (
                  <div className="space-y-2">
                    {conversationLogs.map((log) => (
                      <ConversationBubble key={log.id} log={log} />
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
                      <div
                        key={log.id}
                        className={`flex items-start gap-2.5 rounded-lg p-3 ${
                          log.type === "tool_result" ? "bg-emerald-50" : "bg-amber-50"
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            log.type === "tool_result"
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-amber-100 text-amber-600"
                          }`}
                        >
                          {log.type === "tool_result" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            i + 1
                          )}
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
                  <EmptyState icon={<Zap className="h-6 w-6" />} text="Activity will appear here" />
                ) : (
                  <div className="space-y-1">
                    {logs.map((log) => (
                      <VoiceLogItem key={log.id} log={log} />
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

      {/* ── Text input bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTextSend();
          }}
          className="flex items-center gap-3"
        >
          <Input
            placeholder={connected ? "Or type a command…" : "Connect first…"}
            className="border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={!connected}
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 gap-1.5 bg-slate-900 px-4 text-white hover:bg-slate-800"
            disabled={!connected || !textInput.trim()}
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send</span>
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

/* ── Conversation Bubble ── */
function ConversationBubble({ log }: { log: LogEntry }) {
  const isUser = log.type === "user_voice";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[12px] leading-relaxed ${
          isUser
            ? "rounded-br-md bg-slate-900 text-white"
            : "rounded-bl-md bg-blue-50 text-slate-800"
        }`}
      >
        <p className={`mb-0.5 text-[10px] font-bold ${isUser ? "text-slate-400" : "text-blue-500"}`}>
          {isUser ? "You" : "Agent"}
        </p>
        <span className="whitespace-pre-wrap break-words">{log.message}</span>
      </div>
    </div>
  );
}

/* ── Voice Log Item ── */
function VoiceLogItem({ log }: { log: LogEntry }) {
  const styles: Record<string, { icon: React.ReactNode; bg: string }> = {
    user_voice: { icon: <Mic className="h-3 w-3 text-slate-500" />, bg: "" },
    agent_voice: { icon: <Zap className="h-3 w-3 text-blue-500" />, bg: "bg-blue-50/50" },
    agent_response: { icon: <Zap className="h-3 w-3 text-blue-500" />, bg: "bg-blue-50/50" },
    thinking: { icon: <Brain className="h-3 w-3 text-violet-500" />, bg: "bg-violet-50" },
    tool: { icon: <Wrench className="h-3 w-3 text-amber-500" />, bg: "bg-amber-50" },
    tool_result: { icon: <Check className="h-3 w-3 text-emerald-500" />, bg: "bg-emerald-50" },
    error: { icon: <Zap className="h-3 w-3 text-rose-500" />, bg: "bg-rose-50" },
    warning: { icon: <Zap className="h-3 w-3 text-amber-500" />, bg: "bg-amber-50" },
    status: { icon: <Zap className="h-3 w-3 text-slate-400" />, bg: "" },
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
