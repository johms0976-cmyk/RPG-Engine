@echo off
setlocal EnableDelayedExpansion
title Mothership Engine - Table Server
cd /d "%~dp0"

REM ============================================================
REM  PLAY.BAT - start the table.
REM
REM  What changed, and why it matters:
REM
REM  This used to open http://localhost:8080 with nothing after it.
REM  Since the table server started answering /net/info, a bare URL
REM  means "I am a phone" - main.jsx probes the server, finds it,
REM  and boots ClientShell. So the PC opened a PLAYER screen and
REM  there was no Warden deck and no table view anywhere. The one
REM  thing this file exists to do, it stopped doing.
REM
REM  The authority tab is ?mode=host. That is the whole fix; the
REM  rest of this file is politeness.
REM
REM  Usage:   Play.bat            start on port 8080
REM           Play.bat 3000       start on port 3000
REM ============================================================

set "PORT=%~1"
if not defined PORT set "PORT=8080"
echo %PORT%| findstr /r "^[1-9][0-9]*$" >nul
if errorlevel 1 (
  echo.
  echo   "%~1" is not a port number. Try:  Play.bat 3000
  echo.
  pause
  exit /b 1
)

echo.
echo   MOTHERSHIP ENGINE - starting the table server
echo   ---------------------------------------------
echo.

REM ---------------- Node ----------------

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js is not installed, or is not on your PATH.
  echo   Install Node 20 or newer from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node" 2^>nul') do set "NODEMAJ=%%v"
if not defined NODEMAJ set "NODEMAJ=0"
if !NODEMAJ! LSS 20 (
  echo   Node !NODEMAJ! is too old - this needs Node 20 or newer.
  echo   Update from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

REM ---------------- dependencies ----------------

if not exist "node_modules\" (
  echo   First run - installing dependencies. This happens once, and takes a few minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed. Check the messages above.
    pause
    exit /b 1
  )
  echo.
)

REM ---------------- build, only when stale ----------------
REM package-lock.json is in the watch list so that an Update.bat run,
REM which can change what gets bundled, forces a rebuild too.

set "NEEDBUILD=yes"
if exist "dist\index.html" (
  for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$paths = @('src','index.html','package.json','package-lock.json','vite.config.js') | Where-Object { Test-Path $_ };" ^
    "$src = (Get-ChildItem -Recurse -File -Path $paths -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime;" ^
    "$dist = (Get-Item 'dist\index.html').LastWriteTime;" ^
    "if ($src -and $dist -gt $src) { 'no' } else { 'yes' }"`) do set "NEEDBUILD=%%A"
)

if /i "!NEEDBUILD!"=="yes" (
  echo   Source has changed since the last build - rebuilding...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo   Build failed. Check the messages above.
    pause
    exit /b 1
  )
  echo.
) else (
  echo   Build is already current - skipping it.
  echo.
)

REM ---------------- open the right screen ----------------
REM
REM Poll /net/info rather than sleeping a fixed four seconds. On a
REM slow machine the old sleep opened the browser before the socket
REM was bound, which looks exactly like a firewall block and sent
REM people hunting for a problem they did not have.
REM
REM ?mode=host is the authority tab. The Warden token is served over
REM /net/info to loopback only, so this screen picks it up by itself
REM and nobody types anything.

start "" /min powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$probe = 'http://localhost:%PORT%/net/info';" ^
  "$open  = 'http://localhost:%PORT%/?mode=host';" ^
  "for ($i = 0; $i -lt 60; $i++) {" ^
  "  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $probe | Out-Null; Start-Process $open; exit }" ^
  "  catch { Start-Sleep -Milliseconds 500 }" ^
  "}"

echo   This window is the server. Leave it open.
echo.
echo   The screen about to open is the WARDEN / TABLE screen.
echo     - GATHER THE TABLE .... you run it, phones are players
echo     - NOBODY IS THE WARDEN  the empty chair - this PC becomes
echo                             the shared screen in the middle
echo.
echo   Players join on the wifi address printed below. They do NOT
echo   add ?mode=host and they never need the token.
echo.

node server\host.mjs

echo.
echo   Server stopped.
echo.
echo   If it stopped straight away, or phones could not reach it, run
echo   Doctor.bat - or  npm run doctor  - in another window while this
echo   one is running. It finds the firewall rule nearly every time.
echo.
pause
