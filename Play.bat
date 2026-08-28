@echo off
setlocal EnableDelayedExpansion
title Mothership Engine - Table Server
cd /d "%~dp0"

REM ============================================================
REM  PLAY.BAT - start the table.
REM
REM  WHAT WAS ACTUALLY BROKEN, AND WHY IT LOOKED LIKE THIS FILE
REM
REM  It was not this file. src\screens\Play.jsx - the player and
REM  Warden screen, imported by both App.jsx and ClientShell.jsx -
REM  is missing from the repository. `npm run build` stops on the
REM  unresolved import, this script printed "Build failed" and
REM  exited, and from the outside that is indistinguishable from a
REM  broken launcher.
REM
REM  Three things changed so it never reads that way again:
REM
REM    1. PREFLIGHT. scripts\preflight.mjs resolves every import in
REM       the tree before the build runs and names any file that is
REM       not there. It runs before `npm install`, so a missing
REM       file is reported in two seconds rather than after a
REM       three-minute install and a forty-line rollup trace.
REM
REM    2. NO POWERSHELL. The staleness check and the browser opener
REM       were inline PowerShell, continued across carets, inside a
REM       for /f backtick command, inside an if block. Four layers
REM       of escaping, and both needed -ExecutionPolicy Bypass. Now
REM       they are scripts\needbuild.mjs and scripts\open-host.mjs.
REM       Node is already a hard requirement; PowerShell no longer
REM       is.
REM
REM    3. CRLF. This file, Doctor.bat and Update.bat were all saved
REM       with Unix line endings. cmd.exe tolerates that until it
REM       does not, and the ways it stops tolerating it - blocks,
REM       continuations, the last line of a file - are exactly the
REM       constructs this script is built out of. The repo now has
REM       a .gitattributes that pins *.bat to CRLF so a checkout
REM       cannot undo it again.
REM
REM  The ?mode=host part of the original fix still stands: a bare
REM  http://localhost:8080 means "I am a phone", so the PC would
REM  open a PLAYER screen with no Warden deck anywhere.
REM
REM  Usage:   Play.bat            start on port 8080
REM           Play.bat 3000       start on port 3000
REM ============================================================

set "PORT=%~1"
if not defined PORT set "PORT=8080"
echo %PORT%| findstr /r /c:"^[1-9][0-9]*$" >nul
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

REM ---------------- preflight ----------------
REM Before npm install, not after. This check needs nothing but
REM Node, and a missing file is worth knowing about now rather
REM than at the end of a three-minute install.

node scripts\preflight.mjs
if errorlevel 1 (
  echo   Stopping here - the build cannot succeed with files missing.
  echo.
  pause
  exit /b 1
)
echo.

REM ---------------- dependencies ----------------
REM Two tests, not one. A node_modules that exists but has no
REM .package-lock.json is an install that was interrupted, and
REM treating it as finished produces a build failure that reads
REM like a code error.

set "DEPS=ok"
if not exist "node_modules" set "DEPS=no"
if not exist "node_modules\.package-lock.json" set "DEPS=no"

if "%DEPS%"=="no" (
  echo   Installing dependencies. This happens once, and takes a few minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed. Check the messages above.
    echo.
    pause
    exit /b 1
  )
  echo.
)

REM ---------------- build, only when stale ----------------

node scripts\needbuild.mjs
if errorlevel 1 (
  echo   Source has changed since the last build - rebuilding...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo   Build failed. Check the messages above.
    echo.
    pause
    exit /b 1
  )
  echo.
) else (
  echo   Build is already current - skipping it.
  echo.
)

REM ---------------- open the right screen ----------------

start "" /min node scripts\open-host.mjs %PORT%

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
