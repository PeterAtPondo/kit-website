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
};
const SURFACE_ORDER = ["claude-code", "codex", "cursor", "vscode", "gemini", "qwen", "anythingllm"];
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

  const amber = "#e8a55c";
  const body = "#cbd5e1";
  const bright = "#f1f5f9";

  const menuRow = (label, rest) =>
    `<p style="margin:0 0 9px;font-size:14px;color:${body};line-height:1.5">` +
    `<span style="color:${bright};font-weight:600">${label}</span> ${rest}</p>`;

  const menuItems =
    menuRow("View Memories", "see what I've learned and what I'm still forming.") +
    menuRow("Settings", "connect more tools, pick your model, manage your Kit.") +
    menuRow("Full Web UI", "the complete app in your browser.");
  const tryItems =
    menuRow("Ask", "&ldquo;what do you know about me so far?&rdquo;") +
    menuRow("Tell me", "something to remember, then ask about it tomorrow.") +
    menuRow("Just work", "I'm listening in the background, getting to know you.");

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
               style="width:480px;max-width:480px;background:#0f1729;border:1px solid rgba(232,165,92,0.24);border-radius:18px;overflow:hidden">
          <tr>
            <td style="padding:26px 30px 22px;border-bottom:1px solid rgba(148,163,184,0.12)">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1;font-weight:600;color:#f8fafc">Kit</div>
              <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;color:${amber};margin-top:5px">private memory, local to your mac</div>
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
              <div style="font-size:11px;letter-spacing:0.1em;color:${amber};margin-bottom:10px">where i show up</div>
              <p style="margin:0 0 4px;font-size:14px;color:${body};line-height:1.55">${surfaceLine}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px 2px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.1em;color:${amber};margin-bottom:10px">from the menu bar &middot; the kit icon, top right</div>
              ${menuItems}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px 2px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <div style="font-size:11px;letter-spacing:0.1em;color:${amber};margin-bottom:10px">${tryHeadingHtml}</div>
              ${tryItems}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 30px 6px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0 0 11px;font-size:14px;color:${body};line-height:1.55">Learn more at <a href="https://kit-project.com" style="color:${amber};text-decoration:none">kit-project.com</a>, latest notes on the <a href="https://kit-project.com/blog/" style="color:${amber};text-decoration:none">Kit blog</a>.</p>
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
