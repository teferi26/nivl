import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'darwin' || process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') throw new Error('Only the isolated macOS simulator job may re-embed');
const nativeBase = '38f799670a0f53b6a153184e264017109eb4a792';
const changed = execFileSync('git', ['diff', '--name-only', nativeBase, 'HEAD', '--', 'app.json', 'package.json', 'package-lock.json', 'assets', 'metro.config.js', 'scripts/screenshots/prepare.mjs', 'scripts/screenshots/entry.js', 'scripts/screenshots/bootstrap.js'], {encoding:'utf8'}).trim();
if (changed) throw new Error('Pinned native cache configuration changed: '+changed);
const app = path.join(process.env.RUNNER_TEMP, 'nivl-derived/Build/Products/Release-iphonesimulator/NIVL.app');
const bundlePath = path.join(app,'main.jsbundle');
const old = fs.readFileSync(bundlePath);
const hermes = old.subarray(0,8).toString('hex') === 'c61fbc03c103191f';
const output = path.join(process.env.RUNNER_TEMP, 'nivl-embed-health');
fs.mkdirSync(output,{recursive:true});
const args=['expo','export:embed','--platform','ios','--dev','false','--minify','false','--entry-file','scripts/screenshots/entry.js','--bundle-output',path.join(output,'main.jsbundle'),'--assets-dest',output];
if (hermes) args.push('--bytecode');
execFileSync('npx',args,{stdio:'inherit'});
const updated=fs.readFileSync(path.join(output,'main.jsbundle'));
const nextHermes=updated.subarray(0,8).toString('hex')==='c61fbc03c103191f';
if (hermes!==nextHermes || (hermes && old.readUInt32LE(8)!==updated.readUInt32LE(8))) throw new Error('Embedded engine format/version changed');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let assetsVerified=0;
function verifyAssets(dir,relative='') {
  for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
    const rel=path.join(relative,item.name), from=path.join(output,rel);
    if(item.isDirectory()) verifyAssets(from,rel);
    else if(rel!=='main.jsbundle') {
      const existing=path.join(app,rel);
      if(!fs.existsSync(existing)||hash(fs.readFileSync(existing))!==hash(fs.readFileSync(from))) throw new Error('Native cached asset mismatch: '+rel);
      assetsVerified++;
    }
  }
}
verifyAssets(output);
if (!assetsVerified || hash(old)===hash(updated)) throw new Error('Expected verified assets and a changed local fixture bundle');
// Assets and all native files remain untouched. Only the official Expo output
// replaces this unsigned, isolated simulator app's bundle.
fs.copyFileSync(path.join(output,'main.jsbundle'),bundlePath);
const file='screenshots/provenance.json', p=JSON.parse(fs.readFileSync(file,'utf8'));
p.reembedded={nativeBase,method:'Expo export:embed from installed SDK54 CLI',engine:hermes?'Hermes bytecode':'JavaScript',assetsVerified,nativeFilesChanged:false,bundleSha256:hash(updated)};
fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
console.log('Re-embedded official Expo bundle; '+assetsVerified+' existing assets verified identical; native files unchanged.');
