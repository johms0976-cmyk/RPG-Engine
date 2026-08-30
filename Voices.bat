@echo off
setlocal EnableDelayedExpansion
title Mothership Engine - Voices
cd /d "%~dp0"

REM ============================================================
REM  VOICES.BAT - give a module's cast their own voices.
REM
REM  Ten people and a cat currently share one flat synthesised
REM  voice, and the table has to read the name to know who spoke.
REM  This cuts every line each of them can say into an mp3 in a
REM  voice chosen for that person, ahead of time, on this machine.
REM  The app plays those instead when they exist and falls back to
REM  the tablet's own voice when they do not - so a half-finished
REM  run is a half-improved table, never a broken one.
REM
REM  Three steps, and this runs all three:
REM    1  tools\voice-spec.mjs      what is there to say
REM    2  tools\voice-generate.py   say it
REM    3  tools\voice-manifest.mjs  tell the app what exists
REM
REM  No PowerShell, and CRLF line endings, for the reasons set out
REM  at the top of Play.bat. .gitattributes pins both.
REM ============================================================

echo.
echo   Voices - the cast of a Mothership module
echo   ========================================
echo.

REM ---- 1. is Node here? --------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo   x Node is not installed. Get it from https://nodejs.org
  goto end
)

REM ---- 2. is Python here? ------------------------------------
set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY where py >nul 2>&1 && set "PY=py -3"
if not defined PY (
  echo   x Python is not installed. Get it from https://python.org
  echo     Tick "Add python.exe to PATH" in the installer.
  goto end
)

for /f "delims=" %%v in ('node --version') do set "NODEV=%%v"
echo   node !NODEV!   %PY%

REM ---- 3. are we in the right folder? ------------------------
if not exist "index.html" (
  echo   x This file must sit in the same folder as index.html.
  goto end
)
if not exist "tools\voice-spec.mjs"     ( echo   x tools\voice-spec.mjs is missing.     & goto end )
if not exist "tools\voice-generate.py"  ( echo   x tools\voice-generate.py is missing.  & goto end )
if not exist "tools\voice-manifest.mjs" ( echo   x tools\voice-manifest.mjs is missing. & goto end )
if not exist "tools\voice-cast.json"    ( echo   x tools\voice-cast.json is missing.    & goto end )

REM ---- 4. edge-tts -------------------------------------------
%PY% -c "import edge_tts" >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Installing edge-tts ^(one time only^)...
  %PY% -m pip install edge-tts --quiet
  %PY% -c "import edge_tts" >nul 2>&1
  if errorlevel 1 (
    echo   x Could not install edge-tts. Try:  %PY% -m pip install edge-tts
    goto end
  )
)

REM ---- 5. which module? --------------------------------------
echo.
echo   ------------------------------------------------------
echo   Which module?
echo.
echo   1^) Ypsilon 14        ypsilon14
echo   2^) Another Bug Hunt  anotherbughunt
echo   3^) Something else    ^(type the folder name^)
echo   ------------------------------------------------------
set "MOD="
set /p "which=  Choose 1-3: "
if "%which%"=="1" set "MOD=ypsilon14"
if "%which%"=="2" set "MOD=anotherbughunt"
if "%which%"=="3" set /p "MOD=  Folder name under src\modules\: "
if not defined MOD ( echo   Nothing done. & goto end )

REM ---- 6. what is there to say? ------------------------------
echo.
node tools\voice-spec.mjs %MOD%
if errorlevel 1 ( echo   x voice-spec failed - see above. & goto end )

REM ---- 7. how much of it? ------------------------------------
echo   ------------------------------------------------------
echo   How much?
echo.
echo   1^) 8 lines first, so you can listen      [recommended]
echo   2^) One person          ^(you choose who^)
echo   3^) Everyone, every line
echo   4^) Re-record everything      ^(after changing the cast^)
echo   5^) List it without making anything
echo.
echo   6^) Just rebuild the manifest
echo   7^) Show me the voices edge-tts offers
echo   8^) Quit
echo   ------------------------------------------------------
set "how="
set /p "how=  Choose 1-8: "
echo.

if "%how%"=="1" %PY% tools\voice-generate.py %MOD% --limit 8
if "%how%"=="2" goto one
if "%how%"=="3" %PY% tools\voice-generate.py %MOD%
if "%how%"=="4" %PY% tools\voice-generate.py %MOD% --force
if "%how%"=="5" ( %PY% tools\voice-generate.py %MOD% --dry-run & goto end )
if "%how%"=="7" ( %PY% tools\voice-generate.py --list-voices & goto end )
if "%how%"=="8" ( echo   Nothing done. & goto end )
goto manifest

:one
set "WHO="
set /p "WHO=  Which one (e.g. sonya): "
if defined WHO %PY% tools\voice-generate.py %MOD% --npc %WHO%

:manifest
node tools\voice-manifest.mjs

echo.
echo   Done. The clips are in public\voice\ - commit them along
echo   with src\voice\manifest.js, then rebuild and reload.
echo   Turn the voice on in the app's settings.

:end
echo.
pause
endlocal
