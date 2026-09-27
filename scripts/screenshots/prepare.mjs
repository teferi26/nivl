import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') throw new Error('Explicit screenshot mode is required');
if (process.env.EXPO_TOKEN || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_KEY) {
  throw new Error('Do not expose real service configuration or credentials to the screenshot job');
}
const sourceCommit = '7a5e6e13d08076cbc06298d47ccbe329facd26b5';
const unchanged = execFileSync('git', ['diff', '--name-only', sourceCommit, '--', 'src', 'assets', 'package-lock.json'], { encoding: 'utf8' }).trim();
if (unchanged) throw new Error('The release UI/assets/dependencies must remain unchanged: ' + unchanged);

const packageFile = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
pkg.main = 'scripts/screenshots/entry.js';
fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n');
const appFile = path.resolve('app.json');
const app = JSON.parse(fs.readFileSync(appFile, 'utf8'));
app.expo.scheme = 'nivl-capture';
app.expo.ios.bundleIdentifier = 'com.teferi.nivl.screenshots';
app.expo.ios.associatedDomains = [];
app.expo.ios.entitlements = {};
app.expo.updates = { enabled: false };
app.expo.extra = { router: {} };
delete app.expo.owner;
delete app.expo.runtimeVersion;
fs.writeFileSync(appFile, JSON.stringify(app, null, 2) + '\n');
fs.mkdirSync('screenshots', { recursive: true });
fs.writeFileSync('screenshots/provenance.json', JSON.stringify({
  sourceCommit,
  harnessCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  captureType: 'Native iOS Simulator, Release configuration',
  data: 'Deterministic local fictional fixtures; no real account and no remote services',
  fixtureDate: '2026-09-28 09:41 local time, advancing normally',
  ui: 'Unchanged source components, assets and dependencies from sourceCommit',
  productionPublication: false,
  purchases: 'Display-only configured catalogue; purchase and restoration disabled',
}, null, 2) + '\n');
console.log('Prepared isolated simulator capture configuration; original src/assets unchanged.');
