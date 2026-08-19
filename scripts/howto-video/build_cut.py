#!/usr/bin/env python3
"""Cut the How-to walkthrough from captured shots and River's narration.

The film is assembled, not edited: every section is its narration.mp3 laid
under a list of visuals (window clips, stills, or a generated card when a shot
has not been captured yet), and the last visual of a section holds until the
narration ends. Re-running after new captures land re-renders the whole film
to the same URL-able file, which is the point (Peter, 2026-08-19: the film must
re-cut when the app changes without anyone in a booth).

Inputs (relative to media/how-to/):
  narration/<section>/narration.mp3     from scripts/narration/generate_audio.py
  src/<shot>.mov | src/<shot>.png       from kit's scripts/howto_capture.sh and
                                        the interactive session
Output:
  walkthrough-rough.mp4 (or --final -> walkthrough.mp4), 1920x1080, 30fps,
  H.264 + AAC, Kit's dark ground behind every shot.

Missing shots render as a quiet card naming the shot and, for the typed asks,
the prompt that will be typed there, so a rough cut exists from the first run
and the cut reads as a storyboard until the last capture arrives.

Needs ffmpeg on PATH and Pillow for the cards; the Kit fonts (Fraunces,
Manrope) are read from ~/Library/Fonts if present, else the cards fall back
to a system face.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[1]
MEDIA = SITE / "media" / "how-to"
SRC = MEDIA / "src"
NARR = MEDIA / "narration"
BUILD = MEDIA / ".build"

W, H, FPS = 1920, 1080, 30
BG = "0x0a0e1a"          # kit tokens: --bg-deep
INK = (232, 235, 242)    # --ink-primary
QUIET = (139, 149, 175)  # --ink-quiet
WARM = (232, 165, 92)    # --accent-warm
CARD_BG = (10, 14, 26)

FONT_DIR = Path.home() / "Library" / "Fonts"
FRAUNCES = FONT_DIR / "Fraunces-VariableFont_SOFT,WONK,opsz,wght.ttf"
MANROPE = FONT_DIR / "Manrope-VariableFont_wght.ttf"

# ── the cut ────────────────────────────────────────────────────────────────
# Each section: narration dir, then visuals in order. A visual is
#   ("clip", "<name>.mov", seconds)   trimmed to seconds (or looped if shorter)
#   ("still", "<name>.png", seconds)  held
#   ("card", "<label>", seconds, "<sub>")  generated, used when a shot is missing
# `seconds` may be None for the last visual: it holds to the narration's end.
# A clip or still whose file is missing becomes a card automatically, so the
# manifest names the intended shot and the render tells you what is still to
# capture.
SECTIONS = [
    ("00-open", [
        ("clip", "V1-timeline.mov", 10),
        ("still", "S1-timeline.png", None),
    ]),
    ("01-remember", [
        ("clip", "V2a-memories.mov", 5),
        ("clip", "V2-memory-open.mov", 8),
        ("clip", "V3-wake.mov", None),
    ]),
    ("02-doors", [
        ("clip", "V4-phone.mov", 9),
        ("clip", "V5-followup.mov", None),
    ]),
    ("03-ask", [
        ("clip", "V6-asks.mov", None),
    ]),
    ("04-night", [
        ("clip", "V1-timeline.mov", 7),
        ("clip", "V7-dreams.mov", None),
    ]),
    ("05-off", [
        ("clip", "V8-health.mov", 12),
        ("clip", "V9-feedback.mov", None),
    ]),
    ("06-close", [
        ("still", "S1-timeline.png", None),
    ]),
]

# What a missing shot's card says (the prompt that gets typed there, where
# there is one), so the storyboard cut is readable.
CARD_TEXT = {
    "V2-memory-open.mov": ("A memory, open, with its source line", "Memories, List, open “Invoice terms: net 30 for new clients, net 14 for repeat”"),
    "V3-wake.mov": ("Claude Code: a new session wakes", "Wake up and tell me where we left off."),
    "V4-phone.mov": ("Telegram, on the phone", "Kit, what did I say about the invoice terms?"),
    "V5-followup.mov": ("Talk to Kit: the follow-up", "and when was that?"),
    "V6-asks.mov": ("Talk to Kit: the asks, typed live", "when did I last talk to Sarah?  ·  what have I been circling this week?  ·  when is the Northgate review?  ·  that's wrong, it was Thursday  ·  remember that the launch moved to October  ·  do you have anything on the Meyer contract?  ·  Kit, the Northgate thing?"),
    "V7-dreams.mov": ("Health, Dreams open", "last sleep, dream output, recall quality"),
}


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-4000:])
        raise SystemExit(f"ffmpeg failed: {' '.join(cmd[:3])} ...")


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        stdout=subprocess.PIPE, text=True, check=True).stdout.strip()
    return float(out)


def card(label: str, sub: str, name: str) -> Path:
    """Render a quiet placeholder card in Kit's palette."""
    from PIL import Image, ImageDraw, ImageFont
    out = BUILD / f"card-{name}.png"
    img = Image.new("RGB", (W, H), CARD_BG)
    d = ImageDraw.Draw(img)
    try:
        head = ImageFont.truetype(str(FRAUNCES), 64)
        head.set_variation_by_axes([0, 0, 72, 500]) if hasattr(head, "set_variation_by_axes") else None
    except Exception:
        head = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 60) if Path("/System/Library/Fonts/Supplemental/Georgia.ttf").exists() else ImageFont.load_default()
    try:
        body = ImageFont.truetype(str(MANROPE), 30)
        kicker = ImageFont.truetype(str(MANROPE), 22)
    except Exception:
        body = kicker = ImageFont.load_default()

    # kicker
    d.text((160, 330), "STILL TO CAPTURE".replace("STILL TO CAPTURE", "Still to capture"), font=kicker, fill=WARM)
    # label
    d.text((160, 380), label, font=head, fill=INK)
    # sub, wrapped at ~70 chars
    words, lines, cur = sub.split(" "), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if len(t) > 78:
            lines.append(cur); cur = w_
        else:
            cur = t
    if cur:
        lines.append(cur)
    y = 480
    for ln in lines[:6]:
        d.text((160, y), ln, font=body, fill=QUIET)
        y += 44
    img.save(out)
    return out


def fit_filter() -> str:
    # Fit inside the frame with a 48px margin, centred on Kit's ground.
    return (f"scale=w={W-96}:h={H-96}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG},fps={FPS},format=yuv420p")


def render_visual(kind: str, ref: str, secs: float, idx: str) -> Path:
    out = BUILD / f"seg-{idx}.mp4"
    if kind == "card":
        label, sub = ref, ""
        png = card(label, sub, idx)
        run(["ffmpeg", "-y", "-loop", "1", "-i", str(png), "-t", f"{secs:.3f}",
             "-vf", fit_filter(), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", str(out)])
        return out
    src = SRC / ref
    if not src.exists():
        label, sub = CARD_TEXT.get(ref, (ref, ""))
        png = card(label, sub, idx)
        run(["ffmpeg", "-y", "-loop", "1", "-i", str(png), "-t", f"{secs:.3f}",
             "-vf", fit_filter(), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", str(out)])
        return out
    if kind == "still":
        run(["ffmpeg", "-y", "-loop", "1", "-i", str(src), "-t", f"{secs:.3f}",
             "-vf", fit_filter(), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", str(out)])
        return out
    # clip: loop if shorter than needed, then trim to secs
    clip_len = duration(src)
    loops = 0 if clip_len >= secs else int(secs // max(clip_len, 0.1))
    run(["ffmpeg", "-y", "-stream_loop", str(loops), "-i", str(src), "-t", f"{secs:.3f}",
         "-vf", fit_filter(), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", str(out)])
    return out


def build(final: bool) -> Path:
    BUILD.mkdir(parents=True, exist_ok=True)
    section_files: list[Path] = []
    missing: list[str] = []
    for si, (section, visuals) in enumerate(SECTIONS):
        mp3 = NARR / section / "narration.mp3"
        if not mp3.exists():
            raise SystemExit(f"no narration for {section}: {mp3}")
        total = duration(mp3) + 0.6   # a breath after the last word
        fixed = sum(v[2] for v in visuals if v[2] is not None)
        open_slots = [v for v in visuals if v[2] is None]
        remainder = max(total - fixed, 2.0)
        per_open = remainder / len(open_slots) if open_slots else 0.0
        # If the fixed visuals already exceed the narration, scale them down so
        # the section never outruns its voice.
        scale = min(1.0, total / fixed) if fixed > total and not open_slots else 1.0
        segs: list[Path] = []
        for vi, v in enumerate(visuals):
            kind, ref = v[0], v[1]
            secs = (v[2] * scale) if v[2] is not None else per_open
            if kind != "card" and not (SRC / ref).exists():
                missing.append(ref)
            segs.append(render_visual(kind, ref, secs, f"{si:02d}-{vi:02d}"))
        # concat the section's visuals, then mux the narration (video may be
        # a hair longer than the audio; -shortest trims to the audio + pad)
        lst = BUILD / f"list-{si:02d}.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in segs))
        vid = BUILD / f"section-{si:02d}-video.mp4"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(vid)])
        sec_out = BUILD / f"section-{si:02d}.mp4"
        run(["ffmpeg", "-y", "-i", str(vid), "-i", str(mp3),
             "-af", "apad=pad_dur=0.6", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", str(sec_out)])
        section_files.append(sec_out)
    lst = BUILD / "list-all.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in section_files))
    out = MEDIA / ("walkthrough.mp4" if final else "walkthrough-rough.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(out)])
    report = {
        "output": str(out), "seconds": round(duration(out), 1),
        "missing_shots": sorted(set(missing)),
    }
    (MEDIA / "cut-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--final", action="store_true", help="write walkthrough.mp4 instead of walkthrough-rough.mp4")
    ap.add_argument("--clean", action="store_true", help="drop the .build dir first")
    args = ap.parse_args()
    if args.clean and BUILD.exists():
        shutil.rmtree(BUILD)
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg not on PATH")
    build(args.final)
    return 0


if __name__ == "__main__":
    sys.exit(main())
