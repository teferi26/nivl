// Default is a local plan. Only the release operator may use --apply.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readToken } from './token.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply') || args.length > 1) {
  throw new Error('Usage: node scripts/deploy-backend-109.mjs [--apply]');
}
const cliPackage = JSON.parse(readFileSync(join(root, 'node_modules/supabase/package.json'), 'utf8'));
if (cliPackage.version !== '2.114.0') throw new Error('Required local Supabase CLI version: 2.114.0.');
const cli = join(root, 'node_modules/supabase/dist/supabase.js');
const functions = [
  { name: 'coach', jwt: true },
  { name: 'account-erasure', jwt: true },
  { name: 'store-reconcile', jwt: true },
  { name: 'revenuecat-webhook', jwt: false },
  { name: 'store-erasure-cleanup', jwt: false },
];
let localUrl = '';
try {
  const line = readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)
    .find((entry) => /^\s*EXPO_PUBLIC_SUPABASE_URL\s*=/.test(entry));
  localUrl = line?.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2') ?? '';
} catch { /* Caller may supply the URL through environment. */ }
const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? localUrl;
const ref = projectUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1];
if (!ref) throw new Error('Missing or invalid project URL.');
// No repository config exists today. Fail closed if one is later introduced:
// it could silently override JWT defaults for the three protected functions.
try {
  readFileSync(join(root, 'supabase/config.toml'));
  throw new Error('Review supabase/config.toml JWT settings before deploying with this script.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log(`Project: ${ref}; CLI: 2.114.0; mode: ${args.includes('--apply') ? 'APPLY' : 'PLAN'}`);
for (const entry of functions) console.log(`${entry.name}: verify_jwt=${entry.jwt}`);
if (!args.includes('--apply')) {
  console.log('No network calls or deployments. Scheduler and secrets are separate operator steps.');
} else {
  const token = readToken(root);
  if (!token) throw new Error('Missing management access token.');
  const metadata = async () => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, {
      headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Function metadata failed (${response.status}).`);
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('Invalid function metadata response.');
    return result;
  };
  const before = await metadata();
  for (const entry of functions) {
    const cliArgs = [cli, 'functions', 'deploy', entry.name, '--project-ref', ref, '--use-api'];
    if (!entry.jwt) cliArgs.push('--no-verify-jwt');
    const exitCode = await new Promise((resolve, reject) => {
      // Token passes only in the child environment. Raw CLI logs are withheld.
      const child = spawn(process.execPath, cliArgs, {
        cwd: root, shell: false, windowsHide: true, stdio: 'ignore',
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
      });
      child.on('error', () => reject(new Error(`Cannot start deployment for ${entry.name}.`)));
      child.on('close', resolve);
    });
    if (exitCode !== 0) throw new Error(`Deployment failed for ${entry.name} (exit ${exitCode}); stop and review. Earlier deployments may have succeeded.`);
    const after = await metadata();
    const current = after.find((item) => item.slug === entry.name || item.name === entry.name);
    const previous = before.find((item) => item.slug === entry.name || item.name === entry.name);
    if (!current || current.status !== 'ACTIVE' || current.verify_jwt !== entry.jwt
        || (previous && !(current.version > previous.version))) {
      throw new Error(`Deployment metadata verification failed for ${entry.name}; stop before scheduler activation.`);
    }
    console.log(`${entry.name}: ACTIVE, version=${current.version}, verify_jwt=${current.verify_jwt}`);
  }
  console.log('Functions deployed and metadata verified. Scheduler remains untouched.');
}
