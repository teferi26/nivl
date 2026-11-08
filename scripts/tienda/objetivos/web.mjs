// Objetivo web: la app en el navegador a 1440x900 y escala 2 (2880x1800), con el
// arnés de datos ficticios y Chrome sin cabeza.
import fs from 'node:fs';
import { capturarWeb } from './_apoyo/web.mjs';

const CHROME = process.env.NIVL_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export default {
  id: 'web',
  familia: 'web',
  nota: 'Vista de la web en escritorio.',

  disponible(ctx) {
    if (!fs.existsSync(CHROME)) return { ok: false, motivo: `no está Chrome en ${CHROME} (o define NIVL_CHROME)` };
    if (!ctx.raiz) return { ok: false, motivo: 'falta la copia del commit con el arnés' };
    return { ok: true };
  },

  capturar: (ctx) => capturarWeb(ctx, { origen: 'vista de la web en escritorio' }),
};
