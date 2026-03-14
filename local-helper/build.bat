@echo off
REM ============================================================
REM  Operon AI — Local Agent  |  Windows build script
REM  Produces: ..\build\OperonAI.exe
REM ============================================================

setlocal

cd /d "%~dp0"

echo.
echo ====================================
echo   Building Operon AI (Windows)
echo ====================================
echo.

REM Activate venv if present
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

REM Run PyInstaller
pyinstaller --clean --noconfirm operon.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed.
    exit /b 1
)

REM Move output to build folder
if not exist "..\build" mkdir "..\build"
copy /Y "dist\OperonAI.exe" "..\build\OperonAI.exe" >nul

echo.
echo [OK] Build complete: build\OperonAI.exe
echo.

endlocal
