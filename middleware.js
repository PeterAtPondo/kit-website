// Server-side beta gate for the macOS download.
//
// A client-side check is useless against developers (view-source, disable JS,
// or hit the dmg URL directly), so this runs on Vercel's Edge before anything
// is served. Since 2026-08-18 the gate is per person rather than a shared
// password: each invitee gets a personal link, /install/?invite=<token>, whose
// hash lives in the beta_invites table with an owner, an expiry, a small use
// budget and a revoked flag (api/beta-invite.mjs mints them). A valid link sets
// a signed, httpOnly cookie for this browser, so the person is not asked again
// and their later clicks do not spend the budget. A forwarded link stops
// working after its few uses instead of becoming a public door, and any single
// invite can be revoked without touching the others.
//
// The install explanation itself stays public, including /install/#what, so a
// person can audit the footprint before asking for access. The dmg remains
// private: anyone who requests it without a cookie or a valid link gets a plain
// 403 with the request-access URL. latest.json stays open so the installed
// app's update check keeps working, and Sparkle's dmg fetch passes on the app
// token, so an app that already installed does not need an invite to stay
// current.
//
// Fail-open by design, as before: if the gate is not configured (no
// KIT_BETA_ADMIN_TOKEN, Peter's own secret that also signs the cookie and
// authorises the mint endpoint) or anything throws, the request passes. The
// gate can never lock everyone out by accident, and a runtime hiccup can never
// take the live site down. The old shared KIT_INSTALL_PASSWORD is deliberately
// not consulted any more: it was typed by every early tester, so it cannot be
// the thing that signs cookies.

export const config = {
  matcher: ["/install", "/install/:path*", "/downloads/:path*"],
};

const COOKIE = "kit_invite"; // not kit_beta: that name is the roster's admin session
const COOKIE_DAYS = 90;
const enc = new TextEncoder();

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

// Cookie value: <invite id>.<expiry epoch seconds>.<hmac(id.exp)>. Stateless to
// verify, so the common case (an invited person browsing the page and pulling
// the dmg) never touches the database.
async function cookieValid(value, secret) {
  if (!value) return false;
  const [id, exp, sig] = value.split(".");
  if (!id || !exp || !sig) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  return (await hmacHex(secret, `${id}.${exp}`)) === sig;
}

async function mintCookie(id, secret) {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_DAYS * 86400;
  const sig = await hmacHex(secret, `${id}.${exp}`);
  return `${id}.${exp}.${sig}`;
}

// Look the token up, spend one use, and return the invite id, or null.
async function redeemInvite(token) {
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key || !token || token.length > 128) return null;
  const hash = await sha256Hex(token);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const r = await fetch(`${base}/rest/v1/beta_invites?token_hash=eq.${hash}&select=id,expires_at,max_uses,uses,revoked`, { headers });
  if (!r.ok) return null;
  const rows = await r.json();
  const inv = rows && rows[0];
  if (!inv || inv.revoked) return null;
  if (new Date(inv.expires_at).getTime() < Date.now()) return null;
  if (inv.uses >= inv.max_uses) return null;
  await fetch(`${base}/rest/v1/beta_invites?id=eq.${inv.id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ uses: inv.uses + 1, last_used_at: new Date().toISOString() }),
  });
  return String(inv.id);
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);

    // The installed app polls latest.json for update checks: keep it open.
    if (url.pathname.endsWith("/latest.json")) return;

    // The request-access page is the door itself; never gate it.
    if (url.pathname.startsWith("/install/request")) return;

    const installLanding = url.pathname === "/install" || url.pathname === "/install/";
    const accessProbe = url.pathname === "/install/access.json";

    // Sparkle's auto-update download: an installed app fetching the dmg sends
    // the app token header (the same one beta-ping authenticates with). The
    // person already had an invite to install; their app should not need one
    // again to stay current.
    // A checksum is for the reader who does not yet trust this page, so it is
    // never gated. The dmg it describes still is, and /update/latest.json
    // already serves the same hash publicly; a sidecar behind the invite just
    // made the install page link a 403.
    if (url.pathname.endsWith(".sha256")) {
      return;
    }

    const appToken = process.env.KIT_WELCOME_TOKEN;
    if (appToken && url.pathname.endsWith(".dmg") && request.headers.get("x-kit-app-token") === appToken) {
      return;
    }

    const secret = process.env.KIT_BETA_ADMIN_TOKEN;
    if (!secret) {
      // The gate is deliberately off until the operator secret is configured,
      // so the UI probe must report the same effective state.
      if (accessProbe) {
        return new Response('{"authorized":true}', {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      return;
    }

    const invited = await cookieValid(readCookie(request, COOKIE), secret);

    // The static install page asks this same-origin endpoint whether it should
    // promote its request button to the download. This response is UI state,
    // not authority; the dmg request is still checked independently below.
    if (accessProbe) {
      return new Response(JSON.stringify({ authorized: invited }), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // Already invited on this browser.
    if (invited) return;

    // Arriving on a personal invite link: redeem it, set the cookie, and land
    // on the clean install URL so the token never sits in the address bar.
    const token = url.searchParams.get("invite");
    if (token) {
      // A store hiccup while redeeming is a dead link, not an open door.
      const id = await redeemInvite(token).catch(() => null);
      if (id) {
        const value = await mintCookie(id, secret);
        const dest = new URL(url.pathname.startsWith("/downloads/") ? url.pathname : "/install/", url.origin);
        return new Response(null, {
          status: 302,
          headers: {
            Location: dest.toString(),
            "Set-Cookie": `${COOKIE}=${value}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
            "Cache-Control": "no-store",
          },
        });
      }
      // A dead link (expired, spent, revoked): fall through to the request page,
      // saying why, so the person can ask again instead of guessing.
      return Response.redirect(new URL("/install/request/?invite=invalid", url.origin), 302);
    }

    // The dmg with no invite: a plain refusal, not a redirect a downloader would follow.
    if (url.pathname.startsWith("/downloads/")) {
      return new Response("Kit is in private beta. Ask for an invite at https://kit-project.com/install/request/", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // The explanation is public; only the binary is gated.
    if (installLanding) return;

    return Response.redirect(new URL("/install/request/", url.origin), 302);
  } catch (e) {
    return; // fail open on any error, never break the live site
  }
}
