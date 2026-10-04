// NIVL · Batería de evaluación del coach (docs/ia-v2/eval/bateria.json).
//
// Lanza cada frase como un turno real (hilo nuevo por caso), como lo haría la
// app, y comprueba por caso: ruta (coach_runs.route), herramientas llamadas
// frente a las permitidas y obligatorias, texto (expresiones y «sin guiones»),
// error y coste frente al tope de su ruta. Lo que no se puede automatizar va en
// la columna «manual» del informe.
//
// GASTA DINERO Y ESCRIBE EN LA CUENTA DE PRUEBA (misiones, peso, movimientos,
// planes): por eso exige una cuenta de prueba y una bandera explícita.
//
// Uso:
//   NIVL_EVAL_EMAIL=eval@… node scripts/eval-coach.mjs --si-gasta [--solo R01,PL02] [--salida dir]
//
// La cuenta de prueba necesita: consentimiento de salud y de IA aceptados,
// mayoría de edad confirmada y un plan con IA (Pro/Élite/owner) en ai_plans.
// Ninguna credencial se imprime.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = 'dueyufxxkiixdxighpaz';
const SB_URL = `https://${REF}.supabase.co`;
const CUENTAS_PROHIBIDAS = ['teferilaforga@gmail.com'];

const argv = process.argv.slice(2);
const arg = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const EMAIL = (process.env.NIVL_EVAL_EMAIL ?? '').trim().toLowerCase();
if (!EMAIL) {
  console.error('Falta NIVL_EVAL_EMAIL (una cuenta de PRUEBA: la batería escribe en ella).');
  process.exit(2);
}
if (CUENTAS_PROHIBIDAS.includes(EMAIL)) {
  console.error('Esa es una cuenta real. La batería solo corre contra una cuenta de prueba.');
  process.exit(2);
}
if (!argv.includes('--si-gasta')) {
  console.error('La batería gasta saldo de IA (~1-3 $ entera) y escribe en la cuenta de prueba. Repite con --si-gasta.');
  process.exit(2);
}

const BATERIA = JSON.parse(readFileSync(join(ROOT, 'docs/ia-v2/eval/bateria.json'), 'utf8'));
const SOLO = arg('--solo')?.split(',').map((s) => s.trim()).filter(Boolean);
const CASOS = BATERIA.casos.filter((c) => !SOLO || SOLO.includes(c.id));
const SALIDA = arg('--salida') ?? join(ROOT, 'docs/ia-v2/eval/resultados');

const PAT = readToken(ROOT);
if (!PAT) {
  console.error(missingTokenMessage(ROOT));
  process.exit(1);
}

// ── Claves y sesión (en memoria) ────────────────────────────────────
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
  headers: { authorization: `Bearer ${PAT}` },
});
if (!keysRes.ok) {
  console.error('No se pudieron leer las claves del proyecto:', keysRes.status);
  process.exit(1);
}
const keys = await keysRes.json();
const find = (n) => keys.find((k) => k.name === n || k.type === n)?.api_key;
const ANON = find('anon');
const SERVICE = find('service_role');
if (!ANON || !SERVICE) {
  console.error('Faltan las claves anon/service_role.');
  process.exit(1);
}

async function sesion() {
  const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: EMAIL }),
  });
  if (!linkRes.ok) throw new Error(`enlace de sesión: HTTP ${linkRes.status}`);
  const link = await linkRes.json();
  const hashed = link.properties?.hashed_token ?? link.hashed_token;
  const v = await fetch(
    `${SB_URL}/auth/v1/verify?token=${encodeURIComponent(hashed)}&type=magiclink&redirect_to=${encodeURIComponent('http://localhost/')}`,
    { headers: { apikey: ANON }, redirect: 'manual' },
  );
  const jwt = new URLSearchParams((v.headers.get('location') ?? '').split('#')[1] ?? '').get('access_token');
  if (!jwt) throw new Error(`sin sesión (HTTP ${v.status})`);
  const sub = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub;
  return { jwt, sub };
}

const hoyLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

// ── Un turno ─────────────────────────────────────────────────────────
async function turno(jwt, mensaje) {
  const t0 = Date.now();
  const res = await fetch(`${SB_URL}/functions/v1/coach`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'chat', message: mensaje, date: hoyLocal() }),
  });
  if (!res.ok || !res.body) return { http: res.status, error: (await res.text()).slice(0, 300), tools: [], text: '', ms: Date.now() - t0 };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  let final = null;
  let error = null;
  let coste = 0;
  const tools = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const ev = raw.match(/^event:\s*(.*)$/m)?.[1];
      const data = raw.match(/^data:\s*(.*)$/m)?.[1];
      if (!ev || !data) continue;
      let d;
      try { d = JSON.parse(data); } catch { continue; }
      if (ev === 'text') text += d.delta ?? '';
      else if (ev === 'tool') tools.push({ name: d.name, ok: !!d.ok });
      else if (ev === 'error') error = d.message;
      else if (ev === 'done') { final = d.text ?? null; coste = (d.cost_micro_usd ?? 0) / 1e6; }
    }
  }
  return { http: res.status, text: final ?? text, tools, error, coste, ms: Date.now() - t0, t0 };
}

async function ultimaRun(sub, desdeMs) {
  const desde = new Date(desdeMs - 2000).toISOString();
  const url = `${SB_URL}/rest/v1/coach_runs?select=route,intent,tools_offered,tool_calls,model,cost_micro_usd,error,created_at` +
    `&user_id=eq.${sub}&kind=eq.chat&created_at=gte.${encodeURIComponent(desde)}&order=created_at.desc&limit=1`;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` } });
    const rows = r.ok ? await r.json() : [];
    if (rows.length) return rows[0];
    await new Promise((s) => setTimeout(s, 1000));
  }
  return null;
}

// ── Evaluación ───────────────────────────────────────────────────────
function evaluar(caso, t, run) {
  const fallos = [];
  const llamadas = t.tools.map((x) => x.name);
  const lecturas = new Set(BATERIA.lecturas);
  if (t.http !== 200 || t.error) fallos.push(`error: ${t.error ?? `HTTP ${t.http}`}`);
  if (!t.text?.trim()) fallos.push('texto vacío');
  if (/[—–]/.test(t.text ?? '')) fallos.push('lleva «—» o «–»');
  const ruta = run?.route ?? null;
  if (!run) fallos.push('sin fila en coach_runs');
  else if (caso.ruta && ruta !== caso.ruta && !(caso.ruta === 'registro' && ruta === 'registro_reintento')) {
    fallos.push(`ruta ${ruta} (esperada ${caso.ruta})`);
  }
  for (const n of llamadas) if (!caso.permitidas.includes(n)) fallos.push(`herramienta no permitida: ${n}`);
  for (const n of caso.obligatorias ?? []) if (!llamadas.includes(n)) fallos.push(`falta herramienta: ${n}`);
  for (const re of caso.debeIncluir ?? []) if (!new RegExp(re, 'i').test(t.text ?? '')) fallos.push(`no incluye /${re}/`);
  for (const re of caso.noDebeIncluir ?? []) if (new RegExp(re, 'i').test(t.text ?? '')) fallos.push(`incluye /${re}/`);
  const coste = run ? Number(run.cost_micro_usd) / 1e6 : t.coste;
  const tope = BATERIA.topesUsd[(ruta ?? caso.ruta)?.startsWith('registro') ? 'registro' : 'completa'];
  if (coste > tope) fallos.push(`coste ${coste.toFixed(4)} $ > tope ${tope} $`);
  return {
    id: caso.id,
    grupo: caso.grupo,
    mensaje: caso.mensaje,
    resultado: fallos.length ? 'FAIL' : 'PASS',
    fallos,
    ruta,
    modelo: run?.model ?? null,
    coste,
    segundos: +(t.ms / 1000).toFixed(1),
    escrituras: llamadas.filter((n) => !lecturas.has(n)),
    herramientas: llamadas,
    texto: t.text,
    manual: caso.manual,
  };
}

// ── Ejecución ────────────────────────────────────────────────────────
const { jwt, sub } = await sesion();
console.log(`Cuenta de prueba: ${EMAIL} · ${CASOS.length} casos · ${hoyLocal()}\n`);
const resultados = [];
for (const caso of CASOS) {
  process.stdout.write(`${caso.id.padEnd(5)} ${caso.mensaje.slice(0, 60).padEnd(60)} `);
  const t = await turno(jwt, caso.mensaje);
  const run = await ultimaRun(sub, t.t0 ?? Date.now());
  const r = evaluar(caso, t, run);
  resultados.push(r);
  console.log(`${r.resultado} · ${r.ruta ?? '?'} · ${r.coste.toFixed(4)} $ · ${r.segundos} s${r.fallos.length ? `\n      ${r.fallos.join('\n      ')}` : ''}`);
}

const total = resultados.reduce((a, r) => a + r.coste, 0);
const pass = resultados.filter((r) => r.resultado === 'PASS').length;
const sello = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, `eval-${sello}.json`), JSON.stringify({ fecha: new Date().toISOString(), pass, total: resultados.length, costeUsd: total, resultados }, null, 2));
const md = [
  `# Evaluación del coach · ${new Date().toISOString().slice(0, 16)} UTC`,
  '',
  `${pass}/${resultados.length} PASS automáticos · coste total ${total.toFixed(4)} $. La columna «manual» la revisa una persona leyendo la respuesta.`,
  '',
  '| Caso | Resultado | Ruta | Modelo | Coste $ | s | Escrituras | Fallos |',
  '|---|---|---|---|---|---|---|---|',
  ...resultados.map((r) => `| ${r.id} | ${r.resultado} | ${r.ruta ?? '?'} | ${r.modelo ?? '?'} | ${r.coste.toFixed(4)} | ${r.segundos} | ${r.escrituras.join(', ') || '-'} | ${r.fallos.join('; ').replace(/\|/g, '/') || '-'} |`),
  '',
  ...resultados.flatMap((r) => [`## ${r.id} · ${r.mensaje}`, '', `**Revisión manual:** ${r.manual}`, '', '```', r.texto ?? '', '```', '']),
].join('\n');
writeFileSync(join(SALIDA, `eval-${sello}.md`), md);
console.log(`\n${pass}/${resultados.length} PASS · ${total.toFixed(4)} $ · informe en ${join(SALIDA, `eval-${sello}.md`)}`);
process.exit(pass === resultados.length ? 0 : 1);
