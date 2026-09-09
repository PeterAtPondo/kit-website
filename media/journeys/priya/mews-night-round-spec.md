# The Mews night round

Blackfriars House keeps the best-run below stairs in Mayfur, and Mrs. Flint means to keep it that way. The Mews night round is a small app for logging the nightly walk below stairs: who walked which floor, at what hour, what they found, and what wants the housekeeper's eye come morning. It replaces the loose paper ledger kept by the area door, legible only to the cat who wrote it and easily left behind on the dresser. The app is not the watch's book, the tradescats' accounts, or anything above stairs; it is the household's own quiet record of its own quiet hours.

## Goals

- Give the round-walker a fast way to log each floor as it is walked, without waking the house.
- Give the housekeeper one morning list of the night's findings, with what needs her first at the top.
- Keep a plain record the steward can use when setting next week's roster.
- Make it easy to say, months later, what the round found on a given night and who found it.

## Non-goals

- The app does not roster the night watch outside the house; that stays Sergeant Paddock's book.
- The app does not manage wages, accounts, or the tradescats' bills.
- The app does not replace the housekeeper's own inspection; it only tells her where to look first.
- The app makes no judgement on what a finding means. It records, and leaves the reading of it below stairs.

## User roles

**The round-walker.** Whoever is rostered for the night, footman, hall boy, or scullery cat, carries the app on the walk and enters each floor as it is cleared.

**The housekeeper.** Mrs. Flint reads the night's entries first thing, before the fires are lit, and decides what wants attention that day.

**The steward.** Sets the roster and the floors walked, and reviews the week's entries when deciding whether the round still suits the house.

## Requirements

1. MNR-01. The round-walker starts a new round for the night with one action, recording their name and the date.
2. MNR-02. The app lists the floors below stairs in walking order, from cellar to attics, so the round-walker enters them as cleared.
3. MNR-03. The round begins at eleven o'clock, before the watch's own midnight round, and the app fills that hour in automatically.
4. MNR-04. For each floor, the round-walker records the hour it was reached by picking from a short list of times, without typing.
5. MNR-05. For each floor, the round-walker writes a short note of what was found, or marks the floor clear with one tap.
6. MNR-06. A finding can be flagged for the housekeeper's eye, separate from an ordinary note.
7. MNR-07. The app timestamps every entry on its own, so the round-walker never has to guess the hour later.
8. MNR-08. The housekeeper's morning view shows flagged findings first, then the rest of the night in floor order.
9. MNR-09. The housekeeper marks a flagged finding as seen, with her name and the time she saw it.
10. MNR-10. A round not finished by the time the kitchen fire is laid is marked unfinished, not silently dropped.
11. MNR-11. The steward can see, for any week, which nights ran late, which floors were skipped, and how often findings were flagged.
12. MNR-12. Past rounds stay in the record a full year before they may be cleared, so a question about an old night can still be answered.
13. MNR-13. Only the round-walker who opened a round can add to it, so two cats do not write over each other's floors.

## Data model

**Round**: date; round-walker; starting hour; finishing hour; whether finished.

**Floor entry**: round; floor name; hour reached; note; flagged (yes or no); cleared by housekeeper (yes or no, and by whom).

**Floor**: name; order in the walk.

**Roster**: week; round-walker assigned to each night; set by the steward.

## Open questions

- Should a flagged finding wake the housekeeper before morning, for something that cannot wait?
- Does the steward need a way to add a floor to the walk without waiting for the next roster change?
- Should the round-walker see past nights' notes on the same floor, to catch a pattern early?
- Who below stairs may read a closed round besides the housekeeper and the steward?

## Decisions log

- 3 February 1812: the round will start at eleven o'clock, after the last of the washing-up and before the watch's own midnight round.
- 19 February 1812: the round covers the cellar, the scullery, the kitchen passage, and the attics; the book-room and the family's own floors are not walked.
- 6 April 1812: a flagged finding is kept separate from an ordinary note, after Mrs. Flint asked for a way to tell "look at this" from "nothing happened."
- 21 May 1812: past rounds are kept a full year, not a season, after a wage dispute needed a night's record from four months back.
- 9 August 1812: only the round-walker who opened a round may add to it, after two entries for the same floor turned up on the same night.
