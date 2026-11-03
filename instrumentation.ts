/*
 * Runs once when the Next server starts (never during `next build`).
 *
 * In production it refuses to start without VISITOR_IP_SECRET: lib/api.ts
 * would send no visitor IP, so the API would count every sign-in under this
 * server's address, one rate limit shared by everyone.
 */
export function register() {
  if (process.env.NODE_ENV === "production" && !process.env.VISITOR_IP_SECRET) {
    throw new Error("VISITOR_IP_SECRET is not set.");
  }
}
