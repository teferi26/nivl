// NIVL · Server configuration for the native-store reconciliation.
//
// RevenueCat key (audit 2026-10-02, docs/payment-audit/SERVIDOR.md):
// public SDK keys (appl_…, goog_…) are per-app keys meant for clients; secret
// keys (sk_…) are project-wide and are the ones RevenueCat tells you to keep
// on your servers. https://www.revenuecat.com/docs/projects/authentication
// The server therefore ONLY accepts REVENUECAT_API_KEY holding a v1 secret key.
// There is deliberately no fallback to EXPO_PUBLIC_RC_IOS_KEY: an iOS client key
// must never stand in for the project (and Android) configuration. Without a
// valid key both functions fail closed with a retryable 503.

export type EnvGetter = (name: string) => string | undefined;

/** Returns the pinned server key, or '' when it is missing or is a client SDK key. */
export function revenueCatServerKey(env: EnvGetter): string {
  const key = (env('REVENUECAT_API_KEY') ?? '').trim();
  return /^sk_[A-Za-z0-9]{8,}$/.test(key) ? key : '';
}

/** Who may obtain access from a SANDBOX (TestFlight, StoreKit sandbox, Play license tester) purchase. */
export type SandboxPolicy = (userId: string) => boolean;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * STORE_SANDBOX_ACCESS:
 *   unset / 'all'  → every account (behaviour deployed on 2026-09-29; App Review needs it)
 *   'none'         → sandbox purchases never grant access
 *   'uuid,uuid,…'  → only those NIVL accounts (review/demo/QA accounts)
 * Anything else fails closed to 'none'. Sales are never created from sandbox anyway (0027).
 */
export function sandboxPolicy(env: EnvGetter): SandboxPolicy {
  const raw = (env('STORE_SANDBOX_ACCESS') ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'all') return () => true;
  if (raw === 'none') return () => false;
  const ids = raw.split(',').map(value => value.trim()).filter(Boolean);
  if (!ids.length || ids.some(id => !UUID.test(id))) return () => false;
  const allowed = new Set(ids);
  return userId => allowed.has(userId.toLowerCase());
}
