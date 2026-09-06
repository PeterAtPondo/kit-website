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
  - .post__ref  (footnote markers)                              -> dropped
  - <pre> code blocks                                           -> dropped
  - inline strong / em / a / code  -> flattened to spoken text
  - <h2>  -> kept as a spoken section break (short pause)
  - <h3>  -> folded into the paragraph under it, as a spoken lead-in
  - <p>, <li>  -> kept as prose

The standfirst is the sentence or two after "Written by Kit, with Peter." in
the post byline. It is the note's opening line on the page, so it is the
opening line of the read as well; the credit itself is not repeated, because
the intro already says it.

The numbered sources live in the post footer rather than the body, so they
never reach this step: a narration that recites fourteen citations is not a
narration. The markers in the prose go the same way.

The extracted text is then handed to speakable.polish_file, which rewrites
dates, years, numbers and awkward names for the ear. Output is plain UTF-8
text with blank lines between blocks, ready to feed to the TTS step. No audio
is generated here.

Usage:
  python3 extract_script.py ../../blog/holding-isnt-trusting/index.html
  python3 extract_script.py --all          # every post under blog/
  python3 extract_script.py <post> -o out.txt
  python3 extract_script.py <post> --raw   # skip the speakable pass
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import speakable  # noqa: E402  (after the path insert, so it works from any cwd)

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


def _speak_inline_code(match: re.Match[str]) -> str:
    """Turn short inline identifiers into words without reading punctuation."""
    value = html.unescape(re.sub(r"<[^>]+>", "", match.group(1))).strip()
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    value = value.replace("/", " and ")
    value = value.replace("_", " ").replace("-", " ")
    value = value.replace(":", " colon ")
    value = re.sub(r"[<>]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


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

    # The byline carries the credit and then the standfirst. Drop the credit
    # (render_script speaks it already) and keep what follows.
    standfirst = ""
    mb = re.search(r'<p class="post__byline">(.*?)</p>', doc, re.S)
    if mb:
        standfirst = re.sub(r"^Written by [^.]*\.\s*", "", _clean_inline(mb.group(1)))

    body = _slice_body(doc)

    # Drop everything visual or duplicative BEFORE we read block text.
    body = _drop(r"<figure\b.*?</figure>", body)        # diagrams + captions
    body = _drop(r"<svg\b.*?</svg>", body)               # any stray svg
    body = _drop(r'<p class="post__pullquote">.*?</p>', body)
    body = _drop(r'<sup class="post__ref">.*?</sup>', body)
    body = _drop(r"<div class=\"post__table[^\"]*\".*?</div>", body)
    body = _drop(r"<table\b.*?</table>", body)
    body = _drop(r"<pre\b.*?</pre>", body)
    body = re.sub(r"<code\b[^>]*>(.*?)</code>", _speak_inline_code, body, flags=re.S)

    # Collect spoken blocks in document order: headings, paragraphs, list items.
    blocks: list[str] = []
    lead_in = ""   # an h3 waiting to be spoken as the head of the next block
    for m in re.finditer(r"<(h2|h3|p|li)\b[^>]*>(.*?)</\1>", body, re.S):
        kind, inner = m.group(1), m.group(2)
        txt = _clean_inline(inner)
        if not txt:
            continue
        if kind == "h3":
            # A short section inside a section. On the page it is a card
            # title; in the ear it is the first sentence of what follows.
            lead_in = txt.rstrip(".") + ". "
            continue
        if kind == "h2":
            if lead_in:                       # an h3 with nothing under it
                blocks.append(lead_in.strip())
                lead_in = ""
            # Section heading: give it room to breathe. ElevenLabs honours
            # <break> tags, so we add a longer pause before the heading (close
            # the previous section) and a shorter one after (settle before the
            # new section's prose). This makes a section change actually land
            # instead of running straight into the next paragraph.
            blocks.append(f'<break time="0.9s" /> {txt}. <break time="0.6s" />')
        else:
            blocks.append(lead_in + txt)
            lead_in = ""
    if lead_in:
        blocks.append(lead_in.strip())

    return {"title": title, "meta": meta, "standfirst": standfirst, "blocks": blocks}


def render_script(parsed: dict, include_intro: bool = True) -> str:
    out: list[str] = []
    if include_intro and parsed["title"]:
        # Title, then credit, then a beat, then the standfirst: the same order
        # the page puts them in.
        out.append(parsed["title"] + ".")
        out.append('Written by Kit, with Peter. <break time="1.0s" />')
        out.append("")
        if parsed.get("standfirst"):
            out.append(parsed["standfirst"])
    out.extend(parsed["blocks"])
    text = "\n\n".join(b.strip() for b in out if b.strip() != "")
    return text.strip() + "\n"


def process(post_html: Path, out: Path | None, speak: bool = True) -> Path:
    doc = post_html.read_text(encoding="utf-8")
    parsed = extract(doc)
    script = render_script(parsed)
    target = out or (post_html.parent / "narration.txt")
    target.write_text(script, encoding="utf-8")
    words = len(script.split())
    # ~150 wpm is a calm narration pace; report an estimate.
    secs = round(words / 150 * 60)
    print(f"  {post_html.parent.name}: {words} words  (~{secs//60}m{secs%60:02d}s)  -> {target}")
    if speak:
        # Second step, in the same run: rewrite the script for the ear. Its
        # report is the review aid, not a gate; read it before synthesising.
        for line in speakable.polish_file(target).lines():
            print(line)
    return target


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract narration text from a Kit blog post.")
    ap.add_argument("post", nargs="?", help="path to a post index.html")
    ap.add_argument("--all", action="store_true", help="process every post under blog/")
    ap.add_argument("-o", "--out", help="output path (single-post mode)")
    ap.add_argument("--raw", action="store_true",
                    help="skip the speakable pass and leave the extracted text as written")
    args = ap.parse_args()

    if args.all:
        posts = sorted(BLOG.glob("*/index.html"))
        if not posts:
            print("no posts found under", BLOG, file=sys.stderr)
            return 1
        print(f"Extracting narration for {len(posts)} posts:")
        for p in posts:
            try:
                process(p, None, speak=not args.raw)
            except Exception as e:  # noqa: BLE001 - report and continue
                print(f"  {p.parent.name}: ERROR {e}", file=sys.stderr)
        return 0

    if not args.post:
        ap.error("provide a post path or --all")
    process(Path(args.post), Path(args.out) if args.out else None, speak=not args.raw)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
