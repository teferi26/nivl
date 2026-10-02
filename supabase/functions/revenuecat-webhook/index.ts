// NIVL · RevenueCat webhook → verified Customer Info → atomic reconciliation.
// Deploy after 0033; keep --no-verify-jwt because this is authenticated by the
// existing REVENUECAT_WEBHOOK_AUTH header, not a Supabase user session.
// REVENUECAT_API_KEY MUST be the project's RevenueCat API v1 SECRET key (sk_…).
// Since the 2026-10-02 audit there is no fallback to EXPO_PUBLIC_RC_IOS_KEY:
// without a secret key every delivery answers 503 (retryable) and is logged.
import { adminClient } from '../_shared/db.ts';
import { revenueCatServerKey, sandboxPolicy } from '../_shared/store-config.ts';
import { storeWebhookHandler } from '../_shared/store-webhook.ts';

const env = (name: string) => Deno.env.get(name);
const auth = env('REVENUECAT_WEBHOOK_AUTH') ?? '';
const key = revenueCatServerKey(env);
if (!key) console.error('revenuecat-webhook: REVENUECAT_API_KEY missing or not a RevenueCat secret key (sk_…)');
Deno.serve(storeWebhookHandler(adminClient(), auth, key, fetch, { allowSandbox: sandboxPolicy(env) }));
