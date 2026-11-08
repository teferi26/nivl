// Objetivo Mac: NIVL no tiene app nativa de Mac ni hay simulador de macOS, así que
// esto es la VISTA DE LA WEB EN ESCRITORIO a 2880x1800. No es una captura de una
// app nativa de Mac y no debe presentarse como tal. La app de iPad en un Mac con
// Apple silicon usa las capturas de iPad, no estas.
import fs from 'node:fs';
import { capturarWeb } from './_apoyo/web.mjs';

export const NATURALEZA = 'vista de la web en escritorio';
const CHROME = process.env.NIVL_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export default {
  id: 'mac',
  familia: 'mac',
  nota: `${NATURALEZA}; no es una captura de app nativa de Mac. La app de iPad en un Mac usa las capturas de iPad.`,

  disponible(ctx) {
    if (!fs.existsSync(CHROME)) return { ok: false, motivo: `no está Chrome en ${CHROME} (o define NIVL_CHROME)` };
    if (!ctx.raiz) return { ok: false, motivo: 'falta la copia del commit con el arnés' };
    return { ok: true };
  },

  capturar: (ctx) => capturarWeb(ctx, { origen: NATURALEZA }),
};
