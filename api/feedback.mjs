// Feedback relay for the personal Kit app (Vercel serverless function).
//
// The macOS app posts a short structured feedback message here from the
// "Send us feedback" menu item, and this function emails it to the Kit team.
// It reuses the exact Resend + token pattern as welcome.mjs so there are no
// new secrets to wire: same low-privilege app token, same verified sender.
//
// Security posture mirrors welcome.mjs:
//   - The request carries an app token (header x-kit-app-token) checked against
//     KIT_WELCOME_TOKEN. If it leaks the blast radius is bounded: an attacker
//     can only send Kit-branded feedback emails to the team inbox.
//   - The body is structured and escaped here; this is never an open HTML relay.
//   - Fail-soft: a missing Resend key logs and returns ok rather than erroring.
//
// Env (set in the kit-website Vercel project):
//   - RESEND_API_KEY     the Resend key (shared with welcome.mjs)
//   - KIT_WELCOME_TOKEN  shared app token the app sends (shared with welcome.mjs)
//   - KIT_WELCOME_FROM   optional sender, defaults to "Kit <kit@kit-project.com>"
//   - KIT_FEEDBACK_TO    optional recipient, defaults to "kit@kit-project.com"

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FEEDBACK_FROM = (process.env.KIT_WELCOME_FROM || "Kit <kit@kit-project.com>").trim();
const FEEDBACK_TO = (process.env.KIT_FEEDBACK_TO || "kit@kit-project.com").trim();
const FEEDBACK_TOKEN = (process.env.KIT_WELCOME_TOKEN || "").trim();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Build the feedback email. Returns { subject, html, text }. All content is
// built here from structured fields; the caller never supplies HTML.
function buildFeedbackEmail(message, contact, version, hasShot) {
  const safeMsg = escapeHtml(message);
  const safeContact = escapeHtml(contact || "(none given)");
  const safeVersion = escapeHtml(version || "?");
  const subject = contact ? `Kit feedback from ${contact}` : "Kit feedback";

  const text =
    `New feedback from the Kit app\n\n` +
    `${message}\n\n` +
    `---\n` +
    `contact: ${contact || "(none given)"}\n` +
    `app version: ${version || "?"}\n` +
    (hasShot ? `screenshot: attached\n` : "");

  const amber = "#e8a55c";
  const body = "#cbd5e1";
  const bright = "#f1f5f9";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#060b16;-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060b16">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="width:480px;max-width:480px;background:#0f1729;border:1px solid rgba(232,165,92,0.24);border-radius:18px;overflow:hidden">
          <tr>
            <td style="padding:24px 30px 18px;border-bottom:1px solid rgba(148,163,184,0.12);font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.14em;color:${amber}">feedback from the kit app</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 30px 8px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;line-height:1.6">
              <p style="margin:0;font-size:15px;color:${bright};white-space:pre-wrap">${safeMsg}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px 26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;border-top:1px solid rgba(148,163,184,0.1)">
              <p style="margin:14px 0 0;font-size:13px;color:#94a3b8">contact: <span style="color:${body}">${safeContact}</span><br>app version: <span style="color:${body}">${safeVersion}</span>${hasShot ? `<br>screenshot: <span style="color:${body}">attached</span>` : ""}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

// Constant-time-ish token compare, matching welcome.mjs.
function tokenOk(provided) {
  if (!FEEDBACK_TOKEN) return true; // open until configured (logged by caller)
  if (!provided || provided.length !== FEEDBACK_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ FEEDBACK_TOKEN.charCodeAt(i);
  }
  return diff === 0;
}

// A screenshot arrives as a data URL (the app compresses client-side).
// Decode + validate here; cap the decoded size well under Vercel's 4.5MB
// request limit so a giant paste degrades to "message only", never a 500.
const SHOT_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/;
const SHOT_MAX_B64 = 4_200_000; // ~3MB decoded

function parseScreenshot(raw) {
  if (typeof raw !== "string" || !raw || raw.length > SHOT_MAX_B64) return null;
  const m = SHOT_RE.exec(raw);
  if (!m) return null;
  return { filename: m[1] === "png" ? "screenshot.png" : "screenshot.jpg", content: m[2] };
}

async function sendViaResend({ to, replyTo, subject, html, text, attachment }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    // Fail-soft, mirroring welcome.mjs: no key means we log and report ok.
    console.warn(`[feedback] no RESEND_API_KEY set; not sending to ${to}`);
    return { ok: true, provider: "log" };
  }
  try {
    const payload = { from: FEEDBACK_FROM, to: [to], subject, html, text };
    if (replyTo) payload.reply_to = replyTo; // so the team can reply straight to the user
    if (attachment) payload.attachments = [attachment];
    const resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 300);
      console.warn(`[feedback] resend ${resp.status}: ${detail}`);
      return { ok: false, provider: "resend", error: `${resp.status}: ${detail}` };
    }
    const data = await resp.json().catch(() => ({}));
    return { ok: true, provider: "resend", id: data.id };
  } catch (e) {
    console.warn(`[feedback] resend send failed: ${e}`);
    return { ok: false, provider: "resend", error: String(e) };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const token = req.headers["x-kit-app-token"];
  if (!FEEDBACK_TOKEN) {
    console.warn("[feedback] KIT_WELCOME_TOKEN is not set; endpoint is open");
  }
  if (!tokenOk(typeof token === "string" ? token : "")) {
    return res.status(401).json({ ok: false, error: "Invalid app token." });
  }

  let bodyObj = req.body;
  if (typeof bodyObj === "string") {
    try {
      bodyObj = JSON.parse(bodyObj || "{}");
    } catch {
      bodyObj = {};
    }
  }
  bodyObj = bodyObj && typeof bodyObj === "object" ? bodyObj : {};

  const message = String(bodyObj.message || "").trim();
  if (!message || message.length > 5000) {
    return res.status(422).json({ ok: false, error: "A feedback message (1 to 5000 characters) is required." });
  }
  const contact = String(bodyObj.contact || "").trim().slice(0, 200);
  const version = String(bodyObj.app_version || "").trim().slice(0, 40);
  const replyTo = contact && EMAIL_RE.test(contact) ? contact : undefined;
  const attachment = parseScreenshot(bodyObj.screenshot);

  const { subject, html, text } = buildFeedbackEmail(message, contact, version, !!attachment);
  const result = await sendViaResend({ to: FEEDBACK_TO, replyTo, subject, html, text, attachment });
  console.log(`[feedback] provider=${result.provider} ok=${result.ok} shot=${attachment ? 1 : 0} ver=${version || "?"}`);
  if (!result.ok) {
    return res.status(502).json({ ok: false, error: "Feedback could not be sent." });
  }
  return res.status(200).json({ ok: true, sent: result.provider === "resend", id: result.id });
}
