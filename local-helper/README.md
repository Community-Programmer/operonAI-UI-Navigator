## Local Helper (Desktop GUI)

The local helper is now a lightweight desktop GUI client.

### What it does

- Connects to the orchestrator over WebSocket.
- Executes desktop automation commands locally (click/type/scroll/hotkeys).
- Captures screenshots locally.
- Sends screenshots to the server for UI segmentation (model inference is no longer local).

### Run

```bash
uv run python main.py
```

### Required environment variables

- `SERVER_URL` (example: `ws://localhost:8000`)
- `DEVICE_TOKEN`

You can also enter these values directly in the GUI.
