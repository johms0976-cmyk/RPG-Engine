@echo off
setlocal
title Mothership Engine - Update
cd /d "%~dp0"

echo.
echo   Pulling the latest version from GitHub...
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo   Git is not installed. Download the ZIP from GitHub instead,
  echo   or install Git from https://git-scm.com
  pause
  exit /b 1
)

git pull
if errorlevel 1 (
  echo.
  echo   Pull failed - you may have local edits that clash. Sort those first.
  pause
  exit /b 1
)

echo.
echo   Updating dependencies...
call npm install
if errorlevel 1 ( pause & exit /b 1 )

echo.
echo   Rebuilding...
call npm run build
if errorlevel 1 ( pause & exit /b 1 )

echo.
echo   Done. Use Play.bat to start the table.
pause
