// NIVL · RevenueCat webhook → verified Customer Info → atomic reconciliation.
// Deploy after 0033; keep --no-verify-jwt because this is authenticated by the
// existing REVENUECAT_WEBHOOK_AUTH header, not a Supabase user session.
// REVENUECAT_API_KEY may reuse this project's public iOS v1 SDK key.
import { adminClient } from '../_shared/db.ts';
import { storeWebhookHandler } from '../_shared/store-webhook.ts';

const auth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const key = Deno.env.get('REVENUECAT_API_KEY') ?? Deno.env.get('EXPO_PUBLIC_RC_IOS_KEY') ?? '';
Deno.serve(storeWebhookHandler(adminClient(), auth, key));
