import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardEvent, LogEntry, NavigateMessage, StopMessage } from "@/types";
import { wsUrl } from "@/lib/api";

export function useDashboardSocket(token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [taskRunning, setTaskRunning] = useState(false);

  // Connect / disconnect lifecycle
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const ws = new WebSocket(wsUrl("/ws/dashboard", token));
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      console.log("[ws] connected");
      setConnected(true);
    };
    ws.onclose = (ev) => {
      if (cancelled) return;
      console.log("[ws] closed", ev.code, ev.reason);
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = (ev) => {
      if (cancelled) return;
      console.error("[ws] error", ev);
    };

    ws.onmessage = (e) => {
      if (cancelled) return;
      try {
        const event: DashboardEvent = JSON.parse(e.data as string);
        console.log("[ws message]", event.type, event.data);
        handleEvent(event);
      } catch (err) {
        console.error("[ws message] parse error", err);
      }
    };

    return () => {
      cancelled = true;
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleEvent(event: DashboardEvent) {
    switch (event.type) {
      case "screenshot":
        setScreenshot(event.data.image as string);
        break;
      case "log": {
        const action = event.data.action as string | undefined;
        const message = (event.data.message as string) ?? "";

        // Skip empty messages
        if (!message.trim()) break;

        if (action === "agent_response") {
          addLog("agent_response", message, event.data.author as string);
        } else if (action === "thinking") {
          addLog("thinking", message, event.data.author as string);
        } else if (action === "warning") {
          addLog("warning", message);
        } else {
          // Tool actions (click, write, press, hotkey, scroll, etc.)
          addLog("tool", message);
        }
        break;
      }
      case "status":
        addLog("status", (event.data.message as string) ?? JSON.stringify(event.data));
        if (event.data.online !== undefined) {
          // device availability changed — no special handling needed
        }
        break;
      case "error":
        addLog("error", (event.data.message as string) ?? "Unknown error");
        setTaskRunning(false);
        break;
      case "done":
        addLog("done", (event.data.message as string) ?? "Done");
        setTaskRunning(false);
        break;
    }
  }

  function addLog(type: LogEntry["type"], message: string, author?: string) {
    setLogs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: Date.now(), type, message, author },
    ]);
  }

  const navigate = useCallback(
    (goal: string, deviceId: string) => {
      console.log("[ws navigate] called", { goal, deviceId, ws: wsRef.current?.readyState });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn("[ws navigate] WebSocket not open, readyState:", wsRef.current?.readyState);
        return;
      }
      const msg: NavigateMessage = { type: "navigate", goal, device_id: deviceId };
      console.log("[ws navigate] sending:", msg);
      wsRef.current.send(JSON.stringify(msg));
      setTaskRunning(true);
      setLogs([]);
    },
    [],
  );

  const stop = useCallback(
    (deviceId: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const msg: StopMessage = { type: "stop", device_id: deviceId };
      wsRef.current.send(JSON.stringify(msg));
    },
    [],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  return { connected, screenshot, logs, taskRunning, navigate, stop, clearLogs };
}
