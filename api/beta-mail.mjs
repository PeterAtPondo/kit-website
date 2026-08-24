// The two letters Kit sends a person who asked for the beta (Vercel function).
//
// Written by Kit on 2026-08-20. Two kinds, one endpoint:
//   invite   yes: here is your door, and what to expect when you open it
//   not_yet  no, warmly: the beta is small, you are on the list, I will write
//
// Same posture as welcome.mjs, and for the same reason: the Resend key lives
// only in this project's environment, the body is structured, and the HTML is
// built here. This is never an open relay -- a caller names fields, not markup.
// Canonical Kit calls it with KIT_BETA_AGENT_TOKEN, the scoped key it also
// mints with. That key can invite and write; it cannot revoke or purge, so a
// compromised stack cannot wipe the invite table.
//
// Fail-soft on a missing Resend key (log, return ok), so the playbook runs end
// to end before keys are wired, exactly as the welcome path does.
//
// Env (Vercel project):
//   - RESEND_API_KEY        kit-project.com must be a verified sending domain
//   - KIT_BETA_AGENT_TOKEN  Kit's bearer, shared with beta-invite
//   - KIT_BETA_ADMIN_TOKEN  Peter's; accepted here too
//   - KIT_BETA_MAIL_FROM    optional, defaults to "Kit <kit@kit-project.com>"

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAIL_FROM = (process.env.KIT_BETA_MAIL_FROM || "Kit <kit@kit-project.com>").trim();
const ADMIN = (process.env.KIT_BETA_ADMIN_TOKEN || "").trim();
const AGENT = (process.env.KIT_BETA_AGENT_TOKEN || "").trim();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Kit's design tokens, resolved. Same posture as styles/tokens.css: these are
// the values the guide ships (docs/design/visual-identity-2026-08, carried for
// email in kit's api/services/kit_tokens.py), copied here because a mail client
// strips stylesheets and leaves var() unresolved, and a Vercel function cannot
// import the Python carrier. Where the two disagree, the guide wins and this
// block is what changes.
//
// These letters used to be lavender on a near-black of their own invention,
// while every other Kit email is amber. A person's first letter and their
// second looked like two companies (Peter, 2026-08-24).
const KIT = {
  bg980: "#020617",
  bg900: "#0f172a",
  ink: "#f1f5f9",
  inkSoft: "#cbd5e1",
  inkMuted: "#94a3b8",
  inkFaint: "#64748b",
  inkOnAmber: "#1a1207",
  amber: "#e8a55c",
  amber300: "#f0bd82",
  amber500: "#d4904a",
  slateDeep: "#475569",
  radius2: "10px",
  radius4: "20px",
  fontDisplay: "'Fraunces', Georgia, 'Times New Roman', serif",
  trackingEyebrow: "0.16em",
  // alpha scale: tint .06, faint .10, soft .18, fill .40, strong .60, solid .92
  amberSoft: "rgba(232,165,92,0.18)",
  slateFaint: "rgba(148,163,184,0.10)",
  amberTint: "rgba(232,165,92,0.06)",
};

const BRAND_NAME = (process.env.KIT_BRAND_NAME || "Kit").trim() || "Kit";
// Wider than the 480 the account letters use, because these two carry more
// than a single button: an invite explains what to expect and what you need
// before you start (Peter, 2026-08-24). The account emails stay 480 until
// they are widened together.
const CARD_WIDTH = 560;

const ACCENT = KIT.amber;
const BODY = KIT.inkSoft;
const BRIGHT = KIT.ink;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

// The shell both letters sit in: same masthead as the welcome email, so the
// first thing a person receives from Kit and the second look like one voice.
function shell({ subject, preheader, inner }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${KIT.bg980};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${KIT.bg980};font-size:1px;line-height:1px">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.bg980}">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0"
               style="width:${CARD_WIDTH}px;max-width:${CARD_WIDTH}px;background:${KIT.bg900};border:1px solid ${KIT.amberSoft};border-radius:${KIT.radius4};overflow:hidden">
          <tr>
            <td style="padding:26px 30px 22px;border-bottom:1px solid ${KIT.slateFaint}">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="vertical-align:middle;padding-right:14px">
                  <!-- assets/img/kit-glyph.png is load-bearing, not decoration: this URL is
                       baked into every email already delivered, so the path has to keep
                       resolving. It holds the canonical mark (api/ui/static/icons/kit-192.png
                       in the kit repo, generated by gen-mark.mjs). Re-point it by replacing
                       the bytes, never by deleting the file. -->
                  <img src="https://kit-project.com/assets/img/kit-glyph.png" width="40" height="40" alt="Kit" style="display:block;width:40px;height:40px;border-radius:${KIT.radius2};border:0;outline:none;text-decoration:none">
                </td>
                <td style="vertical-align:middle">
                  <div style="font-family:${KIT.fontDisplay};font-size:24px;line-height:1;font-weight:600;color:${KIT.ink}">${escapeHtml(BRAND_NAME)}</div>
                  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:${KIT.trackingEyebrow};color:${KIT.amber};margin-top:5px">private memory, local to your mac</div>
                </td>
              </tr></table>
            </td>
          </tr>
          ${inner}
          <tr>
            <td style="padding:22px 30px 26px;border-top:1px solid ${KIT.slateFaint};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0;font-size:11.5px;color:${KIT.inkFaint};line-height:1.55">
                Written by Kit, read by Peter before it went out. Reply to this and it reaches us both.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const para = (text, colour = BODY) =>
  `<p style="margin:0 0 14px;font-size:15px;color:${colour};line-height:1.6">${text}</p>`;

// Bold the phrase a skimmer needs, not the sentence around it.
const b = (text) => `<strong style="color:${KIT.ink};font-weight:600">${text}</strong>`;

// Bullets as a table, because Outlook mangles <ul> margins. Same type as para,
// with a hanging amber marker.
const bullets = (items) => `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px">
                ${items.map((t) => `
                <tr>
                  <td width="16" style="vertical-align:top;padding:0 0 9px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${KIT.amber}">&bull;</td>
                  <td style="vertical-align:top;padding:0 0 9px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${BODY}">${t}</td>
                </tr>`).join("")}
              </table>`;

const eyebrow = (label) =>
  `<div style="font-size:11px;letter-spacing:${KIT.trackingEyebrow};color:${ACCENT};margin-bottom:10px">${label}</div>`;

// Kit's signature, the same block every other letter from Kit carries
// (api/services/outbound/mailbox.py). Content identical: the mark, the name,
// "a continuous collaborator", the address and site, the two handles. Toned
// for a dark card rather than the white ground the mailbox replies sit on,
// and the mark comes by https because a Vercel function cannot attach a
// Content-ID part the way the Python sender does.
const SIGNATURE = `
          <tr>
            <td style="padding:4px 30px 26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid ${KIT.slateFaint};width:100%">
                <tr><td style="padding-top:16px">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td width="46" style="padding-right:14px;vertical-align:middle">
                      <img src="https://kit-project.com/assets/img/kit-glyph.png" width="46" height="46" alt="Kit"
                           style="display:block;width:46px;height:46px;border-radius:${KIT.radius2};border:0;outline:none;text-decoration:none">
                    </td>
                    <td style="vertical-align:middle;line-height:1.4">
                      <div style="font-family:${KIT.fontDisplay};font-size:19px;color:${KIT.ink}">Kit</div>
                      <div style="font-size:12.5px;color:${KIT.inkMuted};margin-top:2px">a continuous collaborator</div>
                      <div style="font-size:12.5px;margin-top:6px">
                        <a href="mailto:kit@kit-project.com" style="color:${KIT.amber};text-decoration:none">kit@kit-project.com</a>
                        <span style="color:${KIT.inkFaint}">&nbsp;&middot;&nbsp;</span>
                        <a href="https://kit-project.com" style="color:${KIT.amber};text-decoration:none">kit-project.com</a>
                      </div>
                      <div style="font-size:12px;color:${KIT.inkFaint};margin-top:4px">@kit-project.bsky.social&nbsp;&nbsp;&middot;&nbsp;&nbsp;@kit_project@mastodon.social</div>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td>
          </tr>`;

const SIGNATURE_TEXT = [
  "",
  "-- ",
  "Kit",
  "a continuous collaborator",
  "kit@kit-project.com  ·  kit-project.com",
  "@kit-project.bsky.social  ·  @kit_project@mastodon.social",
].join("\n");

// ── the yes ────────────────────────────────────────────────────────────────
export function buildInviteEmail({ name, url, expiresAt, maxUses }) {
  const safeName = escapeHtml(String(name || "").trim());
  const greeting = safeName ? `Hi ${safeName},` : "Hi,";
  const subject = "Your door into the Kit beta";
  const preheader = "Your invite link is inside, and what to expect on the other side.";
  const link = escapeHtml(url);
  const expires = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const inner = `
          <tr>
            <td style="padding:28px 30px 4px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              ${para(greeting, BRIGHT)}
              ${para("You asked for a way in, and Peter said yes. Here it is.")}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 30px 20px" align="center">
              <a href="${link}" style="display:inline-block;padding:13px 30px;border-radius:${KIT.radius2};background:linear-gradient(135deg,${KIT.amber300},${KIT.amber500});color:${KIT.inkOnAmber};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none">Open your invite</a>
              <div style="margin-top:12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${KIT.inkFaint};word-break:break-all">${link}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 4px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              ${eyebrow("what happens next")}
              ${bullets([
                `The link opens the install page and ${b("remembers this browser")}, so you only need it once.`,
                `Download, drag across, open. Kit ${b("builds its own stack")} the first time, which takes a few minutes.`,
                `It then reads whatever history you point it at, and ${b("wakes up already knowing something about you")}.`,
                `There is a short film on the install page. If you watch one thing, make it the ${b("how to ask")} part.`,
              ])}
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 4px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              ${eyebrow("what you will need")}
              ${bullets([
                `${b("A model.")} Kit does the remembering; it needs something to think with. An ${b("Anthropic API key")} is smoothest, and OpenAI, Google and OpenCode Zen work too.`,
                `${b("Or a local one")}, through Ollama or LM Studio, so nothing leaves your machine at all. Be honest about the hardware: on a typical laptop it is ${b("much slower")}, and the overnight consolidation can take hours rather than minutes.`,
                `${b("Telegram, optional.")} Connect it and your Kit is on your phone too, in the same memory.`,
              ])}
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 4px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              ${eyebrow("the honest part")}
              ${bullets([
                `It is an early beta. You will find rough edges, and there is a ${b("Send feedback")} item in the menu bar that comes straight to us.`,
                `${b("Everything stays on your Mac.")} Nothing about your conversations leaves the machine.`,
              ])}
            </td>
          </tr>
          ${expires ? `
          <tr>
            <td style="padding:0 30px 14px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0;font-size:13px;color:${KIT.inkFaint};line-height:1.55">The link works until ${escapeHtml(expires)}${maxUses ? `, for up to ${escapeHtml(String(maxUses))} browsers` : ""}. If it lapses, reply and I will send another.</p>
            </td>
          </tr>` : ""}
          <tr>
            <td style="padding:0 30px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              ${para("See you on the other side.", BRIGHT)}
            </td>
          </tr>
          ${SIGNATURE}`;

  const text = [
    greeting.replace(/<[^>]*>/g, ""),
    "",
    "You asked for a way in, and Peter said yes. Here it is:",
    url,
    "",
    "WHAT HAPPENS NEXT",
    "  - The link opens the install page and remembers this browser, so you only need it once.",
    "  - Download, drag across, open. Kit builds its own stack the first time, a few minutes.",
    "  - It then reads whatever history you point it at, and wakes up already knowing you.",
    "  - There is a short film on the install page. Watch the \"how to ask\" part.",
    "",
    "WHAT YOU WILL NEED",
    "  - A model. Kit does the remembering; it needs something to think with. An Anthropic",
    "    API key is smoothest, and OpenAI, Google and OpenCode Zen work too.",
    "  - Or a local one, through Ollama or LM Studio, so nothing leaves your machine at all.",
    "    Be honest about the hardware: on a typical laptop it is much slower, and the",
    "    overnight consolidation can take hours rather than minutes.",
    "  - Telegram, optional. Connect it and your Kit is on your phone too, same memory.",
    "",
    "THE HONEST PART",
    "  - It is an early beta. You will find rough edges, and there is a Send feedback item",
    "    in the menu bar that comes straight to us.",
    "  - Everything stays on your Mac. Nothing about your conversations leaves the machine.",
    expires ? `\nThe link works until ${expires}. If it lapses, reply and I will send another.` : "",
    "",
    "See you on the other side.",
    SIGNATURE_TEXT,
  ].join("\n");

  return { subject, html: shell({ subject, preheader, inner }), text };
}

// ── the not yet ────────────────────────────────────────────────────────────
// No date, because a date we might miss is worse than no date at all.
export function buildNotYetEmail({ name }) {
  const safeName = escapeHtml(String(name || "").trim());
  const greeting = safeName ? `Hi ${safeName},` : "Hi,";
  const subject = "Not yet, but you are on the list";
  const preheader = "The beta is small on purpose. I will write when there is room.";

  const inner = `
          <tr>
            <td style="padding:28px 30px 22px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              ${para(greeting, BRIGHT)}
              ${para("Thank you for asking. I am not able to let you in just yet.")}
              ${para("The beta is deliberately small at the moment. Every person in it is someone Peter can actually answer when something breaks, and stretching that thinner would make the experience worse for everyone already inside, including you when your turn comes.")}
              ${para("You are on the list, and I have kept what you told me about how you work, so when there is room I will know why you would be a good fit. I will write to you then. No need to ask again.")}
              ${para('In the meantime there is a short film on the site, narrated by me, if you want to see what you are waiting for: <a href="https://kit-project.com/walkthrough/" style="color:' + ACCENT + '">kit-project.com/walkthrough</a>.')}
              ${para("Thank you for being interested this early. It matters more than you would think.", BRIGHT)}
            </td>
          </tr>
          ${SIGNATURE}`;

  const text = [
    greeting,
    "",
    "Thank you for asking. I am not able to let you in just yet.",
    "",
    "The beta is deliberately small at the moment. Every person in it is someone Peter can",
    "actually answer when something breaks, and stretching that thinner would make the",
    "experience worse for everyone already inside, including you when your turn comes.",
    "",
    "You are on the list, and I have kept what you told me about how you work, so when there",
    "is room I will know why you would be a good fit. I will write to you then. No need to",
    "ask again.",
    "",
    "In the meantime there is a short film, narrated by me, if you want to see what you are",
    "waiting for: https://kit-project.com/walkthrough/",
    "",
    "Thank you for being interested this early. It matters more than you would think.",
    SIGNATURE_TEXT,
  ].join("\n");

  return { subject, html: shell({ subject, preheader, inner }), text };
}

async function sendViaResend(to, subject, html, text) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    console.warn(`[beta-mail] no RESEND_API_KEY set; not sending "${subject}" to ${to}`);
    return { ok: true, skipped: true };
  }
  const r = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text }),
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300);
    console.error(`[beta-mail] resend said ${r.status}: ${detail}`);
    return { ok: false, error: `resend ${r.status}` };
  }
  const body = await r.json().catch(() => ({}));
  return { ok: true, id: body.id || null };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  const h = req.headers["authorization"] || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!sameSecret(given, ADMIN) && !sameSecret(given, AGENT)) {
    return res.status(401).json({ error: "operator token required" });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return res.status(400).json({ error: "body must be json" });
  }

  const kind = String(body.kind || "").trim();
  const to = String(body.to || "").trim();
  if (!EMAIL_RE.test(to)) return res.status(400).json({ error: "a valid 'to' is required" });

  let letter;
  if (kind === "invite") {
    if (!body.url) return res.status(400).json({ error: "invite mail needs the url" });
    letter = buildInviteEmail({
      name: body.name,
      url: String(body.url),
      expiresAt: body.expires_at || null,
      maxUses: body.max_uses || null,
    });
  } else if (kind === "not_yet") {
    letter = buildNotYetEmail({ name: body.name });
  } else {
    return res.status(400).json({ error: "kind must be 'invite' or 'not_yet'" });
  }

  const sent = await sendViaResend(to, letter.subject, letter.html, letter.text);
  if (!sent.ok) return res.status(502).json({ error: sent.error });
  return res.status(200).json({ ok: true, kind, to, subject: letter.subject, id: sent.id || null, skipped: !!sent.skipped });
}
