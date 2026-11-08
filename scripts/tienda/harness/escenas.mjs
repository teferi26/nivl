// La lista de escenas y giras del arnés. La fuente es app/escenas.json (la lee
// también la app); aquí se añade lo que necesita quien dirige desde fuera.
import fs from 'node:fs';

const guion = JSON.parse(fs.readFileSync(new URL('./app/escenas.json', import.meta.url), 'utf8'));

/** @type {{id: string, titulo: string, ruta: string, plan?: string}[]} */
export const escenas = guion.escenas.map(({ id, titulo, ruta, plan }) => ({ id, titulo, ruta, ...(plan ? { plan } : {}) }));

function duracionDe(pasos) {
  return pasos.reduce((t, p) => t + (p.espera ?? 0) + (p.ms ?? 0) + (p.ir ? 130 : 0), 0);
}

/** @type {Record<string, {duracionMs: number}>} La duración estimada de cada gira, sin el retraso inicial. */
export const giras = Object.fromEntries(
  Object.entries(guion.giras).map(([nombre, pasos]) => [nombre, { duracionMs: duracionDe(pasos) }]),
);

export const urlEscena = (id, token) => `nivl://__tienda/escena?id=${encodeURIComponent(id)}${token ? `&token=${token}` : ''}`;
export const urlGira = (nombre, { retraso = 0, token } = {}) =>
  `nivl://__tienda/gira?nombre=${encodeURIComponent(nombre)}&retraso=${retraso}${token ? `&token=${token}` : ''}`;
