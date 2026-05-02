// Verifies extension tokens by calling trakie.ai/api/extension/verify with a
// shared secret. Results are cached in-memory:
//   - subscribed (ok)  → 60s
//   - not subscribed   → 30s (so a fresh subscription unlocks within ~30s)
//   - invalid token    → 30s
//   - verify failure   → not cached (fail-closed each call)

const TRAKIE_API_URL = (process.env.TRAKIE_API_URL || "https://www.trakie.ai").trim().replace(/\/+$/, "");
const SHARED_SECRET = (process.env.RELAY_SHARED_SECRET || "").trim();

const OK_TTL_MS = 60_000;
const DENY_TTL_MS = 30_000;

export type VerifyOk = { ok: true; userId: string; status: string | null };
export type VerifyDeny = {
  ok: false;
  reason:
    | "missing_token"
    | "invalid_token"
    | "subscription_required"
    | "verify_unavailable"
    | "server_misconfigured";
};
export type VerifyResult = VerifyOk | VerifyDeny;

type CacheEntry = { value: VerifyResult; expires: number };

const cache = new Map<string, CacheEntry>();

function cacheGet(token: string): VerifyResult | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(token);
    return null;
  }
  return entry.value;
}

function cacheSet(token: string, value: VerifyResult, ttl: number): void {
  cache.set(token, { value, expires: Date.now() + ttl });
  // Best-effort cap.
  if (cache.size > 5000) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export async function verifyExtensionToken(
  token: string | undefined | null
): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: "missing_token" };
  if (!SHARED_SECRET) {
    console.error("[relay/auth] RELAY_SHARED_SECRET is not set — cannot verify");
    return { ok: false, reason: "server_misconfigured" };
  }

  const cached = cacheGet(token);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetch(`${TRAKIE_API_URL}/api/extension/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SHARED_SECRET}`,
      },
      body: JSON.stringify({ user_token: token }),
    });
  } catch (err) {
    console.error("[relay/auth] verify network error:", err);
    return { ok: false, reason: "verify_unavailable" };
  }

  if (res.status === 403) {
    console.error("[relay/auth] verify forbidden — RELAY_SHARED_SECRET mismatch");
    return { ok: false, reason: "server_misconfigured" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "verify_unavailable" };
  }

  const body = data as
    | { ok: true; user_id: string; status: string | null }
    | { ok: false; reason: string; user_id?: string | null; status?: string | null };

  if (body && body.ok === true && typeof body.user_id === "string") {
    const value: VerifyOk = {
      ok: true,
      userId: body.user_id,
      status: body.status ?? null,
    };
    cacheSet(token, value, OK_TTL_MS);
    return value;
  }

  if (body && body.ok === false) {
    if (body.reason === "no_subscription") {
      const value: VerifyDeny = { ok: false, reason: "subscription_required" };
      cacheSet(token, value, DENY_TTL_MS);
      return value;
    }
    if (body.reason === "invalid_token") {
      const value: VerifyDeny = { ok: false, reason: "invalid_token" };
      cacheSet(token, value, DENY_TTL_MS);
      return value;
    }
  }

  return { ok: false, reason: "verify_unavailable" };
}

export function clearVerifyCache(): void {
  cache.clear();
}
