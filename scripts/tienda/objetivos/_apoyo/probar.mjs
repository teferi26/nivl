#!/usr/bin/env node
// Prueba suelta de los objetivos no iOS, sin pasar por tienda.mjs:
//   node scripts/tienda/objetivos/_apoyo/probar.mjs --objetivo apple-tv --commit HEAD \
//        --fuente-tv <sha> [--muestra] [--salida dir] [--clases ultra-4,se-3]
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { construir } from '../../harness/construir.mjs';
import { RAIZ_REPO } from './nativo.mjs';

const valor = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const id = valor('objetivo');
const commit = valor('commit', 'HEAD');
const sha = execFileSync('git', ['rev-parse', commit], { cwd: RAIZ_REPO, encoding: 'utf8' }).trim();
const sha7 = sha.slice(0, 7);
const salida = path.resolve(valor('salida', path.join(RAIZ_REPO, `.tienda/prueba-objetivos/${id}`)));
const log = (m) => console.log(`[${id}] ${m}`);

const { default: objetivo } = await import(`../${id}.mjs`);
const ctx = { commit: sha, sha7, raiz: null, salida, app: null, muestra: process.argv.includes('--muestra'), escenas: null, log };
if (valor('clases')) ctx.clases = valor('clases').split(',');
if (id === 'web' || id === 'mac') ctx.raiz = (await construir({ commit: sha, log })).src;

const disp = objetivo.disponible(ctx);
console.log(JSON.stringify({ disponible: disp }));
if (disp.ok) {
  const t = Date.now();
  const r = await objetivo.capturar(ctx);
  console.log(JSON.stringify({ segundos: Math.round((Date.now() - t) / 1000), capturas: r }, null, 1));
}
