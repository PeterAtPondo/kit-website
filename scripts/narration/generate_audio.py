#!/usr/bin/env python3
"""
Generate narration audio for a Kit blog post via ElevenLabs.

Pipeline (second half):
  extract_script.py  ->  blog/<slug>/narration.txt   (text, no diagrams)
  generate_audio.py  ->  blog/<slug>/narration.mp3    (this script)

Config lives in voices.json (voice id, model, settings). The API key is NEVER
stored in the repo; it is read from the ELEVENLABS_API_KEY environment
variable at run time.

This script will NOT generate anything until a voice_id is set in voices.json
and the key is present, so it is safe to commit and safe to run by accident.

Usage:
  # audition: list the voices available on the account (needs key)
  ELEVENLABS_API_KEY=sk_... python3 generate_audio.py --list-voices

  # dry run: show exactly what would be sent, generate nothing
  python3 generate_audio.py ../../blog/holding-isnt-trusting --dry-run

  # generate (needs voice_id in voices.json AND the key in env)
  ELEVENLABS_API_KEY=sk_... python3 generate_audio.py ../../blog/holding-isnt-trusting

  # all posts that have a narration.txt
  ELEVENLABS_API_KEY=sk_... python3 generate_audio.py --all
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
BLOG = REPO / "blog"
CONFIG = HERE / "voices.json"
API_ROOT = "https://api.elevenlabs.io/v1"

# ElevenLabs caps a single text-to-speech request at 10,000 characters. Longer
# narrations are split on paragraph boundaries into sub-cap chunks, synthesised
# separately, and concatenated with ffmpeg.
MAX_CHARS = 9500


def chunk_text(text: str, limit: int = MAX_CHARS) -> list[str]:
    """Split text into <=limit-char chunks on paragraph (blank-line) breaks."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    cur = ""
    for p in paras:
        if len(p) > limit:
            # Pathologically long single paragraph: flush, then hard-split it.
            if cur:
                chunks.append(cur)
                cur = ""
            for i in range(0, len(p), limit):
                chunks.append(p[i : i + limit])
            continue
        candidate = p if not cur else cur + "\n\n" + p
        if len(candidate) <= limit:
            cur = candidate
        else:
            chunks.append(cur)
            cur = p
    if cur:
        chunks.append(cur)
    return chunks


def load_config() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def api_key() -> str | None:
    return os.environ.get("ELEVENLABS_API_KEY")


def selected_voice(cfg: dict) -> dict:
    key = cfg.get("selected")
    return cfg.get("voices", {}).get(key, {})


def list_voices() -> int:
    key = api_key()
    if not key:
        print("ELEVENLABS_API_KEY not set; cannot list voices.", file=sys.stderr)
        return 2
    req = urllib.request.Request(
        f"{API_ROOT}/voices", headers={"xi-api-key": key}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
    except urllib.error.URLError as e:  # noqa: BLE001
        print(f"voice list failed: {e}", file=sys.stderr)
        return 1
    voices = data.get("voices", [])
    print(f"{len(voices)} voices on this account:\n")
    for v in voices:
        labels = v.get("labels", {}) or {}
        desc = ", ".join(
            f"{k}={labels[k]}" for k in ("gender", "accent", "age", "description") if labels.get(k)
        )
        print(f"  {v.get('voice_id'):24}  {v.get('name','?'):20}  {desc}")
    print("\nSet the chosen voice_id in voices.json -> voices.kit-voice.voice_id")
    return 0


def synth(text: str, cfg: dict, key: str, out: Path) -> bool:
    voice = selected_voice(cfg)
    voice_id = voice.get("voice_id", "").strip()
    if not voice_id:
        print("No voice_id set in voices.json. Audition with --list-voices, "
              "then fill voices.kit-voice.voice_id.", file=sys.stderr)
        return False
    fmt = cfg.get("output", {}).get("format", "mp3_44100_128")
    settings = cfg.get("voice_settings", {})
    model = cfg.get("model_id", "eleven_multilingual_v2")

    def synth_one(piece: str) -> bytes | None:
        body = json.dumps({
            "text": piece, "model_id": model, "voice_settings": settings,
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{API_ROOT}/text-to-speech/{voice_id}?output_format={fmt}",
            data=body,
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # noqa: BLE001
            print(f"  TTS failed ({e.code}): {e.read()[:300]!r}", file=sys.stderr)
        except urllib.error.URLError as e:  # noqa: BLE001
            print(f"  TTS failed: {e}", file=sys.stderr)
        return None

    chunks = chunk_text(text)

    # Single chunk: synth straight to the output file.
    if len(chunks) == 1:
        audio = synth_one(chunks[0])
        if audio is None:
            return False
        out.write_bytes(audio)
        print(f"  wrote {out}  ({len(audio)//1024} KB)")
        return True

    # Multiple chunks: synth each to a temp mp3, then concat with ffmpeg.
    print(f"  text is {len(text)} chars; splitting into {len(chunks)} chunks")
    with tempfile.TemporaryDirectory() as td:
        parts: list[Path] = []
        for i, piece in enumerate(chunks):
            audio = synth_one(piece)
            if audio is None:
                print(f"  chunk {i+1}/{len(chunks)} failed; aborting", file=sys.stderr)
                return False
            part = Path(td) / f"part{i:02d}.mp3"
            part.write_bytes(audio)
            parts.append(part)
            print(f"  chunk {i+1}/{len(chunks)}: {len(piece)} chars, {len(audio)//1024} KB")
        listfile = Path(td) / "list.txt"
        listfile.write_text("".join(f"file '{p}'\n" for p in parts), encoding="utf-8")
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(listfile), "-c", "copy", str(out),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"  ffmpeg concat failed: {res.stderr[-300:]}", file=sys.stderr)
            return False
    print(f"  wrote {out}  ({out.stat().st_size//1024} KB)")
    return True


def process(post_dir: Path, cfg: dict, dry_run: bool) -> bool:
    script = post_dir / "narration.txt"
    if not script.exists():
        print(f"  {post_dir.name}: no narration.txt (run extract_script.py first)", file=sys.stderr)
        return False
    text = script.read_text(encoding="utf-8").strip()
    out = post_dir / cfg.get("output", {}).get("filename", "narration.mp3")
    words = len(text.split())
    voice = selected_voice(cfg)
    if dry_run:
        print(f"  {post_dir.name}: {words} words -> would synth with "
              f"voice='{voice.get('label','?')}' id='{voice.get('voice_id') or 'UNSET'}' "
              f"model={cfg.get('model_id')} -> {out.name}")
        return True
    key = api_key()
    if not key:
        print("ELEVENLABS_API_KEY not set; refusing to generate.", file=sys.stderr)
        return False
    print(f"  {post_dir.name}: {words} words -> synthesising...")
    return synth(text, cfg, key, out)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate blog-post narration via ElevenLabs.")
    ap.add_argument("post", nargs="?", help="path to a post dir (containing narration.txt)")
    ap.add_argument("--all", action="store_true", help="every post dir with a narration.txt")
    ap.add_argument("--list-voices", action="store_true", help="list account voices and exit")
    ap.add_argument("--dry-run", action="store_true", help="show what would happen, generate nothing")
    args = ap.parse_args()

    if args.list_voices:
        return list_voices()

    cfg = load_config()

    if args.all:
        dirs = sorted(p.parent for p in BLOG.glob("*/narration.txt"))
        if not dirs:
            print("no narration.txt files found; run extract_script.py --all first", file=sys.stderr)
            return 1
        print(f"{'DRY RUN: ' if args.dry_run else ''}narrating {len(dirs)} posts:")
        ok = all(process(d, cfg, args.dry_run) for d in dirs)
        return 0 if ok else 1

    if not args.post:
        ap.error("provide a post dir, --all, or --list-voices")
    return 0 if process(Path(args.post), cfg, args.dry_run) else 1


if __name__ == "__main__":
    raise SystemExit(main())
