// Auth state for the popup. The token is opaque — minted by trakie.ai's
// /api/extension/exchange-code and presented to /api/extension/status (popup)
// and the relay (relay then re-verifies it server-side).

const TRAKIE_API_URL = process.env.TRAKIE_API_URL || "https://trakie.ai";
const TOKEN_KEY = "trakie.extension.token";
const EMAIL_KEY = "trakie.extension.email";
const ACCESS_CACHE_KEY = "trakie.extension.access";
const ACCESS_TTL_MS = 60_000;

export type AccessResult =
  | { subscribed: true; status: string | null }
  | { subscribed: false; reason: "no_subscription" | "invalid_token" | "verify_unavailable"; status?: string | null };

export function trakieApiUrl(): string {
  return TRAKIE_API_URL;
}

export function trakieConnectUrl(): string {
  return `${TRAKIE_API_URL}/extension/connect`;
}

export function trakieSubscriptionUrl(): string {
  return `${TRAKIE_API_URL}/account/subscription`;
}

export async function getToken(): Promise<string | null> {
  const out = await chrome.storage.local.get(TOKEN_KEY);
  const t = out[TOKEN_KEY];
  return typeof t === "string" && t.length > 0 ? t : null;
}

export async function setToken(token: string, email: string | null): Promise<void> {
  const payload: Record<string, unknown> = { [TOKEN_KEY]: token };
  if (email) payload[EMAIL_KEY] = email;
  await chrome.storage.local.set(payload);
  await invalidateAccessCache();
}

export async function getEmail(): Promise<string | null> {
  const out = await chrome.storage.local.get(EMAIL_KEY);
  const e = out[EMAIL_KEY];
  return typeof e === "string" && e.length > 0 ? e : null;
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, EMAIL_KEY]);
  await invalidateAccessCache();
}

async function invalidateAccessCache(): Promise<void> {
  try {
    await chrome.storage.session.remove(ACCESS_CACHE_KEY);
  } catch {
    // chrome.storage.session may not exist on older Chrome — ignore.
  }
}

type CachedAccess = { value: AccessResult; expires: number };

async function readAccessCache(): Promise<AccessResult | null> {
  try {
    const out = await chrome.storage.session.get(ACCESS_CACHE_KEY);
    const cached = out[ACCESS_CACHE_KEY] as CachedAccess | undefined;
    if (!cached || cached.expires < Date.now()) return null;
    return cached.value;
  } catch {
    return null;
  }
}

async function writeAccessCache(value: AccessResult): Promise<void> {
  try {
    const payload: CachedAccess = { value, expires: Date.now() + ACCESS_TTL_MS };
    await chrome.storage.session.set({ [ACCESS_CACHE_KEY]: payload });
  } catch {
    // session storage missing — skip cache.
  }
}

export async function checkAccess(options: { force?: boolean } = {}): Promise<AccessResult> {
  if (!options.force) {
    const cached = await readAccessCache();
    if (cached) return cached;
  }

  const token = await getToken();
  if (!token) {
    const v: AccessResult = { subscribed: false, reason: "invalid_token" };
    await writeAccessCache(v);
    return v;
  }

  try {
    const res = await fetch(`${TRAKIE_API_URL}/api/extension/status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Token bad — clear it so the next gate render shows the sign-in flow.
      await clearAuth();
      const v: AccessResult = { subscribed: false, reason: "invalid_token" };
      await writeAccessCache(v);
      return v;
    }

    const data = (await res.json().catch(() => null)) as
      | { subscribed: boolean; reason?: string; status?: string | null }
      | null;

    if (!data) {
      return { subscribed: false, reason: "verify_unavailable" };
    }

    if (data.subscribed) {
      const v: AccessResult = { subscribed: true, status: data.status ?? null };
      await writeAccessCache(v);
      return v;
    }

    const v: AccessResult = {
      subscribed: false,
      reason: "no_subscription",
      status: data.status ?? null,
    };
    await writeAccessCache(v);
    return v;
  } catch {
    // Don't cache transient failures.
    return { subscribed: false, reason: "verify_unavailable" };
  }
}

export type ExchangeResult =
  | { ok: true; token: string; email: string | null }
  | { ok: false; reason: string };

export async function exchangePairingCode(code: string): Promise<ExchangeResult> {
  try {
    const res = await fetch(`${TRAKIE_API_URL}/api/extension/exchange-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok: true; token: string; user_id: string; email: string | null }
      | { ok: false; reason: string }
      | null;

    if (!data) return { ok: false, reason: "server_error" };
    if (!data.ok) return { ok: false, reason: data.reason };
    return { ok: true, token: data.token, email: data.email ?? null };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
