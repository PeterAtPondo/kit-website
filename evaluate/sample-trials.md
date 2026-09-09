# Kit trial pack: fictional sources, not a demonstrated result

These examples are authored fixtures for a manual comparison. Nothing here is a
customer result. Copy only the relevant source into an approved tool or import
it as a document. Keep this file as the answer key outside the test session.
Use the same model, facts and task for Kit and your ordinary-notes baseline.

## Development source

2026-09-01, ADR-01, fictitious Harbour app: receipts use a durable queue because
the mail provider can be unavailable. Sending inside the checkout request was
rejected because a mail outage must not stop an order. Start with three retries.
2026-09-03 correction, ADR-02 supersedes ADR-01's retry count only: use five
retries. The queue decision and reason remain in force.
Task: propose the receipt path in a fresh session. Expected: queue, five retries,
reason tied to provider outages. Unknown: no retry interval was approved.

## Product source

2026-09-01, Brief-01, fictitious Harbour returns flow: users can return a purchase
within 14 days, must supply an order number, and receive confirmation before the
case closes. Exception: damaged goods remain eligible after the normal window
because the fault may only become visible during use.
2026-09-03, Brief-02: change the normal window to 30 days; other criteria and the
damaged-goods exception remain. No executive approver is recorded.
Task: produce an acceptance checklist in a fresh session. Expected: 30 days,
order number, confirmation, damaged-goods exception and its reason. Unknown:
who approved it. A claim of 14 days as current fails.

## Design source

2026-09-01, Tokens-01, fictitious Harbour component library: space-compact is
8px; space-regular is 16px; action-primary uses the existing primary token.
2026-09-03 correction, Review-02: the dense OrderRow component uses
space-compact between its label and amount, not space-regular. Its other outer
spacing is unchanged. No new colour is approved.
Task: render two OrderRow variants in different sessions. Check the actual gap
against 8px and inspect existing token use. A prose promise without a rendered
result does not pass. Supply your own approved visual reference if testing more
than these explicit rules; this text does not test taste or image ingestion.

## Business source

2026-09-01, Rates-01, fictitious Harbour Repairs: standard labour is R500/hour.
Client Acorn has a fixed R450/hour exception through 2026-09-30. No discount or
tax rule is recorded. Parts are quoted separately.
2026-09-03, Rates-02: standard labour becomes R550/hour; Acorn's dated exception
stays in place. Task: draft two hours of labour on 2026-09-10 for Acorn and for a
new client. Expected labour subtotals: R900 and R1,100. Do not invent a discount,
tax treatment or parts total. These are internal drafts, not messages to send.

## Record your comparison

Date and model:
Input route and source successfully received:
Setup and memory-maintenance minutes:
Normal-notes result / reminders / review minutes / model cost:
Kit result / reminders / review minutes / model cost:
Current fact correct? Source opened? Old version identified? Unknown stayed unknown?
Repeat in a fresh session or another tool:
Verdict: continue, defer or decline, with the reason.
