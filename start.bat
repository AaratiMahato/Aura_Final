@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist server\node_modules call npm install --prefix server
if not exist client\node_modules call npm install --prefix client
if not exist server\.env (
  node setup-env.js
  notepad server\.env
  echo.
  echo Save the file, close Notepad, then press any key to start.
  pause >nul
)
echo.
echo Starting Aura Pro... open http://localhost:5173
call npm run dev
