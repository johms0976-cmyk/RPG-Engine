@echo off
setlocal EnableDelayedExpansion
title Mothership Engine - Table Server
cd /d "%~dp0"

echo.
echo   MOTHERSHIP ENGINE - starting the table server
echo   ---------------------------------------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js is not installed, or is not on your PATH.
  echo   Install Node 20 or newer from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

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

REM Only rebuild when something in the source is newer than the last build.
set NEEDBUILD=yes
if exist "dist\index.html" (
  for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "$paths = @('src','index.html','package.json','vite.config.js') | Where-Object { Test-Path $_ };" ^
    "$src = (Get-ChildItem -Recurse -File -Path $paths -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime;" ^
    "$dist = (Get-Item 'dist\index.html').LastWriteTime;" ^
    "if ($dist -gt $src) { 'no' } else { 'yes' }"`) do set NEEDBUILD=%%A
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

REM Open the browser a few seconds after the server has had time to bind.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 4; Start-Process 'http://localhost:8080'"

node server\host.mjs

echo.
echo   Server stopped. Close this window, or press a key.
pause
