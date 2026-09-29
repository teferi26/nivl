import { adminClient } from '../_shared/db.ts';
import { storeReconcileHandler } from '../_shared/store-reconcile.ts';

// RevenueCat v1 accepts the existing public iOS SDK key for GET Customer Info.
// Pin it in the server environment; NEVER read a key from the HTTP request.
const key = Deno.env.get('REVENUECAT_API_KEY') ?? Deno.env.get('EXPO_PUBLIC_RC_IOS_KEY') ?? '';
Deno.serve(storeReconcileHandler(adminClient(), key));
