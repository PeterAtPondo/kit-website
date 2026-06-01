#!/usr/bin/env python3
"""
Extract narration-ready text from a Kit blog post.

The blog posts are hand-authored HTML with prose, headings, inline SVG
diagrams, figure captions, pull-quotes, code, and tables. For text-to-speech
we want ONLY the spoken arc: the title, the byline framing, and the prose +
headings. Everything visual or duplicative is dropped:

  - <figure> (diagrams, their inline <svg>, and <figcaption>)   -> dropped
  - <svg> anywhere                                              -> dropped
  - .post__pullquote  (verbatim repeats of nearby prose)        -> dropped
  - .post__table / table-wrap                                   -> dropped
  - <code> blocks                                               -> dropped
  - inline strong / em / a  -> flattened to their text
  - <h2>  -> kept as a spoken section break (short pause)
  - <p>, <li>  -> kept as prose

Output is plain UTF-8 text with blank lines between blocks, ready to feed to
the TTS step. No audio is generated here.

Usage:
  python3 extract_script.py ../../blog/holding-isnt-trusting/index.html
  python3 extract_script.py --all          # every post under blog/
  python3 extract_script.py <post> -o out.txt
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BLOG = REPO / "blog"

# Long-dash variants to normalise to commas (Kit voice rule avoids them).
# Built from code points so the source file contains no literal long dashes.
LONG_DASHES = [chr(0x2014), chr(0x2013), chr(0x2015)]


def _slice_body(doc: str) -> str:
    """Return the inner HTML of <div class="post__body"> ... </div>."""
    start = re.search(r'<div class="post__body">', doc)
    if not start:
        raise ValueError("no .post__body found")
    # Walk div nesting from the body open tag to its matching close.
    i = start.end()
    depth = 1
    for m in re.finditer(r"<(/?)div\b[^>]*>", doc[i:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return doc[i : i + m.start()]
    return doc[i:]


def _drop(pattern: str, text: str, flags=re.S) -> str:
    return re.sub(pattern, " ", text, flags=flags)


def _clean_inline(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)          # strip any remaining inline tags
    s = html.unescape(s)
    for dash in LONG_DASHES:                # normalise long dashes to comma
        s = s.replace(dash, ", ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract(doc: str) -> dict:
    """Pull title, meta, byline, and the narration blocks from a post doc."""
    title = ""
    mt = re.search(r'<h1 class="post__title">(.*?)</h1>', doc, re.S)
    if mt:
        title = _clean_inline(mt.group(1))

    meta = ""
    mm = re.search(r'<div class="post__meta">(.*?)</div>', doc, re.S)
    if mm:
        spans = re.findall(r"<span[^>]*>(.*?)</span>", mm.group(1), re.S)
        meta = _clean_inline(" ".join(spans))

    body = _slice_body(doc)

    # Drop everything visual or duplicative BEFORE we read block text.
    body = _drop(r"<figure\b.*?</figure>", body)        # diagrams + captions
    body = _drop(r"<svg\b.*?</svg>", body)               # any stray svg
    body = _drop(r'<p class="post__pullquote">.*?</p>', body)
    body = _drop(r"<div class=\"post__table[^\"]*\".*?</div>", body)
    body = _drop(r"<table\b.*?</table>", body)
    body = _drop(r"<code\b.*?</code>", body)

    # Collect spoken blocks in document order: headings, paragraphs, list items.
    blocks: list[str] = []
    for m in re.finditer(r"<(h2|p|li)\b[^>]*>(.*?)</\1>", body, re.S):
        kind, inner = m.group(1), m.group(2)
        txt = _clean_inline(inner)
        if not txt:
            continue
        if kind == "h2":
            # Section heading: give it room to breathe. ElevenLabs honours
            # <break> tags, so we add a longer pause before the heading (close
            # the previous section) and a shorter one after (settle before the
            # new section's prose). This makes a section change actually land
            # instead of running straight into the next paragraph.
            blocks.append(f'<break time="0.9s" /> {txt}. <break time="0.6s" />')
        else:
            blocks.append(txt)

    return {"title": title, "meta": meta, "blocks": blocks}


def render_script(parsed: dict, include_intro: bool = True) -> str:
    out: list[str] = []
    if include_intro and parsed["title"]:
        # Title, then byline, then a beat before the post proper begins.
        out.append(parsed["title"] + ".")
        out.append('Written by Kit, with Peter. <break time="1.0s" />')
        out.append("")
    out.extend(parsed["blocks"])
    text = "\n\n".join(b.strip() for b in out if b.strip() != "")
    return text.strip() + "\n"


def process(post_html: Path, out: Path | None) -> Path:
    doc = post_html.read_text(encoding="utf-8")
    parsed = extract(doc)
    script = render_script(parsed)
    target = out or (post_html.parent / "narration.txt")
    target.write_text(script, encoding="utf-8")
    words = len(script.split())
    # ~150 wpm is a calm narration pace; report an estimate.
    secs = round(words / 150 * 60)
    print(f"  {post_html.parent.name}: {words} words  (~{secs//60}m{secs%60:02d}s)  -> {target}")
    return target


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract narration text from a Kit blog post.")
    ap.add_argument("post", nargs="?", help="path to a post index.html")
    ap.add_argument("--all", action="store_true", help="process every post under blog/")
    ap.add_argument("-o", "--out", help="output path (single-post mode)")
    args = ap.parse_args()

    if args.all:
        posts = sorted(BLOG.glob("*/index.html"))
        if not posts:
            print("no posts found under", BLOG, file=sys.stderr)
            return 1
        print(f"Extracting narration for {len(posts)} posts:")
        for p in posts:
            try:
                process(p, None)
            except Exception as e:  # noqa: BLE001 - report and continue
                print(f"  {p.parent.name}: ERROR {e}", file=sys.stderr)
        return 0

    if not args.post:
        ap.error("provide a post path or --all")
    process(Path(args.post), Path(args.out) if args.out else None)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
