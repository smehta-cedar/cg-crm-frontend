import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiRequest, type TokenPair } from "@/lib/api";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/lib/auth-cookies";
import { jwtExpiresWithin } from "@/lib/jwt";

/*
 * Keeps the session alive. Runs before every page and server action: when
 * the access cookie is missing or about to expire and a refresh cookie is
 * present, it calls POST /auth/refresh/ and stores the new pair, both on the
 * response (for the browser) and on the forwarded request (so this render's
 * cookies() already sees the new access token).
 *
 * The backend rotates refresh tokens and blacklists the old one, so a refresh
 * token is good for exactly one refresh. A browser fires several requests at
 * once (a navigation plus its prefetches), each carrying the same old
 * refresh token; only the first may hit the API. `rotations` dedupes them:
 * every request with the same old token awaits the same promise, and the
 * result is kept a few seconds for a straggler that left before the browser
 * stored the new cookies. Only that long: anyone holding the old token gets
 * the new pair while it lasts. Keyed by a hash, so the map never holds a
 * token that could be refreshed, and capped, oldest out first.
 *
 * Refresh failures: a definite rejection (401) clears both cookies so the
 * dashboard gate sends the visitor to sign in; so does a refresh token that
 * has already expired, without asking the API. A network failure leaves them
 * alone and lets the page decide. The API rate-limits refreshes per visitor,
 * so the visitor's IP goes along.
 *
 * Nothing here decides who may see what; the dashboard layout does that with
 * getSessionUser(). This only makes sure the token it reads is fresh.
 */

/** Refresh when the access token has less than this left, so a render never straddles its expiry. */
const REFRESH_AHEAD_MS = 60 * 1000;
/** How long a finished rotation stays answerable for late requests carrying the old token. */
const ROTATION_TTL_MS = 5 * 1000;
/** Most rotations kept at once. */
const MAX_ROTATIONS = 1000;

type Rotation = { ok: true; tokens: TokenPair } | { ok: false; definite: boolean };

const rotations = new Map<string, Promise<Rotation>>();

function rotate(refresh: string, visitorIp: string | null): Promise<Rotation> {
  const key = createHash("sha256").update(refresh).digest("hex");
  const pending = rotations.get(key);
  if (pending) return pending;

  const promise = apiRequest<TokenPair>("/auth/refresh/", { method: "POST", body: { refresh }, visitorIp }).then(
    (result): Rotation => {
      if (result.ok) return { ok: true, tokens: result.data };
      // 401 = the API refused the token (expired, blacklisted, user gone). Anything else is not its verdict.
      return { ok: false, definite: result.status === 401 };
    },
  );
  // A Map keeps insertion order, so the first key is the oldest.
  if (rotations.size >= MAX_ROTATIONS) rotations.delete(rotations.keys().next().value!);
  rotations.set(key, promise);
  setTimeout(() => rotations.delete(key), ROTATION_TTL_MS);
  return promise;
}

/** Public marketing pages other than home; the admin subdomain does not serve them. */
const MARKETING_PATHS = new Set(["/careers", "/team"]);

/** The admin subdomain is the CRM only; the main domain keeps the landing page at /. */
function isAdminHost(request: NextRequest): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host.startsWith("admin.");
}

export async function proxy(request: NextRequest) {
  const admin = isAdminHost(request);
  const { pathname } = request.nextUrl;

  if (admin && MARKETING_PATHS.has(pathname)) return NextResponse.redirect(new URL("/", request.url));

  // admin.<domain>/ renders /login while the address bar keeps showing /.
  const pass = (init?: Parameters<typeof NextResponse.next>[0]) =>
    admin && pathname === "/" ? NextResponse.rewrite(new URL("/login", request.url), init) : NextResponse.next(init);

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  const fresh = access !== undefined && !jwtExpiresWithin(access, REFRESH_AHEAD_MS);
  if (fresh || !refresh) return pass();

  // Read the way visitorIp() in app/login/actions.ts reads it.
  const visitorIp = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || null;
  const rotation: Rotation = jwtExpiresWithin(refresh, 0)
    ? { ok: false, definite: true }
    : await rotate(refresh, visitorIp);

  if (rotation.ok) {
    // The forwarded request carries the new cookies, so cookies() downstream reads them.
    request.cookies.set(ACCESS_COOKIE, rotation.tokens.access);
    request.cookies.set(REFRESH_COOKIE, rotation.tokens.refresh);
    const response = pass({ request });
    setAuthCookies(response.cookies, rotation.tokens);
    return response;
  }

  if (rotation.definite) {
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    const response = pass({ request });
    clearAuthCookies(response.cookies);
    return response;
  }

  return pass();
}

export const config = {
  // Pages and server actions only: static assets and files with an extension never need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
