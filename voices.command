#!/usr/bin/env bash
# ============================================================
#  VOICES  ·  double-click this file
# ------------------------------------------------------------
#  Gives the cast of a module their own voices.
#
#  Ten people and a cat currently share one flat synthesised
#  voice, and the table has to read the name to know who spoke.
#  This cuts every line each of them can say into an mp3 in a
#  voice chosen for that person, ahead of time, here on this
#  machine — and the app plays those instead when they exist.
#
#  Anything not recorded falls back to the tablet's own voice,
#  exactly as before, so a half-finished run is a half-improved
#  table and never a broken one.
#
#  Three steps, and this runs all three:
#    1  tools/voice-spec.mjs      what is there to say
#    2  tools/voice-generate.py   say it
#    3  tools/voice-manifest.mjs  tell the app what exists
#
#  Mac: right-click > Open the first time (macOS blocks
#  downloaded scripts until you do). After that, double-click.
#
#  If it has never been run:  chmod +x voices.command
# ============================================================

cd "$(dirname "$0")" || exit 1

echo ""
echo "  Voices — the cast of a Mothership module"
echo "  ========================================"
echo ""

fail() { echo ""; echo "  ✗ $1"; echo ""; read -r -p "  Press Return to close."; exit 1; }
bye()  { echo ""; read -r -p "  Press Return to close."; exit 0; }

# ── 1. is Node here? ────────────────────────────────────────
command -v node >/dev/null 2>&1 || \
  fail "Node is not installed. Get it from https://nodejs.org then run this again."

# ── 2. is Python here? ──────────────────────────────────────
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
[ -n "$PY" ] || fail "Python is not installed. Get it from https://python.org then run this again."

echo "  node $(node --version)   $($PY --version 2>&1)"

# ── 3. are we in the right folder? ──────────────────────────
[ -f index.html ] || fail "This file must sit in the same folder as index.html."
[ -f tools/voice-spec.mjs ] || fail "tools/voice-spec.mjs is missing."
[ -f tools/voice-generate.py ] || fail "tools/voice-generate.py is missing."
[ -f tools/voice-manifest.mjs ] || fail "tools/voice-manifest.mjs is missing."
[ -f tools/voice-cast.json ] || fail "tools/voice-cast.json is missing — that is who sounds like who."

# ── 4. edge-tts ─────────────────────────────────────────────
if ! $PY -c "import edge_tts" >/dev/null 2>&1; then
  echo ""
  echo "  Installing edge-tts (one time only)..."
  $PY -m pip install edge-tts --quiet \
    || $PY -m pip install edge-tts --quiet --break-system-packages \
    || fail "Could not install edge-tts. Try running:  $PY -m pip install edge-tts"
fi

# ── 5. which module? ────────────────────────────────────────
echo ""
echo "  ------------------------------------------------------"
echo "  Which module?"
echo ""
echo "  1) Ypsilon 14        ypsilon14"
echo "  2) Another Bug Hunt  anotherbughunt"
echo "  3) Something else    (type the folder name)"
echo "  ------------------------------------------------------"
read -r -p "  Choose 1-3: " which
case "$which" in
  1) MOD="ypsilon14" ;;
  2) MOD="anotherbughunt" ;;
  3) read -r -p "  Folder name under src/modules/: " MOD ;;
  *) echo "  Nothing done."; bye ;;
esac
[ -n "$MOD" ] || bye

# ── 6. what is there to say? ────────────────────────────────
echo ""
node tools/voice-spec.mjs "$MOD" || fail "voice-spec failed — see the message above."

# ── 7. how much of it? ──────────────────────────────────────
echo "  ------------------------------------------------------"
echo "  How much?"
echo ""
echo "  1) 8 lines first, so you can listen      [recommended]"
echo "  2) One person          (you choose who)"
echo "  3) Everyone, every line"
echo "  4) Re-record everything      (after changing the cast)"
echo "  5) List it without making anything"
echo ""
echo "  6) Just rebuild the manifest"
echo "  7) Show me the voices edge-tts offers"
echo "  8) Quit"
echo "  ------------------------------------------------------"
read -r -p "  Choose 1-8: " how
echo ""

case "$how" in
  1) $PY tools/voice-generate.py "$MOD" --limit 8 ;;
  2) read -r -p "  Which one (e.g. sonya): " WHO
     [ -n "$WHO" ] && $PY tools/voice-generate.py "$MOD" --npc "$WHO" ;;
  3) $PY tools/voice-generate.py "$MOD" ;;
  4) $PY tools/voice-generate.py "$MOD" --force ;;
  5) $PY tools/voice-generate.py "$MOD" --dry-run; bye ;;
  6) ;;
  7) $PY tools/voice-generate.py --list-voices; bye ;;
  *) echo "  Nothing done."; bye ;;
esac

# ── 8. always rebuild the manifest ──────────────────────────
node tools/voice-manifest.mjs

echo ""
echo "  Done. The clips are in public/voice/ — commit them along"
echo "  with src/voice/manifest.js, then rebuild and reload."
echo "  Turn the voice on in the app's settings."
bye
