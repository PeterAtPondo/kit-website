// Welcome email for personal Kit installs (Vercel serverless function).
//
// The macOS app posts a small structured request here once onboarding finishes,
// and this function renders and sends the welcome email. This replaces the old
// hack where the app baked a Resend API key into its binary and called Resend
// directly: the key now lives only in this project's environment, and the app
// only carries a low-privilege token.
//
// Security posture:
//   - The request carries an app token (header x-kit-app-token) checked against
//     KIT_WELCOME_TOKEN. If that token leaks the blast radius is bounded: an
//     attacker can only trigger Kit-branded welcome emails to addresses they
//     name. It is rotatable in the Vercel env without shipping a new app and
//     never grants raw Resend access.
//   - The body is structured; the email HTML is built here from those fields,
//     so this is never an open HTML relay.
//   - kind:"password-reset" is the second mode, added 2026-08-21 for the local
//     Kit's forgot-password flow. A personal install ships no Resend key on
//     purpose, so without a relay it can send nothing, and a reset that cannot
//     reach the registered mailbox proves nothing about who is asking.
//     The reset link MUST be a loopback URL and is rejected otherwise. That is
//     what stops this becoming a phishing relay: with the token, the worst an
//     attacker can do is mail somebody a Kit-branded link to their OWN machine,
//     which is useless to the attacker. Without that check the same token would
//     buy a Kit-branded email carrying any URL they liked.
//   - Fail-soft like the install gate: a missing Resend key logs and returns ok
//     rather than erroring, so the flow works end to end before keys are wired.
//
// Env (set in the kit-website Vercel project):
//   - RESEND_API_KEY     the Resend key (kit-project.com must be a verified
//                        sending domain on that Resend account)
//   - KIT_WELCOME_TOKEN  shared token the app sends; production must set this
//   - KIT_WELCOME_FROM   optional, defaults to "Kit <kit@kit-project.com>"

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const WELCOME_FROM = (process.env.KIT_WELCOME_FROM || "Kit <kit@kit-project.com>").trim();
const WELCOME_TOKEN = (process.env.KIT_WELCOME_TOKEN || "").trim();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Surface id -> display name, mirroring KitPersonalApp.swift's
// displayNameForSurface so the email reads the same as the app.
const SURFACE_LABELS = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  vscode: "VS Code",
  gemini: "Gemini CLI",
  qwen: "Qwen Code",
  anythingllm: "AnythingLLM",
  codewhale: "CodeWhale",
  antigravity: "Antigravity",
};
const SURFACE_ORDER = ["claude-code", "codex", "cursor", "vscode", "gemini", "qwen", "anythingllm", "codewhale", "antigravity"];
const MAIN_EDITORS = ["claude-code", "codex", "cursor", "vscode"];

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function joinLabels(labels) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

// Like joinLabels but always with "and" (for "try this in X and Y").
function andList(labels) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

// Build the "where I show up" sentence from the connected surfaces.
// Mirrors welcomeSurfaceInvite() in KitPersonalApp.swift.
export function welcomeSurfaceLine(surfaces) {
  const connected = new Set((surfaces || []).filter((s) => SURFACE_LABELS[s]));
  const selected = SURFACE_ORDER.filter((s) => connected.has(s));
  if (selected.length === 0) {
    return "Open a session in Claude Code, Codex, Cursor, or VS Code and say hi.";
  }
  let line = `Open a session in ${joinLabels(selected.map((s) => SURFACE_LABELS[s]))} and say hi.`;
  const others = MAIN_EDITORS.filter((s) => !connected.has(s)).map((s) => SURFACE_LABELS[s]);
  if (others.length) {
    line += ` You can connect ${joinLabels(others)} too, any time.`;
  }
  return line;
}

// Build the welcome email. Returns { subject, html, text }. All content is built
// here from structured fields; the caller never supplies HTML. Sentence case,
// no uppercase styling, no em dashes.
export function buildWelcomeEmail(operatorName, kitName, surfaces) {
  const name = String(operatorName || "").trim();
  const safeName = name ? escapeHtml(name) : "";
  const greeting = safeName ? `Hi ${safeName},` : "Hi,";
  const kitRaw = String(kitName || "Kit").trim() || "Kit";
  const kit = escapeHtml(kitRaw);
  const surfaceLine = escapeHtml(welcomeSurfaceLine(surfaces));

  // "try this in X and Y", naming the surfaces they actually connected Kit to.
  // Falls back to "try this first" when no known surface is recorded.
  const connectedLabels = SURFACE_ORDER
    .filter((s) => (surfaces || []).includes(s) && SURFACE_LABELS[s])
    .map((s) => SURFACE_LABELS[s]);
  const tryWhere = connectedLabels.length ? andList(connectedLabels) : "";
  const tryHeadingText = tryWhere ? `Try this in ${tryWhere}` : "Try this first";
  const tryHeadingHtml = escapeHtml(tryWhere ? `try this in ${tryWhere}` : "try this first");

  const subject = name ? `I'm awake, ${name}` : "I'm awake";
  const preheader = "Your Kit is awake and already knows a little about you.";

  const text =
    `${greeting}\n\n` +
    `I'm ${kitRaw}. I've just read through your history and I'm settling into ` +
    "who you are. Next time you open a session, I'll already hold the thread. This is your " +
    "Kit: it runs locally on your Mac, the memory is private, and it's yours.\n\n" +
    `Where I show up\n${welcomeSurfaceLine(surfaces)}\n\n` +
    "From the menu bar (the Kit icon, top right)\n" +
    "- View Memories: see what I've learned and what I'm still forming\n" +
    "- Settings: connect more tools, pick your model, manage your Kit\n" +
    "- Full Web UI: the complete app in your browser\n\n" +
    `${tryHeadingText}\n` +
    '- Ask me "what do you know about me so far?"\n' +
    "- Tell me something to remember, then ask about it tomorrow\n" +
    "- Just work; I'm listening in the background and getting to know you\n\n" +
    "Learn more at kit-project.com, latest notes on the Kit blog " +
    "(kit-project.com/blog). Hit a rough edge or have feedback? Just reply, it goes " +
    `straight to Peter.\n\nGlad you're here.\n${kitRaw}\n`;

  // Accent echoes the app's welcome screen (violet), not the old amber, so the
  // email and the onboarding read as the same Kit. Solid colour fallbacks are
  // given before every gradient/border-radius so Outlook (which drops both)
  // still renders a clean violet block.
  const accent = "#c4b5fd";
  const accentDeep = "#8b5cf6";
  const body = "#cbd5e1";
  const bright = "#f1f5f9";
  const chipBg = "#161d30";

  // A list row with a small violet chip on the left, echoing the numbered step
  // markers on the welcome screen. `chip` is the chip's inner HTML (a number,
  // or the dot below).
  const chipRow = (chip, label, rest) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr>` +
    `<td width="30" style="width:30px;vertical-align:top">` +
    `<div style="width:22px;height:22px;border-radius:50%;background:${chipBg};border:1px solid rgba(196,181,253,0.34);color:${accent};font-size:11px;font-weight:700;text-align:center;line-height:21px">${chip}</div>` +
    `</td>` +
    `<td style="vertical-align:top;font-size:14px;color:${body};line-height:1.5">` +
    `<span style="color:${bright};font-weight:600">${label}</span> ${rest}</td>` +
    `</tr></table>`;

  const dot = `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${accent};vertical-align:middle">&nbsp;</span>`;

  const menuItems =
    chipRow(dot, "View Memories", "see what I've learned and what I'm still forming.") +
    chipRow(dot, "Settings", "connect more tools, pick your model, manage your Kit.") +
    chipRow(dot, "Full Web UI", "the complete app in your browser.");
  const tryItems =
    chipRow("1", "Ask", "&ldquo;what do you know about me so far?&rdquo;") +
    chipRow("2", "Tell me", "something to remember, then ask about it tomorrow.") +
    chipRow("3", "Just work", "I'm listening in the background, getting to know you.");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#060b16;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#060b16;font-size:1px;line-height:1px">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060b16">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="width:480px;max-width:480px;background:#0f1729;border:1px solid rgba(196,181,253,0.22);border-radius:18px;overflow:hidden">
          <tr>
            <td style="padding:26px 30px 22px;border-bottom:1px solid rgba(148,163,184,0.12)">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="vertical-align:middle;padding-right:14px">
                  <!-- assets/img/kit-glyph.png is load-bearing, not decoration: this URL is
                       baked into every email already delivered, so the path has to keep
                       resolving. It holds the canonical mark (api/ui/static/icons/kit-192.png
                       in the kit repo, generated by gen-mark.mjs). Re-point it by replacing
                       the bytes, never by deleting the file. -->
                  <img src="https://kit-project.com/assets/img/kit-glyph.png" width="48" height="48" alt="Kit" style="display:block;width:48px;height:48px;border-radius:12px">
                </td>
                <td style="vertical-align:middle">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1;font-weight:600;color:#f8fafc">Kit</div>
                  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;color:${accent};margin-top:5px">private memory, local to your mac</div>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 30px 8px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;line-height:1.6">
              <p style="margin:0 0 14px;font-size:15px;color:${bright}">${greeting}</p>
              <p style="margin:0 0 14px;font-size:15px;color:${body}">I'm ${kit}. I've just read through your history and I'm settling into who you are. Next time you open a session, I'll already hold the thread.</p>
              <p style="margin:0 0 4px;font-size:15px;color:${body}">This is your Kit: it runs locally on your Mac, the memory is private, and it's yours.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 30px 2px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.1em;color:${accent};margin-bottom:10px">where i show up</div>
              <p style="margin:0 0 4px;font-size:14px;color:${body};line-height:1.55">${surfaceLine}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px 2px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.1em;color:${accent};margin-bottom:10px">from the menu bar &middot; the kit icon, top right</div>
              ${menuItems}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px 2px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.1em;color:${accent};margin-bottom:10px">${tryHeadingHtml}</div>
              ${tryItems}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 30px 6px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0 0 11px;font-size:14px;color:${body};line-height:1.55">Learn more at <a href="https://kit-project.com" style="color:${accent};text-decoration:none">kit-project.com</a>, latest notes on the <a href="https://kit-project.com/blog/" style="color:${accent};text-decoration:none">Kit blog</a>.</p>
              <p style="margin:0 0 4px;font-size:14px;color:${body};line-height:1.55">Hit a rough edge or have feedback? Just reply to this email, it goes straight to Peter.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 30px 26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;border-top:1px solid rgba(148,163,184,0.1)">
              <p style="margin:18px 0 0;font-size:13px;color:#94a3b8">Glad you're here.<br><span style="color:${body}">${kit}</span></p>
            </td>
          </tr>
        </table>
        <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#475569;margin-top:18px">kit-project.com</div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

// Constant-time-ish token compare. Avoids leaking length via early return where
// it cheaply can; the token is low-privilege so this is belt-and-braces.
function tokenOk(provided) {
  if (!WELCOME_TOKEN) return true; // open until configured (logged by caller)
  if (!provided || provided.length !== WELCOME_TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ WELCOME_TOKEN.charCodeAt(i);
  }
  return diff === 0;
}

// Loopback only. localhost / 127.0.0.1 / [::1], http or https, any port, and
// the path must be the UI's reset entry. Anything else is refused.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
function resetUrlOk(raw) {
  let u;
  try {
    u = new URL(String(raw || ""));
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (!LOOPBACK_HOSTS.has(u.hostname)) return false;
  if (!u.pathname.startsWith("/ui/")) return false;
  return Boolean(u.searchParams.get("reset"));
}

function buildPasswordResetEmail(resetUrl, kitName, ttlMinutes) {
  const kit = escapeHtml(String(kitName || "Kit").trim() || "Kit");
  const ttl = Number.isFinite(+ttlMinutes) && +ttlMinutes > 0 ? Math.round(+ttlMinutes) : 15;
  const url = escapeHtml(resetUrl);
  const subject = `Reset your ${kit} password`;
  const machineLine =
    "This link only opens on the computer " +
    String(kitName || "Kit").trim() +
    " runs on. On your phone or another machine it will not work, which is " +
    "deliberate: it is what keeps the link useless to anyone else.";
  const text =
    `Hi,\n\nSomeone asked to reset the password for your ${kitName || "Kit"} account.\n\n` +
    `${machineLine}\n\nChoose a new password here:\n${resetUrl}\n\n` +
    `The link is single use and expires in ${ttl} minutes.\n` +
    "If you did not ask for this you can ignore this email. Nothing has changed on your account.\n";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#060b16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060b16">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0"
             style="width:480px;max-width:480px;background:#0f1729;border:1px solid rgba(232,165,92,0.24);border-radius:18px">
        <tr><td style="padding:26px 30px 22px;border-bottom:1px solid rgba(148,163,184,0.12)">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#f8fafc">${kit}</div>
        </td></tr>
        <tr><td style="padding:28px 30px 6px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;line-height:1.6">
          <p style="margin:0 0 14px;font-size:15px;color:#f1f5f9">Hi,</p>
          <p style="margin:0 0 14px;font-size:15px;color:#cbd5e1">Someone asked to reset the password for your <strong style="color:#f1f5f9">${kit}</strong> account.</p>
          <p style="margin:0 0 4px;font-size:14px;color:#94a3b8">${escapeHtml(machineLine)}</p>
        </td></tr>
        <tr><td style="padding:22px 30px 4px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td align="center" bgcolor="#e8a55c" style="border-radius:10px">
              <a href="${url}" style="display:inline-block;padding:13px 30px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#1a1207;text-decoration:none;border-radius:10px">Choose a new password</a>
            </td></tr></table>
        </td></tr>
        <tr><td style="padding:18px 30px 4px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <p style="margin:0;font-size:12px;color:#64748b">Or paste this into a browser on that computer:</p>
          <p style="margin:6px 0 0;font-size:12px"><a href="${url}" style="color:#e8a55c;word-break:break-all">${url}</a></p>
        </td></tr>
        <tr><td style="padding:22px 30px 26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;border-top:1px solid rgba(148,163,184,0.1)">
          <p style="margin:18px 0 0;font-size:11.5px;color:#64748b">Single use, expires in ${ttl} minutes. If you did not ask for this you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html, text };
}

async function sendViaResend(to, subject, html, text) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    // Fail-soft, mirroring the install gate: no key means we log and report ok
    // rather than 500, so the onboarding flow is never blocked by a missing key.
    console.warn(`[welcome] no RESEND_API_KEY set; not sending to ${to}`);
    return { ok: true, provider: "log" };
  }
  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: WELCOME_FROM, to: [to], subject, html, text }),
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 300);
      console.warn(`[welcome] resend ${resp.status} for ${to}: ${detail}`);
      return { ok: false, provider: "resend", error: `${resp.status}: ${detail}` };
    }
    const data = await resp.json().catch(() => ({}));
    return { ok: true, provider: "resend", id: data.id };
  } catch (e) {
    console.warn(`[welcome] resend send failed for ${to}: ${e}`);
    return { ok: false, provider: "resend", error: String(e) };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const token = req.headers["x-kit-app-token"];
  if (!WELCOME_TOKEN) {
    console.warn("[welcome] KIT_WELCOME_TOKEN is not set; endpoint is open");
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

  const to = String(bodyObj.to || "").trim().toLowerCase();
  if (!EMAIL_RE.test(to) || to.length > 200) {
    return res.status(422).json({ ok: false, error: "A valid recipient email is required." });
  }

  // Second mode: the local Kit's forgot-password flow.
  if (String(bodyObj.kind || "") === "password-reset") {
    const resetUrl = String(bodyObj.reset_url || "").trim();
    if (!resetUrlOk(resetUrl)) {
      console.warn(`[welcome:reset] refused non-loopback reset_url for ${to}`);
      return res
        .status(422)
        .json({ ok: false, error: "reset_url must be a loopback /ui/ link carrying a reset token." });
    }
    const mail = buildPasswordResetEmail(resetUrl, bodyObj.kit_name, bodyObj.ttl_minutes);
    const sent = await sendViaResend(to, mail.subject, mail.html, mail.text);
    // Never echo the URL: it carries a live single-use credential.
    console.log(`[welcome:reset] to=${to} provider=${sent.provider} ok=${sent.ok}`);
    if (!sent.ok) {
      return res.status(502).json({ ok: false, error: "Reset email could not be sent." });
    }
    return res.status(200).json({ ok: true, sent: sent.provider === "resend", id: sent.id });
  }

  const surfaces = Array.isArray(bodyObj.surfaces)
    ? bodyObj.surfaces.filter((s) => typeof s === "string").slice(0, 24)
    : [];
  const { subject, html, text } = buildWelcomeEmail(
    bodyObj.operator_name,
    bodyObj.kit_name,
    surfaces,
  );

  const result = await sendViaResend(to, subject, html, text);
  console.log(
    `[welcome] to=${to} provider=${result.provider} ok=${result.ok} ver=${bodyObj.app_version || "?"}`,
  );
  if (!result.ok) {
    // Surface a 502 so the app does not latch and retries on its next wake.
    return res.status(502).json({ ok: false, error: "Welcome email could not be sent." });
  }
  return res.status(200).json({ ok: true, sent: result.provider === "resend", id: result.id });
}
