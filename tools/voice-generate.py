#!/usr/bin/env python3
# ============================================================
#  THE RECORDING SESSION
#
#  Step two of three. Reads tools/spec/<module>.json, casts each
#  NPC from tools/voice-cast.json, and cuts one mp3 per line into
#  public/voice/<module>/<npc>/<key>.mp3.
#
#    python tools/voice-generate.py                    everything
#    python tools/voice-generate.py --npc sonya        one person
#    python tools/voice-generate.py --limit 6          a listen
#    python tools/voice-generate.py --dry-run          the bill
#    python tools/voice-generate.py --list-voices      the roster
#
#  WHERE THE SOUND COMES FROM. edge-tts, over the network, on
#  whoever's machine runs this — the same standing as a font or a
#  cassette: a build step, done once, by a person, on purpose. The
#  app itself never calls anything. What ships is mp3 files in
#  public/, served by the same origin as everything else, and a
#  table with no uplink plays them exactly as well as one with
#  fibre.
#
#  WHAT IT IS ALLOWED TO SAY. Only what is in the spec, and the
#  spec is only what a module author wrote. This script has no
#  opinion about the words and no way to acquire one.
#
#  RESUMABLE, BECAUSE IT WILL BE INTERRUPTED. A clip that exists
#  and is not empty is left alone, so a run that dies at line
#  sixty of ninety costs you thirty lines and not ninety. --force
#  re-cuts anyway, which is what you want after changing a voice.
# ============================================================

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "tools" / "spec"
CAST_FILE = ROOT / "tools" / "voice-cast.json"
OUT_ROOT = ROOT / "public" / "voice"

CONCURRENCY = 3      # polite, and past this the service starts refusing
ATTEMPTS = 3
MIN_BYTES = 512      # anything smaller is a failed cut wearing an mp3's name


# ---------------- the words ----------------

def load_spec(module):
    path = SPEC_DIR / f"{module}.json"
    if not path.exists():
        die(f"No spec for '{module}'. Run:  node tools/voice-spec.mjs {module}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_cast():
    if not CAST_FILE.exists():
        return {}
    return json.loads(CAST_FILE.read_text(encoding="utf-8"))


def casting(cast, module, npc_id):
    """Per-NPC, then per-module default, then the global default."""
    mod = cast.get(module) or {}
    entry = mod.get(npc_id) or mod.get("_default") or cast.get("_default") or {}
    return {
        "voice": entry.get("voice", "en-GB-RyanNeural"),
        "rate": entry.get("rate", "+0%"),
        "pitch": entry.get("pitch", "+0Hz"),
        "volume": entry.get("volume", "+0%"),
    }


def for_delivery(text):
    """The spec's text is what the screen shows, minus the stage
    directions. A line that is a quotation on the page is just
    speech in the mouth, so a wrapping pair of quotes comes off —
    otherwise some voices audibly announce them."""
    t = text.strip()
    if len(t) > 1 and t[0] == '"' and t[-1] == '"' and t.count('"') == 2:
        t = t[1:-1].strip()
    return t


# ---------------- talking to edge-tts ----------------

def need_edge():
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        die("edge-tts is not installed.  Try:  python -m pip install edge-tts")
    return __import__("edge_tts")


async def voice_roster():
    edge_tts = need_edge()
    try:
        return await edge_tts.list_voices()
    except Exception as err:                       # offline, blocked, DNS
        print(f"  (could not reach the voice list: {err})")
        return []


async def cut(edge_tts, sem, text, out_path, cfg, report):
    async with sem:
        tmp = out_path.with_suffix(".part")
        for attempt in range(1, ATTEMPTS + 1):
            try:
                comm = edge_tts.Communicate(
                    for_delivery(text),
                    cfg["voice"],
                    rate=cfg["rate"],
                    pitch=cfg["pitch"],
                    volume=cfg["volume"],
                )
                await comm.save(str(tmp))
                if tmp.exists() and tmp.stat().st_size >= MIN_BYTES:
                    tmp.replace(out_path)
                    report["done"] += 1
                    return True
                raise RuntimeError(f"{tmp.stat().st_size if tmp.exists() else 0} bytes came back")
            except Exception as err:
                if attempt == ATTEMPTS:
                    report["failed"].append((out_path.name, str(err).split("\n")[0]))
                    if tmp.exists():
                        tmp.unlink()
                    return False
                await asyncio.sleep(1.5 * attempt)
        return False


# ---------------- the run ----------------

async def run(args):
    edge_tts = need_edge()
    spec = load_spec(args.module)
    cast = load_cast()
    out_dir = OUT_ROOT / args.module

    parts = spec.get("npcs", [])
    if args.npc:
        wanted = {n.lower() for n in args.npc}
        parts = [p for p in parts if p["id"].lower() in wanted]
        if not parts:
            die(f"Nobody called {', '.join(args.npc)} in {args.module}. "
                f"Cast: {', '.join(p['id'] for p in spec.get('npcs', []))}")

    # Build the job list first, so --dry-run and the real run can
    # never disagree about what would happen.
    jobs = []
    skipped = 0
    for part in parts:
        cfg = casting(cast, args.module, part["id"])
        folder = out_dir / part["id"]
        for clip in part["clips"]:
            if args.only and not any(clip["source"].startswith(o) for o in args.only):
                continue
            dest = folder / f"{clip['key']}.mp3"
            if dest.exists() and dest.stat().st_size >= MIN_BYTES and not args.force:
                skipped += 1
                continue
            jobs.append((part, cfg, clip, dest))
            if args.limit and len(jobs) >= args.limit:
                break
        if args.limit and len(jobs) >= args.limit:
            break

    chars = sum(len(j[2]["text"]) for j in jobs)
    print("")
    print(f"  {args.module}: {len(jobs)} files, {chars} characters"
          f"{f', {skipped} already recorded' if skipped else ''}")

    if not jobs:
        print("  Nothing to do. Use --force to record over what is there.")
        return 0

    # Which voices this run needs, checked before it cuts anything.
    voices = {j[1]["voice"] for j in jobs}
    if not args.no_check:
        roster = {v["ShortName"] for v in await voice_roster()}
        if roster:
            unknown = sorted(voices - roster)
            if unknown:
                die("These are not voices edge-tts offers: " + ", ".join(unknown)
                    + "\n  Run  python tools/voice-generate.py --list-voices  and fix tools/voice-cast.json.")

    if args.dry_run:
        for part, cfg, clip, dest in jobs:
            print(f"    {part['id']:<10} {cfg['voice']:<22} {clip['text'][:64]}")
        print("")
        print("  Nothing was written.")
        return 0

    for part, cfg, _, _ in jobs:
        (out_dir / part["id"]).mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    report = {"done": 0, "failed": []}
    tasks = [cut(edge_tts, sem, clip["text"], dest, cfg, report)
             for part, cfg, clip, dest in jobs]

    total = len(tasks)
    for i, coro in enumerate(asyncio.as_completed(tasks), 1):
        await coro
        print(f"\r  recording {i}/{total}", end="", flush=True)
    print("")

    print("")
    print(f"  {report['done']} recorded, {len(report['failed'])} failed")
    for name, why in report["failed"][:8]:
        print(f"    {name}  {why}")
    if len(report["failed"]) > 8:
        print(f"    ... and {len(report['failed']) - 8} more")
    if report["failed"]:
        print("  Run it again — the ones that worked are kept and skipped.")
    return 1 if report["failed"] else 0


async def show_voices(filter_text):
    rows = await voice_roster()
    if not rows:
        return 1
    wanted = (filter_text or "en-").lower()
    print("")
    for v in sorted(rows, key=lambda v: v["ShortName"]):
        if wanted in v["ShortName"].lower() or wanted in v.get("Locale", "").lower():
            tags = ", ".join(v.get("VoiceTag", {}).get("VoicePersonalities", []) or [])
            print(f"  {v['ShortName']:<28} {v.get('Gender',''):<7} {tags}")
    print("")
    print("  Put a ShortName into tools/voice-cast.json.")
    return 0


def die(msg):
    print("")
    print(f"  {msg}")
    print("")
    sys.exit(1)


def main():
    p = argparse.ArgumentParser(description="Record every line a module's NPCs can say.")
    p.add_argument("module", nargs="?", default="ypsilon14")
    p.add_argument("--npc", action="append", help="just this person (repeatable)")
    p.add_argument("--only", action="append",
                   help="knows | deflection | script (repeatable)")
    p.add_argument("--limit", type=int, default=0, help="stop after this many files")
    p.add_argument("--force", action="store_true", help="re-record what is already there")
    p.add_argument("--dry-run", action="store_true", help="list it and write nothing")
    p.add_argument("--list-voices", nargs="?", const="en-", default=None,
                   help="show the voices edge-tts offers")
    p.add_argument("--no-check", action="store_true",
                   help="skip checking the cast against the live voice list")
    args = p.parse_args()

    if args.list_voices is not None:
        sys.exit(asyncio.run(show_voices(args.list_voices)))

    os.chdir(ROOT)
    sys.exit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
