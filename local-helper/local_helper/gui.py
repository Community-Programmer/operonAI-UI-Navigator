from __future__ import annotations

import asyncio
import base64
import json
import os
import queue
import threading
import time
import tkinter as tk
from tkinter import ttk
from datetime import datetime, timezone

from local_helper.connection import HelperConnection
from local_helper.screen import get_screen_size


class LocalHelperGUI:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Local-Helper")
        self.root.geometry("1080x680")
        self.root.minsize(920, 600)

        self._event_queue: queue.Queue[tuple[str, object]] = queue.Queue()
        self._connection: HelperConnection | None = None
        self._thread: threading.Thread | None = None

        self._configure_style()
        self._build_ui()
        self._seed_defaults()

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.after(100, self._drain_events)

    def _configure_style(self) -> None:
        self.style = ttk.Style(self.root)
        if "vista" in self.style.theme_names():
            self.style.theme_use("vista")
        elif "clam" in self.style.theme_names():
            self.style.theme_use("clam")

        self.style.configure("Root.TFrame", padding=0)
        self.style.configure("HeaderTitle.TLabel", font=("Segoe UI", 18, "bold"))
        self.style.configure("HeaderSub.TLabel", font=("Segoe UI", 10))
        self.style.configure("SectionTitle.TLabel", font=("Segoe UI", 11, "bold"))
        self.style.configure("Status.TLabel", font=("Segoe UI", 10, "bold"))
        self.style.configure("MetricName.TLabel", font=("Segoe UI", 9))
        self.style.configure("MetricValue.TLabel", font=("Segoe UI", 12, "bold"))

        self.style.configure("Primary.TButton", font=("Segoe UI", 10, "bold"), padding=(12, 8))
        self.style.configure("Secondary.TButton", font=("Segoe UI", 10), padding=(10, 8))

    def _build_ui(self) -> None:
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(1, weight=1)

        container = ttk.Frame(self.root, style="Root.TFrame", padding=14)
        container.grid(row=0, column=0, sticky="nsew")
        container.columnconfigure(0, weight=3)
        container.columnconfigure(1, weight=2)
        container.rowconfigure(1, weight=1)

        header = ttk.Frame(container)
        header.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 12))
        header.columnconfigure(0, weight=1)

        ttk.Label(header, text="Local Helper Control Center", style="HeaderTitle.TLabel").grid(
            row=0, column=0, sticky="w"
        )
        ttk.Label(
            header,
            text="Desktop pairing, live activity, and runtime telemetry for UI Navigator",
            style="HeaderSub.TLabel",
        ).grid(row=1, column=0, sticky="w", pady=(2, 0))

        left_col = ttk.Frame(container)
        left_col.grid(row=1, column=0, sticky="nsew", padx=(0, 10))
        left_col.columnconfigure(0, weight=1)
        left_col.rowconfigure(1, weight=1)

        pair_group = ttk.LabelFrame(left_col, text="Device Pairing")
        pair_group.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        pair_group.columnconfigure(0, weight=1)
        pair_group.columnconfigure(1, weight=1)

        ttk.Label(pair_group, text="Server URL (ws:// or wss://)", style="SectionTitle.TLabel").grid(
            row=0, column=0, sticky="w", padx=10, pady=(10, 2)
        )
        self.server_entry = ttk.Entry(pair_group)
        self.server_entry.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 8))

        ttk.Label(pair_group, text="Device Token", style="SectionTitle.TLabel").grid(
            row=0, column=1, sticky="w", padx=10, pady=(10, 2)
        )
        self.token_entry = ttk.Entry(pair_group)
        self.token_entry.grid(row=1, column=1, sticky="ew", padx=10, pady=(0, 8))
        self.token_entry.bind("<KeyRelease>", self._on_token_changed)

        self.status_text = tk.StringVar(value="Disconnected")
        status_row = ttk.Frame(pair_group)
        status_row.grid(row=2, column=0, sticky="w", padx=10, pady=(2, 10))
        ttk.Label(status_row, text="Connection Status:").pack(side="left")
        self.status_dot = tk.Canvas(status_row, width=14, height=14, highlightthickness=0)
        self.status_dot.pack(side="left", padx=6)
        self._dot = self.status_dot.create_oval(1, 1, 13, 13, fill="#cc3333", outline="#9d9d9d")
        ttk.Label(status_row, textvariable=self.status_text, style="Status.TLabel").pack(side="left")

        action_row = ttk.Frame(pair_group)
        action_row.grid(row=2, column=1, sticky="e", padx=10, pady=(2, 10))
        self.clear_button = ttk.Button(
            action_row,
            text="Clear Logs",
            style="Secondary.TButton",
            command=self._clear_logs,
        )
        self.clear_button.pack(side="left", padx=(0, 8))
        self.pair_button = ttk.Button(
            action_row,
            text="Connect Device",
            style="Primary.TButton",
            command=self._toggle_pairing,
        )
        self.pair_button.pack(side="left")

        log_group = ttk.LabelFrame(left_col, text="Activity Feed")
        log_group.grid(row=1, column=0, sticky="nsew")
        log_group.rowconfigure(0, weight=1)
        log_group.columnconfigure(0, weight=1)

        self.log_text = tk.Text(
            log_group,
            height=20,
            wrap="word",
            state="disabled",
            font=("Consolas", 10),
            bg="#111827",
            fg="#E5E7EB",
            insertbackground="#E5E7EB",
            relief="flat",
            padx=10,
            pady=10,
        )
        self.log_text.grid(row=0, column=0, sticky="nsew", padx=(10, 0), pady=10)
        log_scroll = ttk.Scrollbar(log_group, orient="vertical", command=self.log_text.yview)
        log_scroll.grid(row=0, column=1, sticky="ns", padx=(0, 10), pady=10)
        self.log_text.configure(yscrollcommand=log_scroll.set)

        right_col = ttk.Frame(container)
        right_col.grid(row=1, column=1, sticky="nsew")
        right_col.columnconfigure(0, weight=1)

        stats_group = ttk.LabelFrame(right_col, text="Runtime Metrics")
        stats_group.grid(row=0, column=0, sticky="new")
        stats_group.columnconfigure(0, weight=1)

        self.latency_value = tk.StringVar(value="-")
        self.screen_value = tk.StringVar(value="-")
        self.elements_value = tk.StringVar(value="-")
        self.confidence_value = tk.StringVar(value="-")

        self._metric_row(stats_group, 0, "Latency", self.latency_value)
        self._metric_row(stats_group, 1, "Screen", self.screen_value)
        self._metric_row(stats_group, 2, "Detected Elements", self.elements_value)
        self._metric_row(stats_group, 3, "Avg Confidence", self.confidence_value)

        notes_group = ttk.LabelFrame(right_col, text="Session Notes")
        notes_group.grid(row=1, column=0, sticky="new", pady=(10, 0))
        notes_group.columnconfigure(0, weight=1)

        ttk.Label(
            notes_group,
            text=(
                "1. Enter server URL and device token.\n"
                "2. Connect the device.\n"
                "3. Monitor actions and metrics in real time."
            ),
            justify="left",
        ).grid(row=0, column=0, sticky="w", padx=10, pady=10)

        details_group = ttk.LabelFrame(right_col, text="Paired Device Details")
        details_group.grid(row=2, column=0, sticky="new", pady=(10, 0))
        details_group.columnconfigure(0, weight=1)

        self.device_id_value = tk.StringVar(value="-")
        self.device_name_value = tk.StringVar(value="-")
        self.session_duration_value = tk.StringVar(value="-")
        self.session_expiration_value = tk.StringVar(value="-")

        self._metric_row(details_group, 0, "Device ID", self.device_id_value)
        self._metric_row(details_group, 1, "Device Name", self.device_name_value)
        self._metric_row(details_group, 2, "Session Duration", self.session_duration_value)
        self._metric_row(details_group, 3, "Session Expires", self.session_expiration_value)

        self._append_log("Local helper ready. Enter server URL and device token to pair.")

    def _metric_row(self, parent: ttk.LabelFrame, row: int, label: str, value_var: tk.StringVar) -> None:
        row_frame = ttk.Frame(parent)
        row_frame.grid(row=row, column=0, sticky="ew", padx=10, pady=(10 if row == 0 else 6, 0))
        row_frame.columnconfigure(0, weight=1)
        ttk.Label(row_frame, text=label, style="MetricName.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(row_frame, textvariable=value_var, style="MetricValue.TLabel").grid(row=1, column=0, sticky="w")

    def _seed_defaults(self) -> None:
        server_url = os.getenv("SERVER_URL", "ws://localhost:8000").strip()
        token = os.getenv("DEVICE_TOKEN", "").strip()
        self.server_entry.insert(0, server_url)
        if token:
            self.token_entry.insert(0, token)
            self._populate_token_details(token)

        width, height = get_screen_size()
        self.screen_value.set(f"{width} x {height}")

    def _sanitize_server_url(self, value: str) -> str:
        server_url = value.strip()
        if server_url.startswith("http://"):
            server_url = server_url.replace("http://", "ws://", 1)
        elif server_url.startswith("https://"):
            server_url = server_url.replace("https://", "wss://", 1)
        elif not server_url.startswith("ws://") and not server_url.startswith("wss://"):
            server_url = "ws://" + server_url
        return server_url.rstrip("/")

    def _on_token_changed(self, _event=None) -> None:
        self._populate_token_details(self.token_entry.get().strip())

    def _populate_token_details(self, token: str) -> None:
        payload = self._decode_jwt_payload(token)
        if not payload:
            self.device_id_value.set("-")
            self.device_name_value.set("-")
            self.session_duration_value.set("-")
            self.session_expiration_value.set("-")
            return

        self.device_id_value.set(str(payload.get("device_id", "-")))
        self.device_name_value.set(str(payload.get("device_name", "-")))

        minutes = payload.get("session_minutes")
        if minutes is None:
            self.session_duration_value.set("-")
        else:
            self.session_duration_value.set(f"{minutes} minutes")

        expires = payload.get("session_expires_at")
        self.session_expiration_value.set(self._format_session_expiration(expires))

    def _format_session_expiration(self, expires: object) -> str:
        if not isinstance(expires, str) or not expires:
            return "-"
        try:
            normalized = expires.replace("Z", "+00:00")
            dt = datetime.fromisoformat(normalized)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            local_dt = dt.astimezone()
            return local_dt.strftime("%b %d, %Y %I:%M %p")
        except ValueError:
            return expires

    def _decode_jwt_payload(self, token: str) -> dict | None:
        try:
            parts = token.split(".")
            if len(parts) < 2:
                return None
            payload_b64 = parts[1]
            padding = "=" * (-len(payload_b64) % 4)
            decoded = base64.urlsafe_b64decode((payload_b64 + padding).encode("utf-8"))
            return json.loads(decoded.decode("utf-8"))
        except Exception:
            return None

    def _toggle_pairing(self) -> None:
        if self._connection is not None:
            self._disconnect()
            return

        server_url = self._sanitize_server_url(self.server_entry.get())
        token = self.token_entry.get().strip()

        if not server_url or not token:
            self._append_log("Server URL and token are required.")
            return

        self._populate_token_details(token)

        self._append_log(f"Connecting to {server_url} ...")

        self._connection = HelperConnection(
            server_url=server_url,
            token=token,
            on_log=self._enqueue_log,
            on_connection_change=self._enqueue_connection,
            on_metrics=self._enqueue_metrics,
        )

        self._thread = threading.Thread(target=self._run_connection, daemon=True)
        self._thread.start()

        self.pair_button.configure(text="Disconnect")

    def _run_connection(self) -> None:
        try:
            asyncio.run(self._connection.connect())
        except Exception as exc:
            self._enqueue_log(f"Connection worker failed: {exc}")
        finally:
            self._enqueue_connection(False)
            self._event_queue.put(("stopped", None))

    def _disconnect(self) -> None:
        if self._connection is None:
            return
        self._append_log("Disconnecting local helper...")
        self._connection.stop()

    def _clear_logs(self) -> None:
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")
        self._append_log("Activity log cleared.")

    def _enqueue_log(self, message: str) -> None:
        self._event_queue.put(("log", message))

    def _enqueue_connection(self, connected: bool) -> None:
        self._event_queue.put(("connected", connected))

    def _enqueue_metrics(self, metrics: dict) -> None:
        self._event_queue.put(("metrics", metrics))

    def _drain_events(self) -> None:
        while True:
            try:
                event_type, payload = self._event_queue.get_nowait()
            except queue.Empty:
                break

            if event_type == "log":
                self._append_log(str(payload))
            elif event_type == "connected":
                self._set_connected(bool(payload))
            elif event_type == "metrics":
                self._apply_metrics(payload if isinstance(payload, dict) else {})
            elif event_type == "stopped":
                self._connection = None
                self._thread = None
                self.pair_button.configure(text="Connect Device")

        self.root.after(100, self._drain_events)

    def _set_connected(self, connected: bool) -> None:
        color = "#2fa64a" if connected else "#cc3333"
        self.status_dot.itemconfig(self._dot, fill=color)
        self.status_text.set("Paired" if connected else "Disconnected")

    def _apply_metrics(self, metrics: dict) -> None:
        rtt = int(metrics.get("rtt_ms", 0))
        seg = int(metrics.get("segmentation_ms", 0))
        elements = int(metrics.get("num_elements", 0))
        avg_conf = float(metrics.get("avg_confidence", 0.0))

        self.latency_value.set(f"{rtt} ms RTT / {seg} ms segmentation")
        self.elements_value.set(str(elements))
        self.confidence_value.set(f"{int(avg_conf * 100)}%")

    def _append_log(self, message: str) -> None:
        timestamp = time.strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}\n"
        self.log_text.configure(state="normal")
        self.log_text.insert("end", line)
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _on_close(self) -> None:
        self._disconnect()
        self.root.after(150, self.root.destroy)


def run_gui() -> None:
    root = tk.Tk()
    LocalHelperGUI(root)
    root.mainloop()
