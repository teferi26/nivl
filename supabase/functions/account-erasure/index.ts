import { adminClient } from '../_shared/db.ts';
import { accountErasureHandler } from '../_shared/account-erasure.ts';

// Uses only this deployment's Supabase project and RevenueCat (secret key).
// No Franky client or credential.
Deno.serve(accountErasureHandler(adminClient(), { revenueCatKey: Deno.env.get('REVENUECAT_API_KEY') }));
