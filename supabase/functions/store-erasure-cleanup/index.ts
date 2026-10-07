import { adminClient } from '../_shared/db.ts';
import { revenueCatServerKey } from '../_shared/store-config.ts';
import { storeErasureCleanupHandler } from '../_shared/store-erasure-cleanup.ts';

// Internal scheduler endpoint. The scheduler sends x-ritual-secret, not an Auth JWT.
// This repo has no supabase/config.toml override: the deployment gate MUST disable
// gateway JWT verification, otherwise pg_net receives 401 before this handler.
// Review-only deployment recipe (do not run until deployment is approved):
// supabase functions deploy store-erasure-cleanup --no-verify-jwt
// Set RITUAL_SECRET first, matching Vault nivl_ritual_secret. Handler auth remains mandatory.
const env = (name: string) => Deno.env.get(name);
Deno.serve(storeErasureCleanupHandler(adminClient(), revenueCatServerKey(env), env('RITUAL_SECRET') ?? ''));
