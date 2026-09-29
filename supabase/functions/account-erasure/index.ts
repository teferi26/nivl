import { adminClient } from '../_shared/db.ts';
import { accountErasureHandler } from '../_shared/account-erasure.ts';

// Uses only this deployment's Supabase project. No Franky client or credential.
Deno.serve(accountErasureHandler(adminClient()));
