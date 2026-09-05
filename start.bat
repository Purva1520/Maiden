@echo off
REM Maiden launcher (Windows).
REM Installs dependencies if needed, starts the web app + API, and opens the
REM browser. Close this window or press Ctrl+C to stop.
REM
REM   start.bat

cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo Error: pnpm is not installed. Install Node.js and pnpm first: https://pnpm.io/installation
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies ^(first run^)...
  call pnpm install
)

if not exist .env if exist .env.example copy /y .env.example .env >nul

echo.
echo Starting Maiden - web on http://localhost:5173 and API on http://localhost:3000.
echo The browser will open automatically. Close this window to stop.
echo.

REM Open the browser a few seconds after the servers begin starting.
start "" cmd /c "timeout /t 6 >nul & start "" http://localhost:5173"

call pnpm dev
