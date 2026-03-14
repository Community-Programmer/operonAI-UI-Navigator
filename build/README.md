# Operon AI — Local Agent

> Desktop companion for Operon AI. Pairs your machine with the cloud orchestrator, streams live screenshots, executes UI automation commands, and displays real-time telemetry — all from a single lightweight executable.

---

## Quick Start

### Windows

1. Double-click **`OperonAI.exe`**.
2. Enter the **Server URL** (e.g. `ws://your-server:8000`) and your **Device Token**.
3. Click **Connect Device**.

### Linux

```bash
chmod +x OperonAI-linux
./OperonAI-linux
```

### macOS

```bash
chmod +x OperonAI-mac
./OperonAI-mac
```

> **Environment variables** — You can also pre-fill values by setting `SERVER_URL` and `DEVICE_TOKEN` before launching.

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Device Pairing** | Authenticates with the server via a signed JWT device token over WebSockets. |
| **Live Screen Streaming** | Periodically captures and pushes screenshots to the orchestrator for real-time device monitoring. |
| **Remote Command Execution** | Receives and executes UI automation commands (click, type, scroll, etc.) from the server. |
| **Segmentation** | Sends screenshots to the server's segmentation API and displays detected element counts and confidence scores. |
| **Runtime Metrics** | Shows latency, screen resolution, element count, and average confidence in real time. |
| **Colored Activity Feed** | Console-style log with color-coded entries: green (success), red (error), amber (warnings), blue (info). |

---

## Building from Source

### Prerequisites

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** package manager (recommended) or pip
- Platform-specific build tools (see below)

### Install Dependencies

```bash
cd local-helper
uv sync          # or: pip install -e .
```

### Build

**Windows:**

```cmd
cd local-helper
build.bat
```

**Linux / macOS:**

```bash
cd local-helper
bash build.sh
```

The build output is placed in the `build/` directory:

| Platform | Output |
|----------|--------|
| Windows  | `build/OperonAI.exe` |
| Linux    | `build/OperonAI-linux` |
| macOS    | `build/OperonAI-mac` |

> **Note:** PyInstaller does not support cross-compilation. You must build on the target platform.

### Custom Icon

Place platform-specific icons in `local-helper/assets/`:

- `logo.ico` — Windows executable icon
- `logo.icns` — macOS executable icon
- `logo.png` — Used as the in-app header logo and window icon (required)

---

## Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `SERVER_URL` | `ws://localhost:8000` | WebSocket URL of the Operon AI orchestrator |
| `DEVICE_TOKEN` | *(empty)* | JWT token issued by the server for device authentication |

Create a `.env` file in the same directory as the executable (or in `local-helper/` during development) to set these automatically.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Ensure no antivirus is blocking the executable. On Linux/macOS, verify execute permissions (`chmod +x`). |
| "Connection refused" | Check that the server is running and the URL is correct. |
| Token rejected | Tokens expire — generate a fresh one from the server dashboard. |
| High latency | The segmentation API runs server-side. Check server load and network. |
| Missing logo | Ensure `assets/logo.png` exists. For bundled builds, it is embedded automatically. |

---


