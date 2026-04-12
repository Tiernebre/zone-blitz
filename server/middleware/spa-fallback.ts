import type { MiddlewareHandler } from "hono";

// The client is a client-side-routed SPA: routes like `/leagues` or
// `/draft/abc` must fall back to `index.html`. But the SPA fallback must
// NOT catch file-shaped paths — doing so turns every bot probe
// (`/.git/config`, `/wp-login.php`, `/.env`) into a 200 with the app shell,
// which encourages further scanning.
export function looksLikeSpaRoute(pathname: string): boolean {
  if (/(^|\/)\.[^/]/.test(pathname)) return false;
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".")) return false;
  return true;
}

// Runs after any real static-asset handler: if the path doesn't look like a
// SPA route, 404 it instead of letting it fall through to `index.html`.
export function spaRouteGuard(): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== "GET") {
      await next();
      return;
    }
    const { pathname } = new URL(c.req.url);
    if (pathname.startsWith("/api/")) {
      await next();
      return;
    }
    if (!looksLikeSpaRoute(pathname)) {
      return c.notFound();
    }
    await next();
  };
}
