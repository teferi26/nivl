import { adminClient, userClient } from '../_shared/db.ts';
import { healthErasureHandler } from '../_shared/health-erasure.ts';
Deno.serve(healthErasureHandler(adminClient(), userClient));
