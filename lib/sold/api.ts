/*
 * Fetch wrapper for the SOLD form APIs. Frontend-only for now: mock mode is
 * on by default (no Django sold endpoints yet). Set NEXT_PUBLIC_SOLD_MOCK_API=0
 * later when real /api/upload and /api/submit exist.
 */

type LoginResult = { email: string | null; rep: string | null };

/** Mock stays on unless explicitly turned off — no sold backend in this CRM yet. */
const MOCK = process.env.NEXT_PUBLIC_SOLD_MOCK_API !== "0";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function api<T = Record<string, unknown>>(path: string, options: RequestInit = {}): Promise<T> {
  if (MOCK) return mockApi<T>(path, options);

  const response = await fetch(path, { ...options, credentials: "same-origin" });
  let body: { error?: string } = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (response.status === 401) {
    throw new Error("You’re signed out: open this site in a new tab and sign in there.");
  }
  if (response.status === 413) {
    throw new Error("Each PDF must be under 4 MB.");
  }
  if (!response.ok) {
    throw new Error(body.error || `The server answered ${response.status}.`);
  }
  return body as T;
}

async function mockApi<T>(path: string, options: RequestInit): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  if (path.startsWith("/api/login") && method === "GET") {
    return { email: "dev@cedargroveseniorhealth.com", rep: null } as T;
  }

  if (path.startsWith("/api/upload") && method === "POST") {
    await sleep(500);
    const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
    const product = new URLSearchParams(query).get("product") ?? "file";
    return { id: `mock-${product}` } as T;
  }

  if (path.startsWith("/api/submit") && method === "POST") {
    await sleep(1200);
    try {
      const raw = options.body;
      console.log("[sold mock submit]", typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch {
      console.log("[sold mock submit]", options.body);
    }
    return { submissionId: "MOCK" } as T;
  }

  throw new Error(`The server answered 404.`);
}

export type { LoginResult };
