// Runs the real migration script in a child with Management API fetch replaced.
// No remote SQL is executed and all credentials are deliberately fake.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
const temporary = await mkdtemp(join(tmpdir(),'nivl-migration-preview-'));
try {
  const loader = join(temporary,'fake-fetch.mjs');
  const calls = join(temporary,'calls.json');
  await writeFile(loader, `
    import { writeFileSync } from 'node:fs';
    const queries=[];
    globalThis.fetch=async (_url, options)=>{
      const query=JSON.parse(options.body).query;
      queries.push(query);
      if (!query.trimStart().startsWith('select')) throw new Error('Mutating SQL was attempted in preview');
      const row=Object.fromEntries([...query.matchAll(/as m(\\d{4})/g)].map((m)=>[m[1] ? 'm'+m[1] : '', !['0063','0064','0065'].includes(m[1])]));
      if(process.env.TEST_CURRENT==='true') for(const key in row) row[key]=true;
      writeFileSync(process.env.TEST_CALLS,JSON.stringify(queries));
      return new Response(JSON.stringify([row]),{headers:{'content-type':'application/json'}});
    };
  `);
  async function run(current) {
    const child=spawn(process.execPath,['--import',pathToFileURL(loader).href,fileURLToPath(new URL('./apply-migrations.mjs',import.meta.url)),'--dry'],{
      env:{...process.env, SUPABASE_ACCESS_TOKEN:'fake-never-valid-token',EXPO_PUBLIC_SUPABASE_URL:'https://fakepreview.supabase.co',TEST_CALLS:calls,TEST_CURRENT:String(current)},
      windowsHide:true,
    });
    let stdout='',stderr='';
    child.stdout.on('data',(chunk)=>{stdout+=chunk;}); child.stderr.on('data',(chunk)=>{stderr+=chunk;});
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
    assert.equal(code,0,stderr);
    assert.equal(stderr,'');
    assert.equal(JSON.parse(await readFile(calls,'utf8')).length,1,'preview must perform exactly one read-only fingerprint query');
    if(current) assert.match(stdout,/Nada que hacer: el esquema está al día\.\s*$/);
    else assert.match(stdout,/\(--dry\) Se aplicarían 3: 0063_store_events_late_identity_redaction.sql, 0064_store_erasure_cleanup_queue.sql, 0065_letter_seal_idempotent.sql\s*$/);
  }
  await run(false); await run(true);
  console.log('PASS migration preview: real child drains final summary, one read-only query, no SQL apply, pending and current exits cleanly');
} finally { await rm(temporary,{recursive:true,force:true}); }
