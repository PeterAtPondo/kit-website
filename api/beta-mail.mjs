// The two letters Kit sends a person who asked for the beta (Vercel function).
//
// Written by Kit on 2026-08-20. Two kinds, one endpoint:
//   invite   yes: here is your door, and what to expect when you open it
//   not_yet  no, warmly: the beta is small, you are on the list, I will write
//
// Same posture as welcome.mjs, and for the same reason: the Resend key lives
// only in this project's environment, the body is structured, and the HTML is
// built here. This is never an open relay -- a caller names fields, not markup.
// Canonical Kit calls it with the operator token it already holds for minting,
// so the beta-request playbook needs no second secret.
//
// Fail-soft on a missing Resend key (log, return ok), so the playbook runs end
// to end before keys are wired, exactly as the welcome path does.
//
// Env (Vercel project):
//   - RESEND_API_KEY        kit-project.com must be a verified sending domain
//   - KIT_BETA_ADMIN_TOKEN  the caller's bearer, shared with beta-invite
//   - KIT_BETA_MAIL_FROM    optional, defaults to "Kit <kit@kit-project.com>"

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAIL_FROM = (process.env.KIT_BETA_MAIL_FROM || "Kit <kit@kit-project.com>").trim();
const ADMIN = (process.env.KIT_BETA_ADMIN_TOKEN || "").trim();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ACCENT = "#c4b5fd";
const BODY = "#cbd5e1";
const BRIGHT = "#f1f5f9";

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
<body style="margin:0;padding:0;background:#060b16;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#060b16;font-size:1px;line-height:1px">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060b16">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="width:480px;max-width:480px;background:#0f1729;border:1px solid rgba(196,181,253,0.22);border-radius:18px;overflow:hidden">
          <tr>
            <td style="padding:26px 30px 22px;border-bottom:1px solid rgba(148,163,184,0.12)">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="vertical-align:middle;padding-right:14px">
                  <img src="https://kit-project.com/assets/img/kit-glyph.png" width="48" height="48" alt="Kit" style="display:block;width:48px;height:48px;border-radius:12px">
                </td>
                <td style="vertical-align:middle">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1;font-weight:600;color:#f8fafc">Kit</div>
                  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;color:${ACCENT};margin-top:5px">private memory, local to your mac</div>
                </td>
              </tr></table>
            </td>
          </tr>
          ${inner}
          <tr>
            <td style="padding:18px 30px 26px;border-top:1px solid rgba(148,163,184,0.12);font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.55">
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
              <a href="${link}" style="display:inline-block;padding:14px 26px;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#a78bfa 54%,#c4b5fd);color:#070b15;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none">Open your invite</a>
              <div style="margin-top:12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#64748b;word-break:break-all">${link}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 8px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.1em;color:${ACCENT};margin-bottom:10px">what happens next</div>
              ${para("The link opens the install page and remembers this browser, so you only need it once. Download, drag across, open. Kit builds its own stack on your Mac the first time, which takes a few minutes, and then it reads whatever history you point it at and wakes up already knowing something about you.")}
              ${para('There is a short film on the install page, narrated by me. If you watch one thing before you start, make it the "how to ask" part.')}
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 8px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.1em;color:${ACCENT};margin-bottom:10px">the honest part</div>
              ${para("This is an early beta. You will find rough edges, and I would rather hear about them than not: there is a Send feedback item in the menu bar that comes straight to us, screenshots and all.")}
              ${para("Everything stays on your Mac. The memory is a database in your own Application Support folder, and nothing about your conversations leaves the machine.")}
            </td>
          </tr>
          ${expires ? `
          <tr>
            <td style="padding:0 30px 18px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.55">The link works until ${escapeHtml(expires)}${maxUses ? `, for up to ${escapeHtml(String(maxUses))} browsers` : ""}. If it lapses before you get to it, reply and I will send another.</p>
            </td>
          </tr>` : ""}
          <tr>
            <td style="padding:0 30px 22px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              ${para("See you on the other side.", BRIGHT)}
              ${para("Kit", BRIGHT)}
            </td>
          </tr>`;

  const text = [
    greeting.replace(/<[^>]*>/g, ""),
    "",
    "You asked for a way in, and Peter said yes. Here it is:",
    url,
    "",
    "The link opens the install page and remembers this browser, so you only need it once.",
    "Download, drag across, open. Kit builds its own stack the first time, which takes a few",
    "minutes, then reads whatever history you point it at and wakes up already knowing",
    "something about you.",
    "",
    "This is an early beta. You will find rough edges, and I would rather hear about them:",
    "there is a Send feedback item in the menu bar that comes straight to us.",
    "",
    "Everything stays on your Mac. Nothing about your conversations leaves the machine.",
    expires ? `\nThe link works until ${expires}. If it lapses, reply and I will send another.` : "",
    "",
    "See you on the other side.",
    "Kit",
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
              ${para("Kit", BRIGHT)}
            </td>
          </tr>`;

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
    "Kit",
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
  if (!ADMIN || !sameSecret(h.startsWith("Bearer ") ? h.slice(7) : "", ADMIN)) {
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
