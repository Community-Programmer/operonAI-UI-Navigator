#!/usr/bin/env bash
# ============================================================
#  Operon AI — Local Agent  |  Linux / macOS build script
#  Produces: ../build/OperonAI  (or OperonAI.app on macOS)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "===================================="
echo "  Building Operon AI ($(uname -s))"
echo "===================================="
echo ""

# Activate venv if present
if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
fi

# Run PyInstaller
pyinstaller --clean --noconfirm operon.spec

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Build failed."
    exit 1
fi

# Move output to build folder
mkdir -p "../build"

OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
    # macOS — copy the single-file executable
    cp -f "dist/OperonAI" "../build/OperonAI-mac"
    echo ""
    echo "[OK] Build complete: build/OperonAI-mac"
else
    cp -f "dist/OperonAI" "../build/OperonAI-linux"
    echo ""
    echo "[OK] Build complete: build/OperonAI-linux"
fi

echo ""
