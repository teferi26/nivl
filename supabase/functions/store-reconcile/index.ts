import { adminClient } from '../_shared/db.ts';
import { revenueCatServerKey, sandboxPolicy } from '../_shared/store-config.ts';
import { storeReconcileHandler } from '../_shared/store-reconcile.ts';

// RevenueCat API v1 SECRET key (sk_…) pinned in the server environment; NEVER
// read a key from the HTTP request and never fall back to a client SDK key
// (EXPO_PUBLIC_RC_IOS_KEY is per-app and is not the project configuration).
const env = (name: string) => Deno.env.get(name);
const key = revenueCatServerKey(env);
if (!key) console.error('store-reconcile: REVENUECAT_API_KEY missing or not a RevenueCat secret key (sk_…)');
Deno.serve(storeReconcileHandler(adminClient(), key, fetch, { allowSandbox: sandboxPolicy(env) }));
