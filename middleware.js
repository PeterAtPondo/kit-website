// Server-side beta gate for the install page and the macOS download.
//
// A client-side password check is useless against developers (view-source,
// disable JS, or hit the dmg URL directly), so this runs on Vercel's Edge before
// anything is served. It requires HTTP Basic Auth on /install and the .dmg, with
// the password held only in the KIT_INSTALL_PASSWORD environment variable, never
// in this source. latest.json stays open so the installed app's update check
// keeps working.
//
// Fail-open by design: if no password is configured, or anything throws, the
// request passes through. The gate can never lock people out by accident, and a
// runtime hiccup can never take the live site down. Set KIT_INSTALL_PASSWORD in
// the Vercel project to turn the gate on.

export const config = {
  matcher: ["/install", "/install/:path*", "/downloads/:path*"],
};

export default function middleware(request) {
  try {
    const url = new URL(request.url);

    // The installed app polls latest.json for update checks: keep it open.
    if (url.pathname.endsWith("/latest.json")) return;

    // Sparkle's auto-update download: an installed app fetching the dmg sends
    // the app token header (the same one beta-ping authenticates with). The
    // person already passed the beta gate to install; their app should not
    // need the password again to stay current.
    const appToken = process.env.KIT_WELCOME_TOKEN;
    if (
      appToken &&
      url.pathname.endsWith(".dmg") &&
      request.headers.get("x-kit-app-token") === appToken
    ) {
      return;
    }

    const expected = process.env.KIT_INSTALL_PASSWORD;
    if (!expected) return; // gate off until a password is configured

    const header = request.headers.get("authorization") || "";
    if (header.startsWith("Basic ")) {
      const decoded = atob(header.slice(6));
      const password = decoded.slice(decoded.indexOf(":") + 1);
      if (password === expected) return; // authenticated, allow through
    }

    return new Response("Kit is in private beta. Enter the access password to continue.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Kit private beta", charset="UTF-8"',
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (e) {
    return; // fail open on any error, never break the live site
  }
}
