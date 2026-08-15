// NIVL · Prueba de fuego del coach, de punta a punta.
//
// Abre una sesión real del usuario (enlace mágico de un solo uso), llama a la
// Edge Function como lo haría la app y va imprimiendo lo que llega por el
// stream: texto, pensamiento y herramientas ejecutadas. Al final resume el
// coste real del turno leyendo coach_runs.
//
// Uso:
//   node scripts/smoke-coach.mjs ["mensaje"] [--kind chat|brief|...]
//
// Ninguna credencial se imprime.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingTokenMessage, readToken } from './token.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = 'dueyufxxkiixdxighpaz';
const SB_URL = `https://${REF}.supabase.co`;
const EMAIL = process.env.NIVL_EMAIL ?? 'teferi@springmarket.es';

const argv = process.argv.slice(2);
const kindIdx = argv.indexOf('--kind');
const KIND = kindIdx !== -1 ? argv[kindIdx + 1] : 'chat';
// Ojo con el índice: sin --kind, kindIdx es -1 y "kindIdx + 1" vale 0, que es
// justo la posición del mensaje. Solo se descarta el valor de --kind cuando
// la bandera existe de verdad.
const posicional = argv.filter(
  (a, i) => !a.startsWith('--') && !(kindIdx !== -1 && i === kindIdx + 1),
);
const MENSAJE =
  posicional[0] ?? 'Preséntate en dos frases y dime qué recuerdas de mí y de mis objetivos.';

const PAT = readToken(ROOT);
if (!PAT) {
  console.error(missingTokenMessage(ROOT));
  process.exit(1);
}

// 1) Claves del proyecto (en memoria, nunca se imprimen).
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
  console.error('Faltan las claves anon/service_role en la respuesta.');
  process.exit(1);
}

// 2) Sesión real del usuario mediante enlace mágico de un solo uso.
const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: {
    apikey: SERVICE,
    authorization: `Bearer ${SERVICE}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL }),
});
if (!linkRes.ok) {
  console.error('No se pudo generar el enlace de sesión:', (await linkRes.text()).slice(0, 300));
  process.exit(1);
}
const link = await linkRes.json();
const hashed = link.properties?.hashed_token ?? link.hashed_token;

const verifyRes = await fetch(
  `${SB_URL}/auth/v1/verify?token=${encodeURIComponent(hashed)}&type=magiclink&redirect_to=${encodeURIComponent('http://localhost/')}`,
  { headers: { apikey: ANON }, redirect: 'manual' },
);
const loc = verifyRes.headers.get('location') ?? '';
const jwt = new URLSearchParams(loc.split('#')[1] ?? '').get('access_token');
if (!jwt) {
  console.error('No se obtuvo sesión. HTTP', verifyRes.status, loc.slice(0, 200));
  process.exit(1);
}
console.log(`Sesión abierta para ${EMAIL}`);
console.log(`Ritual: ${KIND}`);
console.log(`Mensaje: "${MENSAJE}"\n${'─'.repeat(60)}`);

// 3) Llamada a la función, leyendo el stream como haría la app.
const t0 = Date.now();
const res = await fetch(`${SB_URL}/functions/v1/coach`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${jwt}`,
    apikey: ANON,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ kind: KIND, message: MENSAJE }),
});

if (!res.ok || !res.body) {
  console.error('\nHTTP', res.status, (await res.text()).slice(0, 600));
  process.exit(1);
}

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
let herramientas = 0;
let pensando = false;
let error = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  let sep;
  while ((sep = buf.indexOf('\n\n')) !== -1) {
    const raw = buf.slice(0, sep);
    buf = buf.slice(sep + 2);
    const ev = raw.match(/^event:\s*(.*)$/m)?.[1];
    const dataLine = raw.match(/^data:\s*(.*)$/m)?.[1];
    if (!ev || !dataLine) continue;
    let d;
    try {
      d = JSON.parse(dataLine);
    } catch {
      continue;
    }
    if (ev === 'thinking' && !pensando) {
      pensando = true;
      process.stdout.write('[el sistema está pensando]\n');
    } else if (ev === 'text') {
      process.stdout.write(d.delta);
    } else if (ev === 'tool') {
      herramientas++;
      process.stdout.write(`\n  · herramienta ${d.ok ? 'OK ' : 'ERROR '}${d.name}: ${d.detail}\n`);
    } else if (ev === 'error') {
      error = d.message;
    } else if (ev === 'done') {
      const usd = (d.cost_micro_usd ?? 0) / 1e6;
      process.stdout.write(
        `\n${'─'.repeat(60)}\n` +
          `Turno completado en ${((Date.now() - t0) / 1000).toFixed(1)}s · ` +
          `${herramientas} herramienta(s) · coste ${usd.toFixed(4)} $\n`,
      );
    }
  }
}

if (error) {
  console.error(`\nERROR: ${error}`);
  process.exit(1);
}
