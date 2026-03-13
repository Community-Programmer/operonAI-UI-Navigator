import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEntry } from "@/types";
import { wsUrl } from "@/lib/api";

export interface VoiceSocketState {
  connected: boolean;
  listening: boolean;
  logs: LogEntry[];
  screenshot: string | null;
}

/**
 * Decode a base64 (or base64url) string to an ArrayBuffer of Int16 PCM.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Convert base64url to standard base64
  let std = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (std.length % 4) std += "=";
  const bin = atob(std);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function useVoiceSocket(
  token: string | null,
  deviceId: string | null,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlayerNodeRef = useRef<AudioWorkletNode | null>(null);
  const recorderContextRef = useRef<AudioContext | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);

  // Transcription accumulation — track the current partial transcription
  // so we update the same log entry instead of creating one per fragment
  const inputTranscriptIdRef = useRef<string | null>(null);
  const outputTranscriptIdRef = useRef<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // ── Add log entry ─────────────────────────────────────────────
  const addLog = useCallback(
    (type: LogEntry["type"], message: string, author?: string) => {
      const id = crypto.randomUUID();
      setLogs((prev) => [
        ...prev,
        { id, timestamp: Date.now(), type, message, author },
      ]);
      return id;
    },
    [],
  );

  // ── Update or create a log entry (for transcription accumulation) ──
  const upsertLog = useCallback(
    (
      existingId: string | null,
      type: LogEntry["type"],
      message: string,
      author?: string,
    ): string => {
      if (existingId) {
        // Update the existing log entry's message
        setLogs((prev) =>
          prev.map((entry) =>
            entry.id === existingId ? { ...entry, message } : entry,
          ),
        );
        return existingId;
      }
      // No existing entry — create a new one
      const id = crypto.randomUUID();
      setLogs((prev) => [
        ...prev,
        { id, timestamp: Date.now(), type, message, author },
      ]);
      return id;
    },
    [],
  );

  // ── Ensure AudioContext is running (browser autoplay policy) ───
  const ensureAudioPlaying = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Ignore — will resume on next user gesture
      }
    }
  }, []);

  // ── Setup audio player worklet (24kHz output) ─────────────────
  const setupPlayback = useCallback(async () => {
    if (audioContextRef.current) return;

    const ctx = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = ctx;

    // PCM player worklet processor code (runs in audio thread)
    const processorCode = `
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 24000 * 180;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.port.onmessage = (event) => {
      if (event.data.command === 'endOfAudio') {
        this.readIndex = this.writeIndex;
        return;
      }
      const int16Samples = new Int16Array(event.data);
      for (let i = 0; i < int16Samples.length; i++) {
        const floatVal = int16Samples[i] / 32768;
        this.buffer[this.writeIndex] = floatVal;
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
        if (this.writeIndex === this.readIndex) {
          this.readIndex = (this.readIndex + 1) % this.bufferSize;
        }
      }
    };
  }
  process(inputs, outputs) {
    const output = outputs[0];
    const framesPerBlock = output[0].length;
    for (let frame = 0; frame < framesPerBlock; frame++) {
      output[0][frame] = this.buffer[this.readIndex];
      if (output.length > 1) output[1][frame] = this.buffer[this.readIndex];
      if (this.readIndex !== this.writeIndex) {
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }
    }
    return true;
  }
}
registerProcessor('pcm-player-processor', PCMPlayerProcessor);
`;
    const blob = new Blob([processorCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const node = new AudioWorkletNode(ctx, "pcm-player-processor");
    node.connect(ctx.destination);
    audioPlayerNodeRef.current = node;
  }, []);

  // ── Connect the voice WebSocket ───────────────────────────────
  const connect = useCallback(async () => {
    if (!token || !deviceId) return;
    if (wsRef.current) return;

    await setupPlayback();

    const url = wsUrl("/ws/voice", token, { device_id: deviceId });
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      addLog("status", "Voice connection established");
    };

    ws.onclose = (ev) => {
      setConnected(false);
      setListening(false);
      wsRef.current = null;
      addLog("status", `Voice connection closed (${ev.code})`);
      stopMic();
    };

    ws.onerror = () => {
      addLog("error", "Voice connection error");
    };

    ws.onmessage = (e) => {
      // All frames are JSON text (matching bidi-demo pattern)
      try {
        const event = JSON.parse(e.data as string);

        // Custom screenshot message from take_screenshot tool
        if (event.type === "screenshot" && event.image) {
          setScreenshot(`data:image/jpeg;base64,${event.image}`);
          addLog("tool", "Screenshot captured");
          return;
        }

        // Handle turn complete — finalize current transcription entries
        if (event.turnComplete) {
          inputTranscriptIdRef.current = null;
          outputTranscriptIdRef.current = null;
          return;
        }

        // Handle interrupted — immediately clear audio buffer
        if (event.interrupted) {
          audioPlayerNodeRef.current?.port.postMessage({ command: "endOfAudio" });
          // Reset transcript tracking for the interrupted turn
          outputTranscriptIdRef.current = null;
          return;
        }

        // Input transcription (user speech → text) — accumulate into one entry
        if (event.inputTranscription?.text) {
          inputTranscriptIdRef.current = upsertLog(
            inputTranscriptIdRef.current,
            "user_voice",
            event.inputTranscription.text,
            "user",
          );
          // If this transcription is finished, reset for next utterance
          if (event.inputTranscription.finished) {
            inputTranscriptIdRef.current = null;
          }
        }

        // Output transcription (agent speech → text) — accumulate into one entry
        if (event.outputTranscription?.text) {
          outputTranscriptIdRef.current = upsertLog(
            outputTranscriptIdRef.current,
            "agent_voice",
            event.outputTranscription.text,
            "voice_navigator",
          );
          // If this transcription is finished, reset for next utterance
          if (event.outputTranscription.finished) {
            outputTranscriptIdRef.current = null;
          }
        }

        // Content events (audio and/or text)
        if (event.content?.parts) {
          for (const part of event.content.parts) {
            // Audio: decode base64 inline_data and play
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || "";
              if (mimeType.startsWith("audio/pcm") && audioPlayerNodeRef.current) {
                // Ensure AudioContext is running before feeding audio
                ensureAudioPlaying();
                const pcmBuffer = base64ToArrayBuffer(part.inlineData.data);
                audioPlayerNodeRef.current.port.postMessage(pcmBuffer);
              }
            }

            // Text content
            if (part.text && !event.partial) {
              addLog("agent_response", part.text, event.author);
            }

            // Function calls (tool invocations)
            if (part.functionCall) {
              const args = part.functionCall.args
                ? Object.entries(part.functionCall.args)
                    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                    .join(", ")
                : "";
              addLog("tool", `${part.functionCall.name}(${args})`, event.author);
            }

            // Function responses (tool results)
            if (part.functionResponse) {
              const resp = part.functionResponse.response;
              const name = part.functionResponse.name || "tool";
              const status = resp?.status || "done";
              const msg = resp?.message || resp?.error || "";
              const summary = msg ? `${name}: ${msg}` : `${name}: ${status}`;
              addLog("tool_result", summary, event.author);
            }
          }
        }

        // Error
        if (event.errorCode) {
          addLog("error", `${event.errorCode}: ${event.errorMessage ?? "Unknown error"}`);
        }
      } catch {
        // Ignore parse errors
      }
    };
  }, [token, deviceId, setupPlayback, addLog, upsertLog, ensureAudioPlaying]);

  // ── Start microphone capture and stream audio ─────────────────
  const startMic = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (mediaStreamRef.current) return;

    // Resume playback AudioContext on user gesture (mic button click)
    await ensureAudioPlaying();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      mediaStreamRef.current = stream;

      // PCM recorder worklet processor code (runs in audio thread)
      const recorderCode = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    if (inputs.length > 0 && inputs[0].length > 0) {
      const inputCopy = new Float32Array(inputs[0][0]);
      this.port.postMessage(inputCopy);
    }
    return true;
  }
}
registerProcessor('pcm-recorder-processor', PCMProcessor);
`;
      const recCtx = new AudioContext({ sampleRate: 16000 });
      recorderContextRef.current = recCtx;

      const blob = new Blob([recorderCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await recCtx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const source = recCtx.createMediaStreamSource(stream);
      const recorderNode = new AudioWorkletNode(recCtx, "pcm-recorder-processor");
      recorderNodeRef.current = recorderNode;

      source.connect(recorderNode);

      recorderNode.port.onmessage = (event: MessageEvent) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        // Convert Float32 → Int16 PCM
        const float32: Float32Array = event.data;
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = float32[i] * 0x7fff;
        }
        wsRef.current.send(int16.buffer);
      };

      setListening(true);
      addLog("status", "Microphone active — speak to control the desktop");
    } catch (err) {
      addLog("error", `Microphone access denied: ${err}`);
    }
  }, [addLog, ensureAudioPlaying]);

  // ── Stop microphone ───────────────────────────────────────────
  const stopMic = useCallback(() => {
    if (recorderNodeRef.current) {
      recorderNodeRef.current.disconnect();
      recorderNodeRef.current = null;
    }
    if (recorderContextRef.current) {
      recorderContextRef.current.close();
      recorderContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setListening(false);
  }, []);

  // ── Disconnect ────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    stopMic();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);

    // Cleanup playback
    if (audioPlayerNodeRef.current) {
      audioPlayerNodeRef.current.disconnect();
      audioPlayerNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [stopMic]);

  // ── Send a text message (alternative to voice) ────────────────
  const sendText = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(JSON.stringify({ type: "text", text }));
      addLog("user_voice", text, "user");
    },
    [addLog],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (audioPlayerNodeRef.current) {
        audioPlayerNodeRef.current.disconnect();
        audioPlayerNodeRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopMic]);

  return {
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
  };
}
