@echo off
setlocal EnableDelayedExpansion
title Mothership Engine - Connection Doctor
cd /d "%~dp0"

REM ============================================================
REM  DOCTOR.BAT - why can't my phone reach the table?
REM
REM  Play.bat has been telling people to run this file since the
REM  day it was written. The file did not exist. That is fixed.
REM
REM  Two things happen here:
REM
REM    1. scripts\doctor.mjs reports what is actually true about
REM       this machine - build, listening socket, firewall rules,
REM       network category, adapters.
REM
REM    2. If it finds a firewall problem, this offers to fix it,
REM       which needs administrator and so has to be a separate
REM       elevated step.
REM
REM  Run it WHILE Play.bat is running, in a second window, if you
REM  can. It works either way, but it can tell you more when the
REM  server is up.
REM
REM  Usage:   Doctor.bat          check port 8080
REM           Doctor.bat 3000     check port 3000
REM ============================================================

set "PORT=%~1"
if not defined PORT set "PORT=8080"
echo %PORT%| findstr /r "^[1-9][0-9]*$" >nul
if errorlevel 1 (
  echo.
  echo   "%~1" is not a port number. Try:  Doctor.bat 3000
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js is not installed, or is not on your PATH.
  echo   Install Node 20 or newer from https://nodejs.org
  echo.
  pause
  exit /b 1
)

set "PORT=%PORT%"
node scripts\doctor.mjs

echo.
echo   ------------------------------------------------------
echo.
echo   The fix for nearly every failure above is the same, and
echo   it needs administrator: clear any hidden node.exe BLOCK
echo   rules, add an allow rule for port %PORT%, and make sure
echo   your wifi is classed Private rather than Public.
echo.
set "GO="
set /p "GO=  Run that fix now? [y/N] "
if /i "!GO!"=="y" (
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\firewall.ps1" -Port %PORT%
) else (
  echo.
  echo   Skipped. You can run it later with:
  echo       powershell -ExecutionPolicy Bypass -File scripts\firewall.ps1
  echo.
  echo   To undo it afterwards:
  echo       powershell -ExecutionPolicy Bypass -File scripts\firewall.ps1 -Undo
  echo.
)

echo.
pause
