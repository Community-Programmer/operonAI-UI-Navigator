# ─────────────────────────────────────────────────────────────────────
# Dockerfile — Operon AI Server (FastAPI + ADK + YOLO/EasyOCR)
# ─────────────────────────────────────────────────────────────────────
# Multi-stage build to keep the final image lean.
# Stage 1: install Python deps including heavy ML libraries
# Stage 2: copy only what's needed into a slim runtime image
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ────────────────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy only dependency specification first (layer caching)
COPY server/pyproject.toml ./server/pyproject.toml

# Install dependencies into a virtual environment
# 1) CPU-only PyTorch first (avoids pulling ~5 GB of CUDA libs)
# 2) Install the server package and all deps from pyproject.toml
# 3) Force-replace opencv-python with the headless variant LAST
#    so cv2 binaries are guaranteed to be present
RUN uv venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv pip install --no-cache \
        torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    cd server && \
    uv pip install --no-cache . && \
    uv pip uninstall opencv-python 2>/dev/null || true && \
    uv pip install --no-cache --reinstall opencv-python-headless

# Copy the server source code
COPY server/ ./server/

# ── Stage 2: Runtime ────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# OpenCV and EasyOCR runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy virtual environment and source from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/server /app/server

# Ensure the venv is on PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Expose the FastAPI port
EXPOSE 8000

# Run uvicorn — Cloud Run injects PORT env var, default to 8000
CMD ["sh", "-c", "python -m uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-keep-alive 120"]
