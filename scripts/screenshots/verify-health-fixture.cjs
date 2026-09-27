// Focal tests of the local-only QA adapter; no app services or credentials.
process.env.EXPO_PUBLIC_SCREENSHOT_MODE = '1';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
Module._extensions['.ts'] = (mod, file) => {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  mod._compile(code, file);
};
const { screenshotRpc, supabase } = require('./supabase.ts');
const { screenshotTables, screenshotDate } = require('./fixtures.ts');
(async () => {
  const initial = await screenshotRpc('my_health_consent');
  assert.equal(initial.data.accepted, false);
  assert.equal(initial.data.version, null);
  assert.equal((await screenshotRpc('accept_health_consent', {p_version:'obsolete'})).data.ok, false);
  assert.equal((await screenshotRpc('my_health_consent')).data.accepted, false);
  const general = await screenshotRpc('my_completions', {p_from:screenshotDate(),p_until:screenshotDate()});
  assert.equal(general.data.length, 3);
  assert(general.data.every(row=>row.evidence_url===null));
  assert.equal((await supabase.from('quests').select('*')).data.length, 4);
  assert.equal((await supabase.from('coach_messages').select('*')).data.length, 0);
  const before = JSON.stringify(screenshotTables);
  assert((await supabase.from('profiles').update({name:'Disallowed'})).error);
  assert((await supabase.functions.invoke('health-erasure')).error);
  assert.equal(JSON.stringify(screenshotTables), before);
  assert.equal((await screenshotRpc('accept_health_consent',{p_version:'2026-09-27-salud-v1'})).data.ok, true);
  const accepted = await screenshotRpc('my_health_consent');
  assert.equal(accepted.data.accepted,true);
  assert.equal(accepted.data.revision,1);
  assert.equal((await supabase.from('coach_messages').select('*')).data.length,2);
  assert.equal((await supabase.from('quests').select('*')).data.length,6);
  assert((await supabase.functions.invoke('health-erasure')).error);
  assert.equal((await screenshotRpc('my_health_consent')).data.accepted,true);
  assert((await screenshotRpc('unknown')).error);
  assert.equal(JSON.stringify(screenshotTables),before);
  console.log('20 local health-fixture checks passed; no external requests.');
})().catch(error=>{console.error(error);process.exitCode=1;});
