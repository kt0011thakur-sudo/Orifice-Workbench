@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, version 24.12 or newer within major 24.
  echo Official download: https://nodejs.org/en/download
  echo Then close and reopen this launcher.
  pause
  exit /b 1
)
echo The server will print its local address below.
node scripts/start.mjs
set "orifice_exit=%errorlevel%"
pause
exit /b %orifice_exit%
