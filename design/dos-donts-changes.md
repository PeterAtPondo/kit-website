# Foundations beyond colour and type, the do and don't list, and the change plan

Section key: `dos-donts-changes`. Drafted 2026-08-22 against branch `kit/visual-consistency-design-867c62` at c46415a. Everything here is specification. Nothing in this section has been edited in code, and nothing is to be edited until the guide, the styleguide and the component library are done (the operator's scope order).

Conventions: paths are relative to the worktree; `index.html` means `api/ui/index.html`, `main.js` means `api/ui/src/main.js`, `Resources/` means `deploy/personal/macos/Resources/`, `Swift` means `deploy/personal/macos/KitPersonalApp.swift`. `AUDIT.md` and the six detail audits live in `scratchpad/audit/`. Rules in this section are numbered F1 to F7 so the change list can point at them; rules owned by the mark, tile, colour and type sections are referred to by name.

The fixed decisions this section builds on (not restated in full): one mark geometry with three reduction levels, rendered as fireflies in colour at 48 px and up and as a silhouette in mono or below 48 px; the orange tile only where Kit sits on someone else's ground; amber primary, lavender secondary (and the sleep state), green tertiary; night grounds `#020617` (floor), `--kit-bg-950 #0a0f1a`, `--kit-bg-900 #0f172a`; Fraunces, Manrope, JetBrains Mono; sentence case, no uppercase styling, no em or en dashes, no emoji icons, British English, "Kit".

---

## Part A. Foundations beyond colour and type

### F1. Spacing

**Rule F1.1: a 4 px base.** The web UI is already on it through Tailwind; the website declares it (`--space-1` to `--space-32`, kit-website `styles/tokens.css:37-47`, comment "Spacing scale (4px base)"). The native pages and the email are not.

What the web UI actually uses today (occurrence counts of Tailwind spacing utilities, `index.html` plus `api/ui/partials/*.html`, grep run 2026-08-22):

| Step | px | Uses | Reading |
|---|---|---|---|
| 0.5 | 2 | 303 | hairline gaps, chip inner padding |
| 1 | 4 | 708 | icon gaps, tight rows |
| 1.5 | 6 | 704 | chip padding, list gaps |
| 2 | 8 | 1119 | the workhorse |
| 2.5 | 10 | 283 | button padding |
| 3 | 12 | 1088 | card inner padding, row gaps |
| 3.5 | 14 | 50 | rare |
| 4 | 16 | 349 | card padding, section gaps |
| 5 | 20 | 134 | panel padding |
| 6 | 24 | 142 | section padding |
| 8 | 32 | 27 | page gutters |
| 10 | 40 | 8 | |
| 12 | 48 | 4 | |
| 16 | 64 | 4 | |
| px, 7, 9 | 1, 28, 36 | 13, 3, 1 | off-grid, retire |

Raw CSS padding in `index.html` drifts off the grid: `7px 7px 7px 16px` (composer, `:955`), `11px 14px` (opener, `:1085`), `5px 10px 5px 5px` (`:4003`), `9px 11px`, `6px 18px`, `4px 11px`, `padding:36px` (compact feedback and how-to cards, `:3984`, `:4033`), `22px 26px`. Resources: onboarding content card `clamp(18px, 2.6vh, 34px) clamp(28px, 6vw, 70px)` (`onboarding-shell.html:108`), load-html main `36px` (`load-html.html:31`), buttons `9px 16px` (`onboarding-shell.html:295`). Email: `26px 30px 22px`, `28px 30px 6px`, `13px 30px` (`api/services/email.py:179, 194, 203`).

**Rule F1.2: the named steps.** Ten steps carry the layout: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. The half steps 2, 6, 10 and 14 are allowed only inside controls (chip and button padding, icon gaps), never for layout. Anything else (7, 9, 11, 13, 18, 22, 26, 30, 36, 70) rounds to the nearest step when the code is touched.

**Rule F1.3: padding by role.**

| Role | Padding | Today (examples) |
|---|---|---|
| Chip, tag, pip label | 2 x 6 or 4 x 8 | `px-2 py-0.5` (`fireflies-sunburst.html:144`), `4px 11px` (`index.html:2662`) |
| Button | 8 x 12 (compact), 10 x 16 (default), 12 x 20 (primary) | `9px 16px` (`onboarding-shell.html:295`), `0 20px` at 44 px height (`index.html:4014`, `load-html.html:56`) |
| Card in a layout | 16 (compact window), 20 (desktop) | `kit-card` users at `p-4`/`p-5`; `16px 18px` (`index.html:1199`) |
| Scene card (the card that is the view: auth, onboarding, load-html, email, compact feedback) | 24 (narrow), 32 (wide) | `28px` (`index.html:1445`), `36px` (`:3984`, `load-html.html:31`), `26px 30px` (`email.py:179`) |
| Page gutter | 16 (compact), 24 (desktop), 32 (wide) | `32px 20px` (`index.html:1401`), `32px 16px` (`email.py:175`) |

**Rule F1.4: hit targets.** 28 px for icon-only buttons in dense chrome (`w-7 h-7`, 13 uses), 32 px for compact bars (the Lantern nav buttons are 30 px today, `index.html:3704-3754`), 36 px for default buttons, 44 px for primary actions and anything touched on a phone (already `min-height:44px` at `index.html:4014` and `load-html.html:56`).

### F2. Radius

The audit found no shared scale: 20 or more radius values in the web UI alone, the same "card" at 8, 10, 12, 14, 16, 18 and 22 px, website 6/12/20/32, pitch 4/8/16/24 (AUDIT.md drift 13; colour-type-tokens item 19). Counted today: Tailwind `rounded-md` 6 px (525 uses), `rounded` 4 px (265), `rounded-lg` 8 px (183), `rounded-full` (161), `rounded-sm` 2 px (19), `rounded-xl` 12 px (17), `rounded-2xl` 16 px (9); raw `border-radius` in `index.html`: 9 px (10), 8 (5), 6 (4), 16 (3), 12 (4), 10 (3), 14 (4), 22 (2), 7 (2), 18 (1), 0.32rem (1), 4 (2), 3 (1); Resources: 8 px (18), 12 (5), 10 (2), 13, 9, 16, 99 and 999 px.

**Rule F2.1: four steps plus pill.**

| Token | Value | Role |
|---|---|---|
| `--r-1` | 6 px | controls: inputs, checkboxes, chips, tags, menu rows, icon buttons, code blocks |
| `--r-2` | 10 px | buttons, popovers, tooltips, menus, inputs inside scene cards, compact nav pills |
| `--r-3` | 14 px | cards in a layout: `kit-card`, settings groups, skeleton cards, widget cards, drawers |
| `--r-4` | 20 px | scene cards: auth, onboarding, load-html, email, compact feedback and how-to, the composer capsule, sheets and modals |
| `--r-pill` | 999 px | pills, progress tracks, pips, avatars |

No other values. Tile corners (the mark on someone else's ground) are not on this scale; they follow the tile rule below.

**Rule F2.2: mapping today's values.**

| Today | Where | Becomes |
|---|---|---|
| 2 px `rounded-sm`, 3 px, 4 px `rounded`, 0.32rem (`index.html:363`), 5 px | web UI controls | `--r-1` 6 |
| 6 px `rounded-md`; website `--radius-sm` 6 | web UI, site | `--r-1` 6 |
| 7 px (`index.html:1110`, `:2662`) | icon button, chip | `--r-1` 6 |
| 8 px `rounded-lg` on buttons, inputs, menus; load-html buttons and `pre` (`load-html.html:41, 56`); onboarding buttons (`onboarding-shell.html:295` and the other 8 px rules) | controls | `--r-2` 10 |
| 8 px on cards: load-html main (`load-html.html:33`), onboarding content card (`onboarding-shell.html:111`) | scene cards | `--r-4` 20 |
| 9 px compact nav buttons (`index.html:3704-3754`), feedback inputs and buttons (`:3988-4016`) | controls | `--r-2` 10 |
| 10 px info popover (`index.html:254`), video frames (`:4047, :4054`), email button (`email.py:202-205`), MCP widget card (`mcp/src/widgets/shell.ts:58`) | popover, button and frames stay `--r-2` 10; the widget card becomes `--r-3` 14 | |
| 12 px `rounded-xl`, settings group (`index.html:1199`), skeleton card (`:1690`), `:2529`, `:2065`; onboarding 12 px (5 uses); website `--radius-md` 12 | cards | `--r-3` 14 |
| 13 px (`onboarding-shell.html`, 1 use) | | `--r-3` 14 |
| 14 px opener row (`index.html:1088`) | a large button | `--r-2` 10 |
| 14 px compact feedback and how-to cards (`index.html:3984`, `:4033`) | scene cards | `--r-4` 20 |
| 16 px `kit-card` (`index.html:325`), `rounded-2xl`; pitch `--r-lg` 16 | cards | `--r-3` 14 |
| 18 px email card (`email.py:177`), auth card on mobile (`index.html:1506`) | scene cards | `--r-4` 20 |
| 20 px website `--radius-lg` (hero video, `base.css:413`); pitch `--r-card` 20 | | `--r-4` 20 |
| 22 px composer (`index.html:957`), auth card (`:1446`) | | `--r-4` 20 |
| 24 px pitch `--r-xl`, 32 px website `--radius-xl` | | `--r-4` 20 (retire the larger step) |
| 99, 999, 9999 px, 50% | | `--r-pill` |

Cheapest path for the web UI: remap Tailwind's `borderRadius` in `api/ui/tailwind.config.js:16-36` (`theme.extend`) so `rounded-sm`, `rounded`, `rounded-md` resolve to 6, `rounded-lg` to 10, `rounded-xl` to 14, `rounded-2xl` to 20, the same way amber is already remapped there (`:25-36`). That moves about 1,000 call sites in one file; the raw CSS values above are then the only hand edits.

**Rule F2.3: tile corner.** Where the mark sits on the orange tile (Dock, Telegram, email, PWA, MCP host), the corner is 22% of the tile side, which is what `scripts/build-pwa-icons.py:38-44` already bakes and what iOS masks to; the macOS app icon keeps the build script's superellipse (`deploy/personal/build-app.sh:259-315`). Today's in-product tiles (header 12/44, auth 16/52 and 14/46, chat header 8/32, onboarding glyph 16/54, email 11/40 and 11/46) disappear with the tile rule, so only the exported tiles remain: a 40 px tile gets a 9 px corner, 46 gets 10, 512 gets 113.

### F3. Elevation and shadow

Every elevated panel has a bespoke shadow today (AUDIT.md drift 14): popover `0 10px 30px rgba(0,0,0,.45)` (`index.html:257`), composer `0 10px 30px rgba(0,0,0,.32)` (`:960`), auth card `0 28px 90px rgba(0,0,0,.62)` (`:1468`), onboarding card `0 28px 90px rgba(0,0,0,.34)` (`onboarding-shell.html:113`), load-html `0 24px 80px rgba(0,0,0,.38)` (`load-html.html:35`), website hero `0 24px 70px rgba(0,0,0,.45)` (`base.css:414`), Fireflies tuning panel `0 18px 44px rgba(0,0,0,.35)` (`fireflies-sunburst.html:141`), pitch `0 12px 32px rgba(0,0,0,.5)`, plus Tailwind `shadow-2xl` (23 uses), `shadow-xl` (2), `shadow-lg` (1). The only reusable glow recipe is `kit-card` (`index.html:325-334`).

**Rule F3.1: two recipes and nothing else.**

| Name | Recipe | Use for | Source |
|---|---|---|---|
| Halo (glow) | `box-shadow: 0 0 32px var(--kit-card-halo, transparent), inset 0 1px 0 0 rgba(var(--kit-white), .06), inset 0 0 20px 0 var(--kit-card-inner, transparent)`; with `border: 1px solid rgba(var(--kit-slate), .18)`, background `linear-gradient(to bottom, rgba(white,.06), transparent 32%)` over `rgba(var(--kit-bg-900), .60)`, `backdrop-filter: blur(12px)`, `transition: border-color .4s, box-shadow .4s ease-out`. The halo colour comes from `data-accent` (`index.html:430-470`). | Anything that rests on the night ground: cards, panels, drawers, the widget card. Elevation is expressed as light, not as a drop shadow. | `index.html:323-335` verbatim |
| Ambient (drop) | `box-shadow: 0 {y} {blur} rgba(0,0,0,.45)` at one of two sizes: float `0 10px 30px` for popovers, menus, tooltips, the composer; sheet `0 28px 90px` for modals, auth, onboarding, load-html and the website hero. Optionally plus the same `inset 0 1px 0 rgba(255,255,255,.05)` crease. | Anything that floats above other content. | built from `index.html:257` and `:1468` |

Retire the one-off glows and shadows: tile glow `0 0 22px rgba(amber,.40)` (`index.html:1609`, goes with the tile), auth logo `0 12px 34px rgba(232,165,92,.30)` (`:1483`), `0 0 6px #f0bd82` (`:2652`, `:2805`), `0 0 6px #e8a55c` (`:3169`), `0 0 6px #6bbfff` (`:1726`), `0 0 10px rgba(251,191,36,.7)` (`:2358`, `dashboard.html:1544`), send button `0 6px 18px rgba(240,160,43,.3)` (`:1024`), onboarding button `0 8px 22px rgba(139,92,246,.28)` (`onboarding-shell.html:299`), welcome marker `0 0 26px rgba(157,127,232,.30)` (`kit-welcome-body.html:16`), `shadow-2xl` (becomes the sheet size via a `boxShadow` remap in `tailwind.config.js`).

**Rule F3.2: not elevation.** Focus rings and status pips are state, not height, and are specified in the component library: one focus ring `0 0 0 3px rgba(var(--kit-amber), .35)` (already at `index.html:1030`), one pip glow `0 0 8px` in the pip's own colour. Today there are four pip recipes (dream pill `:7691-7695`, sleeping banner `:739-748`, live indicator `:774-779`, tab live dot `:1718-1733`).

**Rule F3.3: blur.** Backdrop blur is allowed on panels (two values: 12 on cards, 20 on sheets and the auth card; today 8, 10, 12, 16, 18, 22 all occur). Full-screen `filter: blur()` on a layer is not allowed (see F4.3).

### F4. Grounds and aurora

Twelve or more dark grounds ship today (`#020409 #020617 #050816 #05060f #060913 #060b16 #06080f #0a0e1a #0b0c10 #0d1318 #0f172a #050a18 #000`, plus white; AUDIT.md counts table) and nine or more sky recipes (colour-type-tokens item 21).

**Rule F4.1: one floor.** The page floor is `#020617` (`--kit-bg-980`, declared as "page background, aurora floor" at `index.html:160`). Today the token is not the floor: `html, body { background: #020409 }` is declared twice (`index.html:788`, `:1241`), the Lantern window paints the same `#020409` (`Swift:3298`) and the wake overlay closes on it (`index.html:1346`). Surfaces stack on the floor as `--kit-bg-950` (panels at .60 to .92 alpha) and `--kit-bg-900` (card bodies). The one exception is the Fireflies WebGL canvas, which stays `#000` because additive halos need a zero ground (`main.js:24020`, rule in the comment at `:23840-23845`); that black lives inside the viz container only.

Grounds to retire: `#020409` (`index.html:788, 1241, 1346, 1612`; `Swift:3298`), `#050816` and the auth gradient (`index.html:1408`), `#05060f` (`updating-page.html:6`), `#060913` (`static/dreaming.html:23`) and the dream canvas `#0b1124` to `#04060d` (`static/dream-overlay.js:238-240`), `#060b16` (`email.py:171`), `#0a0e1a` (`onboarding-shell.html:12`, `load-html.html:11`, kit-website `tokens.css:7`, kit-film `theme.ts:8`), `#0f1729` (`email.py:177`, one digit off `--kit-bg-900`), manifest `background_color #0f172a` (`api/ui/manifest.webmanifest:10`, should be the floor), `#0d1318` and `#0f1217` (docs), `#0b0c10` (widget mockups), `#050a18` and white (pitch, by design, flagged), `NSColor.windowBackgroundColor` for the classic onboarding window chrome (`Swift:3304`; the HTML inside paints its own ground so this only shows during load).

**Rule F4.2: one aurora.** The canonical sky is the static layer at `index.html:1236-1316`: `.aurora-bg` fixed at z 0; `.aurora-stars` 32 hand-placed pinpoints 0.6 to 1.6 px in white (.92/.60), `#e2e8f0`, cream `254,243,199` and periwinkle `199,210,254`, each `transparent 60%` (`:1249-1283`); `.aurora-bloom` four ellipses, violet `.18` at 18%/15% (55% x 40%), emerald `.10` at 88%/82% (55% x 45%), amber `.06` at 78%/18% (45% x 35%), blue `.06` at 28%/72% (40% x 30%) (`:1285-1291`); `.aurora-mood` two washes from `--kit-mood-wash` with a 1.8 s transition (`:1300-1305`); `.aurora-scope` a centre rose wash (`:1312-1316`). It is static, costs nothing per frame, and every Kit surface that can run CSS uses exactly this, including standalone pages (load-html, updater, dreaming, onboarding) by inlining the same values. The Lantern wake overlay already repeats the four ellipses (`:1340-1346`); it should reference the shared rule rather than carry a copy.

Under the colour hierarchy the bloom keeps its four hues at these alphas: amber is the primary but the sky is deliberately cool and faint so the fireflies read warm against it. The two starfields (32 CSS pinpoints here, 260 sprite stars in the galaxy at `main.js:25215-25230`) stay separate because one is CSS and one is WebGL, but they share the three star colours.

**Rule F4.3: no animated or blurred full-screen layers.** The comment at `index.html:1318-1330` records why: the drift and rotate layers were removed on 2026-04-18 after fullscreen `filter: blur()` starved the main thread and kept Three.js from mounting. The auth scene contradicts it today: its own gradient with stronger blooms (violet .46, emerald .28, amber .25, `:1404-1408`), its own 9-star field (`:1419-1431`) and a `::after` with `filter: blur(18px)` (`:1433-1441`). That is a second sky on the same product and it reintroduces the banned layer. Retire it; the auth card sits over the shared `.aurora-bg`.

Skies to retire, with the canonical replacing each: auth scene (`index.html:1394-1441`); dreaming canvas and page (`dream-overlay.js:238-240`, `dreaming.html:23`); updater ground plus violet radial glow plus wave canvas (`updating-page.html:6, 10, 74-81`); onboarding `body::after` linear washes (`onboarding-shell.html:52-59`); load-html flat ground (`load-html.html:11`); mockup radial washes (`mockups/kit-app-menu.html:20-22`, `lantern-housing.html:22-23`); website four animated `blur(140px)` screen-blend blobs (`base.css:68-120`) and the hero `blur(54px)` washes (`base.css:188-207`); pitch hub gradient (`globals.css`, `#0a1226` to `#050a18`); email flat `#060b16` (`email.py:171`; email gets the flat floor `#020617` with the card on `--kit-bg-900`, since mail clients cannot be trusted with gradients); docs `#0f1217` plus radial `#18202b`; widget mockups `#0b0c10`. The Fireflies container's own atmosphere veils (`main.js:23846-23867`) are part of the viz and stay.

### F5. Motion

What runs today. Transitions in `index.html` CSS: `.15s` (11), `.22s` (8), `140ms` (5), `.3s` (4), `.4s` (3), `.16s` (3), `400ms` (2), `1.8s` (2, mood washes), `.2s`, `.12s`, `.18s`, `360ms`, `160ms`, `.6s`, `.34s`; Tailwind `duration-200` (14), `-150` (4), `-300` (3), `-500` (2), `-100` (1); `transition-colors` 228, `transition` 138, `transition-transform` 14, `transition-all` 12. Easing: `ease-out` 19 in CSS plus 37 utilities, `ease-in-out` 18 plus 19, `linear` 30 (spinners and shimmers), `cubic-bezier(0.2, 0.8, 0.2, 1)` 3, `(.34, 1.4, .64, 1)` 1, `(.22, 1, .36, 1)` 1; website `--t-fast 120ms`, `--t-medium 280ms`, `--t-slow 600ms` (`tokens.css:60-62`); pitch `--ease-out cubic-bezier(0.22, 1, 0.36, 1)`; updater `cubic-bezier(.2,1.5,.35,1)` overshoot (`updating-page.html:26`).

Breath periods in circulation: `kitBreath` 4.6 s (`index.html:506`, comment `:490-493` "calm but present breath rate"), onboarding glyph 4.2 s (`onboarding-shell.html:1034`), updater 3.6 s (`updating-page.html:10-11`), wake card 3.8 s plus per-node twinkle 2.8 s (`mcp/src/widgets/wake.ts:250-257`), website nav mark 6 s (`base.css:280`), composer busy 2.8 s (`index.html:1040`), wake firefly 2.6 s (`:1359`), dream pill 2.6 s (`:7696`), sleeping banner 3.2 s (`:722`), `kitFresh` 4.4 s, `kitOverdue` 3.6 s, `kitUnslept` 5.8 s, `kitDreamPulse` 2.8 s, `kitDreamSpin` 72 s (`:540-584`), live dots 1.6 s (`:742`, `:1728`), widget dot 2.4 s (`shell.ts:76`). The galaxy itself does not breathe: position wobble at 0.7 to 0.9 rad/s (a 7 to 9 s period), amplitude .010 to .028, opacity easing 8% per frame, hub corona at 0.8 rad/s, working-memory ring at 1.3 rad/s, camera tween 750 ms, 30 fps cap, everything pauses under the pointer (`main.js:28184-28260, 28348-28362`; nodes-fireflies-reference section 6).

**Rule F5.1: four durations.**

| Token | Value | Use |
|---|---|---|
| `--t-1` | 120 ms | hover colour, focus ring, pressed state |
| `--t-2` | 200 ms | reveal, toggle, chip and row changes, small moves |
| `--t-3` | 320 ms | panel slide, drawer, modal and popover enter, tab change |
| `--t-4` | 600 ms | overlay fade, scene change, the wake overlay closing (`.6s` at `index.html:1347`) |
| mood | 1.8 s | only the aurora mood and scope washes (`index.html:1304, 1315`); not for UI |

Exits run at the next shorter step than their enter.

**Rule F5.2: two curves.** Standard `cubic-bezier(0.2, 0.8, 0.2, 1)` for enters and moves (already at three sites in `index.html`; `ease-out` is an acceptable alias in utilities); `ease-in-out` for loops (breath, mood). `linear` only for spinners and shimmers. No overshoot or spring curves except in the single wake moment (`main.js:30884-30893`), which is the one choreographed sequence in the product.

**Rule F5.3: one breath.** The mark breathes at 4.6 s `ease-in-out`, halo opacity and at most 4% scale (`kitBreath`, `index.html:494-506`, is the reference), and only when the mark stands alone as a moment: wake, auth, onboarding welcome and woken, updater. In chrome (app bar, chat header, nav) the mark is still; the 2026-08 decision at `index.html:2743-2748` ("plain, calm logo") becomes the rule. The mark never spins (retire `kitDreamSpin`, `:541-542`), never twinkles per node (`kitSatBreath` is already retired at `:511-522`; the wake card's `kw-twinkle` goes), and never recolours to show state (retire the `kit-dreaming`, `kit-fresh`, `kit-overdue`, `kit-unslept` auras `:528-584` and the chat header binding `'kit-' + rest_state`, `dashboard.html:1275`). State is a pip. Pips that mean "working" pulse at 2.3 s, exactly half the breath, so the two never fight; everything else is still. The website's 6 s, the onboarding's 4.2 s, the updater's 3.6 s and the wake card's 3.8 s all become 4.6 s.

**Rule F5.4: firefly motion follows the reference.** Any 2D port of the fireflies uses the galaxy's numbers: wobble `x += sin(.8t + p) A`, `y += cos(.9t + 1.1p) A`, `A = .010 + rand x .018`; opacity eases 8% per frame; no per-node twinkle on the base sprites; pulses only on the hub (0.8 rad/s, .42 plus or minus .10) and on attention rings (1.3 rad/s); 30 fps; pause under the pointer (AUDIT.md section 2, recipe items 7 and 8). The onboarding canvas runs an unthrottled `requestAnimationFrame` (`onboarding-shell.html:1606`); that is out.

**Rule F5.5: reduced motion.** Under `@media (prefers-reduced-motion: reduce)` every loop stops (mark static, pips solid), transitions drop to `--t-1` opacity only, canvases draw a still frame, the galaxy turns off auto-rotate and wobble. Coverage today: `index.html:656, 779, 1121, 1376, 1682, 1734, 2584, 7707` (and an empty placeholder at `:1511-1513`); `main.js:30789` (the wake overlay fades in centred with no wander, `:30862-30868`); `dream-overlay.js:329`; `updating-page.html:36`; `kit-welcome-body.html:18`; `wake.ts:258`, `saved.ts:55`, `recall.ts:65`; website `base.css:51, 130, 297, 436, 1600`. Gaps: `onboarding-shell.html` has no reduced-motion check at all (grep, 2026-08-22); the galaxy's `controls.autoRotate = true` (`main.js:24106`) and wobble have no reduced-motion branch that the audit found.

### F6. Iconography

Evidence: 100 inline `<svg>` in `index.html` plus partials, 66 of them `fill="none" stroke="currentColor"`, 80 on a 24-unit viewBox, 6 on a 20-unit viewBox (the welcome step icons, `kit-welcome-body.html:21-25`, at stroke 1.5); `stroke-linecap="round"` 87 times; stroke widths scattered: 1.3 (40, the mark's spokes), 2 (38), 2.5 (10), 1.6 (10), 1.8 (8), 4 (6, progress arcs), 1.5 (6), 1.7 (4), 1.2 (4), then 2.2, 1.4, 1, 0.6, 2.1, 1.9; sizes `w-4 h-4` 16 px (36), `w-3 h-3` 12 px (22), `w-3.5` 14 px (10), `w-5` 20 px (7). Channel manifests already name icons by Lucide name (`"icon": "send"`, `"icon": "hash"`; `api/services/channels/telegram/telegram.manifest.json:1`). The native status menu uses SF Symbols (`Swift:650-666`, rows at `:704-991`). Emoji and text glyphs still stand in for icons: tick, cross and warning characters (`index.html:4523, 7147, 7395, 7452`; `included-folders.html:53, 58, 94`; `dashboard.html:1207, 1225`; `flows.html:386, 392`), a padlock emoji (`index.html:5402`), an orange heart emoji (`reflections.html:98-102`, `monologue.html:144-148, 293-297`, `postcards.html:73-77`, `research.html:117-121`), a runner emoji (`build-connections.html:227`), an envelope character (`build-connections.html:133`).

**Rule F6.1 (memory m#653, m#123639): stroke SVG, never emoji.** Icons are monochrome stroke SVGs in the Lucide idiom: 24-unit viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins. No Unicode emoji or dingbats as icons anywhere in Kit's UI, copy, email or Telegram formatting; no filled icons except the mark, pips and avatars.

**Rule F6.2: three sizes.** 16 px inline and in dense rows, 20 px in buttons and list rows, 24 px in headers and empty states; 12 px only for chevrons and the caret. Stroke stays 2 at every size (optical correction is done by choosing a simpler glyph, not a thinner line). The 20-unit welcome icons are redrawn on 24 units.

**Rule F6.3: the mark is not an icon.** It has its own geometry, reduction levels and silhouette rule (mark section). Never redraw it as an icon; use the shared symbol. The welcome step 4 mini constellation (`kit-welcome-body.html:24`), the Universe chip (`fireflies-sunburst.html:17-24`), the Ask Kit glyph (`index.html:3012-3024`) and the composer thinking glyph (`dashboard.html:2021-2027`) are the four places an icon currently pretends to be the mark.

**Rule F6.4: native menus.** The macOS status menu keeps SF Symbols in regular weight (platform idiom; `Swift:650-666`); the menu bar glyph itself is the mark's small silhouette (mark section), not an SF Symbol.

### F7. Copy

Soul rules that bind copy and UI: sentence case, no uppercase styling (soul rule #3257, quoted in the code at `dashboard.html:2073-2074`, "no uppercase styling; normalise it whenever the UI is touched"); no em dashes (soul rule #3256, enforced by the repo's pre-tool hook `scripts/hooks/pretool__block_em_dash.py`; m#143065 house style; m#144591 records "warm, present, brief. Sentence case. No em dashes" as the hardcoded voice); British English (core rule #132639; m#132646, m#135772); "Kit" never "legacy-name", no emoji (m#653); default brevity (m#3298).

**Rule F7.1: sentence case, no uppercase styling.** No `text-transform: uppercase`, no all-caps labels or eyebrows; acronyms and codes are fine. Gated since 25 August 2026 by `test_no_typed_capitals_in_copy` and `test_no_copy_upcases_a_name_at_runtime` in `tests/test_typography_is_one_scale.py`, and on Kit's own prose by `scripts/hooks/pretool__block_all_caps.py`, the em-dash hook's counterpart. Today: the web UI is clean except one `uppercase` on the pairing code input (`index.html:2301`, `ABCD-1234`, a data format, acceptable as a formatting rule on a code field, to be confirmed by the operator); the website has five (`base.css:636, 778, 1058`; `blog.css:288, 365`); the email already sets `text-transform:none` (`email.py:185`). Eyebrows: 225 uses of letterspaced eyebrows in the web UI (`tracking-[0.18em]` 66, `0.16em` 44, `0.08em` 26, `0.22em` 22, `0.12em` 14, `0.14em` 13, and eight other values). Large tracking on lowercase reads as a leftover from the caps era; one eyebrow style: 11 px, weight 500, tracking 0.06em, sentence case (type section to confirm the size).

**Rule F7.2: no em or en dashes.** Use commas, colons, parentheses, or two sentences. Outlets already enforcing it: Telegram outbound runs `_normalise_dashes_for_voice` (`api/services/connections/service.py:1425-1465`); `email.py`, the Swift strings and `Resources/*.html` contain none (grep, 2026-08-22). Remaining: `index.html` 57 and partials 35 (mostly CSS and HTML comments, plus the em dash used as an empty-value placeholder (U+2014) at `index.html:2398, 2424` and `dashboard.html:190, 213, 248, 265, 281`, and em dash joins such as "Capacity" joined to its label at `dashboard.html:252, 269, 285`); `main.js` 442 (almost all code comments; user-facing strings at `:9552` and `:10200`) and 8 en dashes. Placeholders become a middle dot `·` (the email signature already uses `&middot;`, `mailbox.py:51`) or the word "none". Comments are not copy, but get cleaned when the line is touched.

**Rule F7.3: British English.** organise, recognise, colour, centre, modelled. The product mostly complies ("Organise your memory.", `Swift:2159`; "Recognising people and ideas", `dream-overlay.js:24`); `dashboard.html:190` has "Modeled". Code identifiers and CSS (`color-scheme`) are exempt.

**Rule F7.4: the name.** "Kit" in mixed case, never "KIT" or "kit" in prose, never "legacy-name" (the palette key at `main.js:23871` is data and stays). The wordmark is Fraunces 500 (type section); the heavy sans wordmark in the personas (`docs/personas/persona.css:181`) and the Georgia wordmark in email (`email.py:184, 294`; `mailbox.py:47`) are off-rule.

**Rule F7.5: voice.** Warm, present, brief (m#3298): one sentence by default, the second earned. Microcopy states what is happening, not what the system is ("Lighting the lantern", `main.js:30782`, is the register).

---

## Part B. Do and don't

| Area | Do | Don't | Where the don't lives today |
|---|---|---|---|
| Mark | Use the one shared symbol at one of its three reduction levels; fireflies in colour at 48 px and up, silhouette in mono or below 48 px. | Redraw the mark per surface, or draw it as an icon. | Thirteen geometries: hub+4 in six tunings (`index.html:2749-2767, 3012-3024`; `build-pwa-icons.py:64-103`; `updating-page.html:50-61`; kit-website `favicon.svg`, `index.html:141-151`), hub+4 without spokes (`dashboard.html:2021-2027`; `fireflies-sunburst.html:17-24`), hub+3 (`Swift:1080-1112`), core-less quad (`wake.ts:264-272`), 3+1 chain and lens (`saved.ts:58-66`, `recall.ts:69-72`), 3-node line icon (`kit-welcome-body.html:24`), pentagon (kit-film `index.tsx:213-235`) (AUDIT.md section 1) |
| Mark | Keep the mark still in chrome; let it breathe only as a standalone moment, at 4.6 s. | Spin it, twinkle its nodes, or recolour it by state. | `kitDreamSpin 72s` (`index.html:541-542`); state auras (`:528-584`, bound at `dashboard.html:1275`); `kw-twinkle` (`wake.ts:254`); `.sat twinkle` (`updating-page.html:27`) |
| Mark | Paint the mark white or amber on night ground; in colour, near-white cores with warm halos. | Paint it amber on the amber tile, emerald, lavender, blue or hard white without appearance handling. | Amber on amber loader (`fireflies-sunburst.html:257`); emerald (`shell.ts:47`); lavender `#c4b9f8` (`updating-page.html:11`); blue `#6bbfff` (kit-film `theme.ts:17`); white non-template (`Swift:1026, 1084-1085`) |
| Tile | Use the orange tile only on someone else's ground: Dock, Telegram, email, PWA and home screen, MCP host. One gradient, `#ff9a23` to `#ff850f` to `#fa7103`, corner 22%. | Put a tile behind the mark inside Kit's own surfaces, or invent a gradient. | In-product tiles at `index.html:2749` (`#e8a55c` to `#f97316`), `:1487` (`#e8a55c` to `#fb923c`), `dashboard.html:1274`; `build-pwa-icons.py:26-28` (`#fbbf24` to `#f97316`); six tile gradients counted (AUDIT.md drift 8) |
| Tile | Ship a real maskable icon with safe-zone padding and an opaque apple-touch icon. | Copy the 512 as "maskable" with transparent corners. | `build-pwa-icons.py:125-135` (maskable is a byte copy; apple-touch has alpha) |
| Colour | Amber primary everywhere; lavender for sleep, dream and consolidation; green for health, fresh, live. | Make purple the primary on one half of the product and amber on the other. | Purple CTAs on every Mac page (`onboarding-shell.html:297, 436, 541, 795, 879, 1122, 1252`; `load-html.html:60`) vs amber web primary (`index.html:1570`); `--green: #9d7fe8` (`onboarding-shell.html:23`) (AUDIT.md drift 2) |
| Colour | Reach for `--kit-*` tokens and the remapped amber scale. | Write stock Tailwind hex or `rgba(245,158,11)` by hand. | `#fcd34d` x33 and `rgba(245,158,11)` x38 in partials, `#fde68a` x21 in `index.html`, 116 literals in `main.js` (AUDIT.md drift 6); `healthStatusColor '#fbbf24'` (`main.js:1887`) |
| Colour | One floor, `#020617`. | Invent a ground per page. | 12 or more grounds (F4.1 list) |
| Type | Fraunces for display and the wordmark, Manrope for UI, JetBrains Mono for data, applied through the font tokens and `font-serif` / `font-sans`. | Override the body font with a system stack, apply Fraunces inline, or fall back to Georgia or Inter where web fonts can load. | `index.html:789` overrides `:176`; twelve inline Fraunces styles (AUDIT.md drift 12); Georgia at `dream-overlay.js:57, 70`; Inter at `shell.ts:52` and `docs/federation.html:22` |
| Spacing | Stay on the 4 px grid; component padding by role (F1.3); hit targets 28/32/36/44. | Hand-tune 7, 9, 11, 13, 22, 26, 36 px paddings. | `index.html:955, 1085, 3984, 4003`; `onboarding-shell.html:108`; `email.py:179, 194` |
| Radius | Four steps (6/10/14/20) plus pill, by role. | Pick a radius per component. | 20 or more values (F2 mapping table; AUDIT.md drift 13) |
| Elevation | Halo recipe for anything resting on the ground; one ambient drop shadow (float or sheet) for anything floating. | Write a new shadow for each panel. | `index.html:257, 960, 1468`; `onboarding-shell.html:113`; `load-html.html:35`; `base.css:414`; `fireflies-sunburst.html:141` (AUDIT.md drift 14) |
| Aurora | One static sky (`index.html:1236-1316`) behind everything, inlined on standalone pages. | Build a second sky, or animate or blur a full-screen layer. | Auth scene `index.html:1394-1441` with `filter: blur(18px)` at `:1433-1441`, contradicting `:1318-1330`; website `blur(140px)` blobs (`base.css:68-120`); nine recipes (F4.3 list) |
| Fireflies | Render nodes with the reference recipe: two procedural alpha sprites, `lighter` compositing, core toward `#fffdf4` and halo toward `#ffc36b`, size by meaning, bowed faint traces for edges. | Draw a three-stop radial gradient with a crisp white circle on top, or a `border-radius:50%` div with a box-shadow, and call it a firefly. | `onboarding-shell.html:1553-1563, 1587-1600`; `dream-overlay.js:279-286`; the construction named as the failure at `main.js:23904-23906`; fourteen or more box-shadow dots (nodes-elsewhere a3) |
| Fireflies | Keep green and blue out of the ambient node palette; warm first. | Round-robin amber, purple, mint and sky. | `COLORS` at `onboarding-shell.html:1352`; website `index.html:1440-1443` blue-dominant |
| Motion | Four durations, two curves, one breath, pips at half the breath; honour reduced motion everywhere. | Ship a breath period per surface, or an unthrottled canvas loop. | 4.2, 3.6, 3.8, 6, 2.6, 2.8, 3.2 s breaths (F5 list); `onboarding-shell.html:1606` and no reduced-motion branch in that file |
| Icons | Stroke SVG, 24 units, stroke 2, `currentColor`, 16/20/24 px. | Emoji, dingbats, filled glyphs, 20-unit grids, stroke widths from 0.6 to 2.5. | Heart, padlock, runner, envelope, tick, cross and warning characters (F6 list); 15 distinct stroke widths |
| Copy | Sentence case, no dashes, British English, "Kit", one sentence by default. | Uppercase eyebrows, em dash joins, "Modeled", "legacy-name", a heavy sans wordmark. | Website `text-transform: uppercase` (5 sites); `dashboard.html:190, 252`; `persona.css:181`; em dash placeholders (U+2014) |
| Widgets | The MCP widget shell is a Kit surface: night ground, halo card at `--r-3`, Manrope, amber accent, the canonical mark. | Treat the widget as a third brand. | `mcp/src/widgets/shell.ts:46-60` (emerald, Inter, radius 10, panel `#0f172a`); vendored copy `api/ui/src/vendor/kit-widgets/shell.ts:55` |
| Process | Specify first (this guide), then the component library, then code, one symbol and one token file that every surface consumes. | Fix a surface in isolation, or leave retired CSS in the sheet. | Retired but live: `kitSatBreath` `:511-522`, `.kit-state-pip*` `:604-650`, `.install-orbit` (`onboarding-shell.html:647-714`, retired per `:1040`); stale comments `index.html:2751-2753, 3012`, `dashboard.html:2015`, kit-website `index.html:138-140` |

---

## Part C. Phased change list

This is a plan. Nothing is to be edited now; each item waits for the guide, the styleguide and the component library. Size: S under an hour of careful work, M a session, L several sessions or a cross-surface asset pipeline. "Rule" names the foundation rule above or the owning section.

### Phase 1a. Web UI (`api/ui/index.html`, partials, `src/main.js`, MCP widget shell)

| # | What changes | File:line | Rule | Size |
|---|---|---|---|---|
| W1 | Declare the foundation tokens next to `--kit-*`: space steps, `--r-1` to `--r-4` and `--r-pill`, halo and ambient shadow, `--t-1` to `--t-4`, breath 4.6 s. Delete the dead Family A colour tokens (`--bg-deep` to `--accent-green`), keep the three font tokens. | `index.html:126-139` (dead), `:141-174` (home of `--kit-*`) | F1, F2, F3, F5; colour section | S |
| W2 | Remap Tailwind `borderRadius` (sm/default/md to 6, lg to 10, xl to 14, 2xl to 20) and `boxShadow` (2xl to the sheet recipe) in the config, alongside the existing amber remap. | `api/ui/tailwind.config.js:16-36` | F2.2, F3.1 | S |
| W3 | Page floor to `#020617`: both `html, body` rules, the wake overlay base, the viz fallback, the primary button ink; manifest `background_color`. | `index.html:788, 1241, 1346, 1612, 1570-1572, 5085`; `manifest.webmanifest:10` | F4.1 | S |
| W4 | Retire the auth scene's sky (gradient, stars, blurred `::after`); the auth card sits over `.aurora-bg`; the wake overlay references the shared bloom rather than a copy. | `index.html:1394-1441`; `:1340-1346` | F4.2, F4.3 | M |
| W5 | Raw radii to the scale: `kit-card` 16 to 14; compact feedback and how-to cards 14 to 20 and their 9 px controls to 10; compact nav buttons 9 to 10; settings group, skeleton card and frames 12 to 14; opener 14 to 10; 7 px and 0.32rem to 6; composer and auth card 22 (18 mobile) to 20. | `index.html:325, 3984, 4033, 3988-4016, 3704-3754, 1199, 1690, 2529, 1088, 1110, 2662, 363, 957, 1446, 1506` | F2.2 | M |
| W6 | Shadows to the two recipes: popover and composer to float; auth card to sheet; drop the one-off glows (tile glow, auth logo, `0 0 6px` x4, `0 0 10px`, send button); pips to the one pip glow; focus ring stays. | `index.html:257, 960, 1468, 1609, 1483, 2652, 2805, 3169, 1726, 2358, 1024; 7691-7695, 739-748, 774-779, 1718-1733`; `dashboard.html:1544` | F3 | M |
| W7 | Motion: transitions to `--t-1`/`--t-2`/`--t-3`/`--t-4` and the standard curve; one breath: keep `kitBreath` 4.6 s, retire `kitSatBreath`, `kitDreamPulse`, `kitDreamSpin`, `kitFresh`, `kitOverdue`, `kitUnslept`, the `.kit-state-pip*` block; composer busy, dream pill and live dots to 2.3 s; sleeping banner to 4.6 s and `--kit-purple`; wake-breath to 4.6 s; remove the empty reduced-motion placeholder. | `index.html:494-650, 712-748, 1034-1046, 1359-1364, 1511-1513, 1728, 7696`; `dashboard.html:1275` | F5 | M |
| W8 | Icons: replace emoji and text glyphs with stroke SVGs; normalise stroke to 2 and sizes to 16/20/24; redraw the 20-unit icons on 24 units. | `index.html:4523, 5402, 7147, 7395, 7452`; `included-folders.html:53, 58, 94`; `dashboard.html:1207, 1225`; `flows.html:386, 392`; `reflections.html:98-102`; `monologue.html:144-148, 293-297`; `postcards.html:73-77`; `research.html:117-121`; `build-connections.html:133, 227` | F6 | M |
| W9 | Copy: eyebrows to the one eyebrow style (225 sites, mostly mechanical); em dash placeholders to `·`; dash joins and "Modeled"; two user-facing strings in `main.js`; confirm the code-input `uppercase`. | `index.html:2398, 2424, 2301`; `dashboard.html:190, 213, 248, 252, 265, 269, 281, 285`; `main.js:9552, 10200` | F7 | S |
| W10 | Type: delete the system-stack body override so Manrope renders; drop the unloaded `EB Garamond`; inline Fraunces to `font-serif`; one heading scale (Entities, settings header, pair and ingest modals, compact feedback and how-to). | `index.html:789, 230, 4946, 5180-5183, 6330-6345, 3816-3830, 3982-3996, 4031-4048`; `build-roles.html:20, 32, 133`; `build-actors.html:41, 130, 279`; `flows.html:1043`; `studio-overview.html:303`; `triggers.html:6`; `timeline.html:163`; `studio-tokens.html:264`; `entities.html:5` | type section | M |
| W11 | Mark in the web UI: one shared symbol; app bar and chat header lose the tile and show the mid-reduction silhouette on the ground; the six auth, invite, pair, welcome and demo cards lose the tile and show the fireflies mark at 56 px; Ask Kit, composer thinking, Universe chip and the Fireflies loader use the symbol (loader no longer amber on amber); retire `.kit-auth-logo*` tile CSS; fix the stale comments. | `index.html:2749-2767, 1479-1509, 1747, 2129, 2169, 6460, 6577, 6650, 3012-3024, 2751-2753`; `dashboard.html:1274-1288, 2015-2027`; `fireflies-sunburst.html:17-24, 257-269` | mark section; F5.3, F6.3 | L |
| W12 | Exported tiles: regenerate favicon, PWA, apple-touch, maskable and notification icons from the new glyph on the canonical orange tile at 22% corner, with a real safe-zone maskable and an opaque apple-touch; add an SVG favicon; precached logo path updated. | `scripts/build-pwa-icons.py:26-28, 38-44, 64-103, 125-135`; `index.html:17-31`; `service-worker.js:21, 172-173`; `manifest.webmanifest:13-15` | tile section; F2.3 | M |
| W13 | MCP widget shell and cards: accent emerald to amber, Inter to Manrope, card radius 10 to 14 with the halo recipe, panel on `--kit-bg-900`, the canonical mark in wake, saved and recall; `kit-card-pulse` dot to the pip rule at 2.3 s; regenerate the vendored copies; refresh `media/wake-card.png` on the website afterwards. | `mcp/src/widgets/shell.ts:46-60, 75-76`; `wake.ts:100-118, 250-280`; `saved.ts:58-66`; `recall.ts:69-72`; `api/ui/src/vendor/kit-widgets/*` | mark, colour, type sections; F2, F3, F5 | M |
| W14 | Colour: composer send `#fbbf24`/`#f0a02b` to the amber scale; `healthStatusColor` degraded `#fbbf24` and `_KIT_PALETTE` home `#f59e0b` to amber; raw `#fcd34d`, `#fde68a`, `rgba(245,158,11)` to tokens; define or drop `data-accent="slate"` and `"blue"`; dream-quality modal purples to tokens. | `index.html:1023, 430-470, 3097, 5008, 5021, 5028, 5816, 5839, 6925, 7353, 7507, 7566`; `main.js:1887, 9714, 16972, 21897-21903, 23092-23162`; partials (33 plus 38 sites) | colour section | L |
| W15 | Dream overlay and dreaming page: the firefly recipe (`lighter` is already on at `:241`, but motes are three-stop plus crisp core and violet only) with lavender as the dream hue under the warm core/halo lerp; ground to the floor plus shared aurora; Georgia and system sans to Fraunces and Manrope with fonts loaded. | `api/ui/static/dream-overlay.js:19-21, 52, 57, 70, 238-240, 279-286`; `static/dreaming.html:23, 32-38` | F4, F5.4; type section; mark section (firefly recipe) | L |
| W16 | Studio run "mini fireflies" and the vitality rings to the recipe and tokens. | `main.js:4147-4215, ~30635`; `studio-runs.html:926-938` | mark section (firefly recipe) | M |
| W17 | Galaxy reference hygiene before it is copied: one working-memory yellow, one core/halo lerp pair, labels in the brand fonts, settle the `brightness 0.01` tuning against the "white-hot core" comment, reduced-motion branch for auto-rotate and wobble. | `main.js:24519` vs `25668`; `24450-24451` vs `25620-25621`; `25525, 24355`; `1540, 24443-24449`; `24106, 28190, 28218-28220` | F5.4, F5.5; mark section | M |
| W18 | Pair-device and ingest modals onto the halo card and sheet shadow; settings overlay onto the shared panel; Memories tab gets a headline; the create-memory modal loses its light-theme markup. | `index.html:6330-6430, 3813-3830, 5169-5190, 5092-5138`; `partials/ingest.html:4-12`; `partials/memories.html` | F2, F3; type section | M |

### Phase 1b. The Lantern (`Resources/*.html`, `KitPersonalApp.swift`, build scripts)

| # | What changes | File:line | Rule | Size |
|---|---|---|---|---|
| L1 | Menu bar glyph: the small silhouette reduction of the mark (hub plus three companions, heavier), drawn as a template image so it follows light and dark menu bars, with the status dot as a separate coloured overlay; status dot colours to the exact `--kit-*` values (amber 232,165,92; purple 167,139,250; emerald 52,211,153; red 248,113,113). | `Swift:1019-1029` (`isTemplate = false`), `:1080-1112`, `:603-617` | mark section; colour section | M |
| L2 | Lantern window ground to `#020617`. | `Swift:3298` | F4.1 | S |
| L3 | Dock and Finder icon regenerated from the new glyph on the canonical tile; superellipse mask stays; `applicationIconImage` fallback chain points at the new asset; add a DMG volume icon if the release script grows one. | `deploy/personal/build-app.sh:37-38, 256-331`; `Swift:302, 1032-1045`; `make-dmg.sh:40-50` | tile section; F2.3 | M |
| L4 | Onboarding shell tokens and ground: `--bg` to `#020617`, `--green` to emerald (it is purple today), `body::after` washes replaced by the inlined shared aurora; content card radius 8 to 20, shadow to sheet, padding to the grid; Georgia fallback at `:1280` to the font token. | `onboarding-shell.html:10-26, 52-59, 105-115, 1280` | F1, F2, F3, F4; colour section | M |
| L5 | Onboarding canvas to the firefly recipe: two procedural sprites, `lighter`, warm core/halo lerp, amber-first palette (green and blue out of the ambient field), size by meaning, bowed faint traces for links, 30 fps cap, a still frame under reduced motion. The woken constellation (`setAct(3, 12)`) inherits it. | `onboarding-shell.html:1349-1620` (palette `:1352`, nodes `:1553-1563, 1587-1600`, edges `:1505-1516, 1570-1585`, loop `:1606`); `woken-ready-script.html:18` | F5.4, F5.5; mark section (firefly recipe) | L |
| L6 | Onboarding mark: `.kit-glyph` loses the tile (the full-bleed square SVG rounded by CSS) and shows the fireflies mark at 56 px on the ground with the halo recipe; breath 4.2 s to 4.6 s; Swift emits the new asset. | `onboarding-shell.html:208-218, 1034-1038`; `Swift:2616-2619` | mark section; F3, F5.3 | M |
| L7 | Purple CTAs and the purple-as-success dots to amber primary and emerald success; button radius 8 to 10; button shadow dropped; birth-recovery primary `#eeb066`/`#db8a3c` to the amber scale; remove the retired orbit CSS. | `onboarding-shell.html:297, 436, 541, 795, 879, 1122, 1252, 294-302, 285-290, 318-330, 1299, 647-714` | colour section; F2, F3 | M |
| L8 | Welcome step icons redrawn on 24 units at stroke 2; step 4 becomes a generic stroke icon, not a mark variant; marker glow to the pip rule. | `kit-welcome-body.html:16, 21-25` | F6 | S |
| L9 | Updating page: ground to `#020617` plus inlined aurora; the lavender hub+4 becomes the fireflies mark at 66 px; `.glow` to the halo recipe; breath 3.6 s to 4.6 s; the woken gold set (`#f7d49a`, `#ffe0a3`, `245,201,122`) to firefly `#ffc46b` and warm white `#fff3df`; progress bar violet to amber; wave canvas retired or re-tinted as the aurora; overshoot `wakePop` curve reviewed under F5.2. | `updating-page.html:6, 10-15, 19-20, 25-30, 50-61, 74-81` | F4, F5; mark, colour sections | M |
| L10 | Load-html pages (Stopped, Resetting, Uninstalling, Clearing, payload missing, admin missing): ground to `#020617` plus inlined aurora; main card radius 8 to 20, shadow to sheet, padding 36 to 32; buttons radius 8 to 10 and the purple primary to amber; add the silhouette mark and wordmark header so the page reads as Kit. | `load-html.html:9-17, 11, 29-36, 40-48, 55-62` | F1, F2, F3, F4; mark, colour sections | M |
| L11 | Dreaming panel inside the Lantern follows W15. | `Swift:3136`; `static/dreaming.html` | as W15 | S |
| L12 | Telegram bot avatar: ship the tile asset and add the BotFather profile-photo step to onboarding copy. | `Resources/telegram-body.html:1`; no asset exists today (glyph-app-comms section 2) | tile section | S |
| L13 | MCP host icon: add an icon to the package and a server manifest so hosts stop showing a default glyph. | `mcp/package.json` (no icon field; glyph-app-comms section 7) | tile section | S |

### Phase 2. Website, email, docs, film, pitch

| # | What changes | File:line | Rule | Size |
|---|---|---|---|---|
| S1 | kit-website tokens: `--bg-deep` to `#020617` and the surface family to the bg-950/900 tokens; accent roles to the hierarchy (amber primary for links and focus, blue demoted); radii 6/12/20/32 to 6/10/14/20; transitions to `--t-1`..`--t-4`; `theme-color` to the floor. | `kit-website/styles/tokens.css:7-10, 17-20, 51-54, 60-62`; `index.html:27` | F2, F4, F5; colour section | M |
| S2 | Website aurora: four animated `blur(140px)` blobs and the hero `blur(54px)` washes replaced by the static canonical sky. | `kit-website/styles/base.css:68-120, 188-207` | F4.2, F4.3 | M |
| S3 | Nav mark on 33 pages and the favicon: the canonical silhouette in amber (not `#fbbf24`), still (not a 6 s breath); add PNG, apple-touch and a web manifest; delete the stale "same mark used in the product" comment and the unused `kit-glyph.png`. | `kit-website/index.html:138-151`; `styles/base.css:278-299`; `favicon.svg:1-11`; `assets/img/kit-glyph.png` | mark section; F5.3 | M |
| S4 | Website hero graph to the firefly recipe (warm first, `lighter`, procedural sprite; today blue-dominant, four-stop, source-over). | `kit-website/index.html:1429-1475` | mark section (firefly recipe) | M |
| S5 | Website copy: five `text-transform: uppercase` sites to sentence case; blog eyebrows. | `base.css:636, 778, 1058`; `blog.css:288, 365` | F7.1 | S |
| S6 | Email (invite, reset, signature): ground `#060b16` to `#020617`; card `#0f1729` to `#0f172a` at radius 20; tile from the new asset at 22% corner (40 px tile, 9 px corner; 46 px, 10 px); CTA `#eeb066`/`#db8a3c` to the amber scale; eyebrow tracking .14em to the eyebrow style; serif stack `Fraunces, Georgia, serif` with Georgia as the declared fallback; signature link colour on light ground decided by the colour section (today `#fa7103`). | `api/services/email.py:149-152, 171, 177, 184-185, 202-205, 261-264, 294-295`; `api/services/outbound/mailbox.py:29, 44-52` | F2, F4, F7; tile, colour, type sections | M |
| S7 | Docs HTML: Kit tokens and Manrope/Fraunces instead of `#0f1217`, `#f5b942`, Inter; collapse the duplicate directories to one. | `docs/federation.html:14-22`, `docs/flows-and-triggers.html`, `docs/memory-pipeline.html`; `api/ui/docs/*.html` | F4; colour, type sections | M |
| S8 | Personas: either mark as internal and out of the brand (white paper, system sans, heavy wordmark) or restyle the footer wordmark to Fraunces 500 and the accents to Kit's; decide, do not leave ambiguous. | `docs/personas/persona.css:5-22, 181` | F7.4; type section | S |
| S9 | Mockups: mark `mockups/*.html` as non-reference (they carry the `#ff9a23` tile in-product, blue/emerald palettes and Inter); archive or stamp a banner. | `mockups/kit-app-menu.html:20-22, 90, 150-216`; `lantern-*.html`; `kit-widget-library.html:113-126` | process row of Part B | S |
| S10 | Film (kit-film): theme to the floor and hierarchy; delete the unused blue pentagon `KitGlyph`; app icon PNG from the new tile asset without CSS rounding over the squircle; disc fireflies (`box-shadow` glow) to the sprite recipe; update `VIDEO_SYSTEM.md`. | `kit-film/src/theme.ts:7-23`; `src/scenes/index.tsx:213-235, 487, 768`; `src/scenes/primitives.tsx:48-88`; `public/kit-logo.svg`, `public/kit-app-icon.png`; `VIDEO_SYSTEM.md:27-44` | F4; mark, tile, colour sections | M |
| S11 | Pitch (kit-deck): out of family by design (a separate brand); minimum: replace the default Next.js favicon with the Kit tile, align `KitMark` to the wordmark rule, and retire the older sprite fork in favour of the reference recipe if the universe view stays. Flag so nobody treats it as reference. | `kit-deck/src/app/favicon.ico`; `src/components/Hub/DeckMark.tsx:12-42`; `src/components/Hub/UniverseFireflies.tsx:37-100`; `src/app/globals.css:7-18, 78-85` | tile, mark sections | S |
| S12 | Postcards and Telegram replies already follow the copy rules (plain text, sentence case, dash normaliser); keep the normaliser and add the same guard to email and web strings at build time. | `api/services/connections/service.py:1425-1465`; `postcard_scheduler.py:186` | F7.2 | S |

---

### Summary of numbers this section fixes

Spacing 4 px base with ten named steps (4, 8, 12, 16, 20, 24, 32, 40, 48, 64) and four half steps inside controls; hit targets 28/32/36/44. Radius 6/10/14/20 plus pill, with `kit-card` 16 to 14, auth and composer 22 to 20, onboarding and load-html cards 8 to 20, widget card 10 to 14; exported tile corner 22%. Two shadow recipes: the `kit-card` halo (`index.html:325-334`) and one ambient drop at 10/30 (float) or 28/90 (sheet), alpha .45. One floor `#020617`, one static aurora (`index.html:1236-1316`), nine or more skies retired, no animated or blurred full-screen layers, the auth scene blur at `:1433-1441` gone. Motion 120/200/320/600 ms, curve `cubic-bezier(0.2, 0.8, 0.2, 1)` and `ease-in-out` for loops, one breath 4.6 s, pips at 2.3 s, reduced motion everywhere. Icons stroke 2 on 24 units at 16/20/24, no emoji. Copy sentence case, no dashes, British English, "Kit".
