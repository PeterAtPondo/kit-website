#!/usr/bin/env python3
"""
Turn an extracted narration script into something the engine reads properly.

`extract_script.py` gives us the spoken arc of a post. It still contains prose
written for the eye: "31 August", "2021", "1,024 commits", "Fortune 500",
"Ollama", "Qwen". Read literally, those come out as "thirty-one August",
"two thousand and twenty-one", "one comma zero two four", "Fortune five zero
zero", "Oll-ama" and "Kwen" spelt as if it were English. This module rewrites
them for the ear, and nothing else changes.

What it does, in order:

  1. Dates            "31 August"        -> "the thirty-first of August"
  2. Years            "2026"             -> "twenty twenty-six"
  3. Money            "$4.5 billion"     -> "4.5 billion dollars", "$300" -> words
  4. Memory sizes     "512 gigabytes"    -> "five hundred and twelve gigs"
  5. Model names      "M5", "Qwen3.8-27B", "27B" -> spelt for the ear
  6. Big numbers      "1,024"            -> "one thousand and twenty-four"
  7. Pronunciation    "Ollama"           -> "Oh-Lama",  "Qwen" -> "Kwen"
  8. Past-tense read  a phrase list, "read" -> "red" where the tense demands it
  9. Typography       curly quotes and ellipses flattened to plain ASCII
 10. Heading pauses   the extractor's 0.6s after a heading becomes 1.4s

Break tags are protected before any of that runs and restored afterwards, so
no rule can ever reach inside one. A `<break time="0.6s" />` is markup the
engine obeys; rewriting the 0.6 into words would say the number out loud.

Used two ways:

    from speakable import polish_file
    polish_file(Path("blog/you-are-in-control/narration.txt"))

    python3 speakable.py ../../blog/you-are-in-control/narration.txt

The report it returns (and the CLI prints) is the review aid: any digit still
standing outside a break tag is something a human should look at, and every
"read" in the text is printed with its context so the tense can be checked by
eye. The CLI exits non-zero when digits remain.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ONES = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen",
]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

ORDINALS = {
    1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth",
    7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth", 11: "eleventh",
    12: "twelfth", 13: "thirteenth", 14: "fourteenth", 15: "fifteenth",
    16: "sixteenth", 17: "seventeenth", 18: "eighteenth", 19: "nineteenth",
    20: "twentieth", 21: "twenty-first", 22: "twenty-second",
    23: "twenty-third", 24: "twenty-fourth", 25: "twenty-fifth",
    26: "twenty-sixth", 27: "twenty-seventh", 28: "twenty-eighth",
    29: "twenty-ninth", 30: "thirtieth", 31: "thirty-first",
}

MONTHS = ("January|February|March|April|May|June|July|August|September"
          "|October|November|December")

# Names the engine mangles. Left is a regular expression, right is the spelling
# that comes out right. Add to this rather than spelling names phonetically in
# the article prose, which readers would see.
PRONUNCIATION = [
    (r"\bOllama\b", "Oh-Lama"),
    (r"\bQwen\b", "Kwen"),
    (r"\bPew\b", "Pew"),
]

# Phrases where "read" is past tense. River reads a bare "read" as the present
# tense far more often than not, so the past tense is spelt "red" for the
# engine. The spelling belongs here and in narration.txt only, never in the
# article. Keep the phrase long enough to be unambiguous.
PAST_TENSE_READ: list[str] = [
    "and read what comes back",
    "we read it",
    "had read",
    "have read",
    "has read",
]

# Typographic characters the engine has no business seeing. A narration script
# is read, not printed, so the plain forms are safer and identical to the ear.
SMART_PUNCTUATION = [
    (chr(0x2019), "'"), (chr(0x2018), "'"),
    (chr(0x201C), '"'), (chr(0x201D), '"'),
    (chr(0x2026), "..."),
]

# The extractor writes this after a heading; a section change needs longer.
HEADING_PAUSE_FROM = '<break time="0.6s" />'
HEADING_PAUSE_TO = '<break time="1.4s" />'

BREAK_TAG = re.compile(r"<break[^>]*>")


def words(n: int | str) -> str:
    """Spell a whole number the way it is said aloud."""
    n = int(n)
    if n < 0:
        return "minus " + words(-n)
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    if n < 1000:
        rest = n % 100
        return ONES[n // 100] + " hundred" + ("" if rest == 0 else " and " + words(rest))
    if n < 1_000_000:
        thousands, rest = n // 1000, n % 1000
        joiner = "" if rest == 0 else (" and " if rest < 100 else " ")
        return words(thousands) + " thousand" + joiner + ("" if rest == 0 else words(rest))
    # Beyond a million a spelt-out number is harder to follow than the figure.
    return str(n)


def _protect_breaks(text: str) -> tuple[str, list[str]]:
    """Swap every break tag for a digit-free placeholder."""
    tags: list[str] = []

    def stash(match: re.Match[str]) -> str:
        tags.append(match.group(0))
        return "\x00" + _letters(len(tags) - 1) + "\x00"

    return BREAK_TAG.sub(stash, text), tags


def _letters(index: int) -> str:
    """Base-26 letters, so a placeholder never contains a digit to rewrite."""
    out = ""
    index += 1
    while index:
        index, rest = divmod(index - 1, 26)
        out = chr(ord("A") + rest) + out
    return out


def _restore_breaks(text: str, tags: list[str]) -> str:
    def unstash(match: re.Match[str]) -> str:
        index = 0
        for char in match.group(1):
            index = index * 26 + (ord(char) - ord("A") + 1)
        return tags[index - 1]

    return re.sub(r"\x00([A-Z]+)\x00", unstash, text)


@dataclass
class Report:
    """What a reviewer needs to look at before the script is synthesised."""

    digits_left: int = 0
    heading_pauses: int = 0
    read_contexts: list[str] = field(default_factory=list)

    def lines(self) -> list[str]:
        out = [
            f"  speakable: {self.digits_left} digit(s) left outside break tags, "
            f"{self.heading_pauses} heading pause(s)"
        ]
        for context in self.read_contexts:
            out.append(f'    check the tense: ...{context}...')
        return out


def polish(text: str) -> tuple[str, Report]:
    """Rewrite a narration script for the ear. Returns the text and a report."""
    text, tags = _protect_breaks(text)

    def sub(pattern: str, replace) -> None:
        nonlocal text
        text = re.sub(pattern, replace, text)

    # 1. Dates, before years, so "31 August" is not read as a bare number.
    sub(rf"\b(\d{{1,2}}) ({MONTHS})\b",
        lambda m: f"the {ORDINALS[int(m.group(1))]} of {m.group(2)}"
        if 1 <= int(m.group(1)) <= 31 else m.group(0))
    # 2. Years: "twenty twenty-six", not "two thousand and twenty-six".
    sub(r"\b(20\d\d)\b",
        lambda m: ("twenty " + words(int(m.group(1)) - 2000))
        if int(m.group(1)) > 2000 else "two thousand")
    # 3. Money.
    sub(r"\$([\d,]+(?:\.\d+)?) (million|billion|trillion)",
        lambda m: m.group(1).replace(".", " point ") + " " + m.group(2) + " dollars")
    sub(r"\$([\d,]+)", lambda m: words(m.group(1).replace(",", "")) + " dollars")
    # 4. Memory sizes, said the way anyone says them out loud.
    sub(r"\b(\d+)[ -]gigabytes?\b", lambda m: words(m.group(1)) + " gigs")
    sub(r"\b(\d+)-gigabyte\b", lambda m: words(m.group(1)) + "-gig")
    sub(r"\b(\d+)[ -]GB\b", lambda m: words(m.group(1)) + " gigs")
    # 5. Model names, spelt for the ear.
    sub(r"\bM(\d)\b", lambda m: "M " + ONES[int(m.group(1))])
    sub(r"\bQwen3\.8-27B\b", lambda m: "Kwen three point eight, twenty-seven B")
    sub(r"\b(\d+)B\b", lambda m: words(m.group(1)) + " B")
    # 6. Numbers: decimals, then grouped thousands, then anything left.
    sub(r"\b(\d+)\.(\d) (million|billion|trillion)\b",
        lambda m: words(m.group(1)) + " point " + words(m.group(2)) + " " + m.group(3))
    sub(r"\b(\d+)\.(\d)\b", lambda m: words(m.group(1)) + " point " + words(m.group(2)))
    sub(r"\b(\d{1,3}(?:,\d{3})+)\b", lambda m: words(m.group(1).replace(",", "")))
    sub(r"\b(\d+)\b", lambda m: words(m.group(1)))
    # 7. Pronunciation table.
    for pattern, spelling in PRONUNCIATION:
        sub(pattern, lambda m, spelling=spelling: spelling)
    # 8. "read" in the past tense.
    for phrase in PAST_TENSE_READ:
        text = text.replace(phrase, phrase.replace("read", "red"))
    # 9. Typography.
    for fancy, plain in SMART_PUNCTUATION:
        text = text.replace(fancy, plain)

    text = _restore_breaks(text, tags)
    # 10. A section change needs more room than the extractor's default beat.
    text = text.replace(HEADING_PAUSE_FROM, HEADING_PAUSE_TO)

    report = Report(
        digits_left=len(re.findall(r"\d", BREAK_TAG.sub("", text))),
        heading_pauses=text.count(HEADING_PAUSE_TO),
        read_contexts=[
            text[max(0, m.start() - 40): m.end() + 30].replace("\n", " ")
            for m in re.finditer(r"\bread\b", text)
        ],
    )
    return text, report


def polish_file(path: Path) -> Report:
    """Rewrite a narration.txt in place. Safe to run twice."""
    text, report = polish(Path(path).read_text(encoding="utf-8"))
    Path(path).write_text(text, encoding="utf-8")
    return report


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: speakable.py <narration.txt>", file=sys.stderr)
        return 2
    target = Path(sys.argv[1])
    report = polish_file(target)
    for line in report.lines():
        print(line)
    return 1 if report.digits_left else 0


if __name__ == "__main__":
    raise SystemExit(main())
