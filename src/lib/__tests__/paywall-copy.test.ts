// Barrido de los textos visibles de Compras (fase 3, auditoría de conversión):
// sin guion largo, sin «gratis para siempre», sin «ilimitado», sin cuentas
// atrás ni urgencias, sin exclamaciones. Dos pasadas: los archivos fuente
// (sin comentarios) y los textos que generan las funciones puras.
import { readFileSync } from 'fs';
import { join } from 'path';
import { PROFILE_KINDS } from '../kinds';
import { MOMENTOS } from '../paywallmoment';
import * as P from '../proplans';

const RAIZ = join(__dirname, '..', '..', '..');
const ARCHIVOS = [
  'src/lib/proplans.ts',
  'src/lib/paywallmoment.ts',
  'src/lib/pro.ts',
  'src/components/ProOffer.tsx',
  'src/app/pro.tsx',
];

const GUIONES = /[—–]/;
const PROHIBIDO =
  /gratis para siempre|para siempre gratis|ilimitad|sin l[ií]mite|cuenta atr[aá]s|quedan \d+ (h|horas|min|minutos|d[ií]as)|termina en \d|expira en|solo hoy|[uú]ltimas? (horas|unidades|oportunidad)|date prisa|ahora o nunca|antes de que se acabe|no te lo pierdas/i;

/** Quita comentarios de bloque, de JSX y de línea (sin romper las URL). */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('archivos de Compras', () => {
  test.each(ARCHIVOS)('%s: sin guion largo en ninguna parte', (archivo) => {
    const fuente = readFileSync(join(RAIZ, archivo), 'utf8');
    const lineas = fuente.split('\n').filter((l) => GUIONES.test(l));
    expect(lineas).toEqual([]);
  });

  test.each(ARCHIVOS)('%s: sin promesas ni urgencias prohibidas en el código', (archivo) => {
    const codigo = sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));
    const lineas = codigo.split('\n').filter((l) => PROHIBIDO.test(l));
    expect(lineas).toEqual([]);
  });
});

/** Todo lo que las funciones puras pueden poner en pantalla. */
function textosVisibles(): string[] {
  const t: string[] = [];
  for (const m of MOMENTOS) {
    for (const tier of ['pro', 'elite'] as const) {
      const c = P.copyUpsell(m, tier);
      t.push(c.eyebrow, c.titulo, c.linea, c.enlace, c.contexto);
    }
  }
  for (const b of [...P.PRO_BENEFITS, ...P.ELITE_BENEFITS]) t.push(b.title, b.detail);
  t.push(P.COACH_USAGE_NOTICE, P.ELITE_USAGE_NOTICE);
  for (const tier of ['pro', 'elite'] as const) {
    t.push(P.textoPrueba(tier), P.tituloBotonPrueba(tier));
    const o = P.tierOffer(tier);
    t.push(o.name, o.label, o.power);
  }
  const intro = P.textoIntro({ price: 0, priceString: '0 €', cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: 7 }, true)!;
  for (const p of P.PRO_PLANS) {
    t.push(P.tituloPlan(p.id), P.duracionPlan(p.id), P.pitchVisible(p));
    for (const os of ['ios', 'android', 'web']) {
      t.push(P.legalText(p.id, '9,99 €', null, os)!, P.legalText(p.id, '9,99 €', intro, os)!, P.textoGestionTienda(os));
    }
  }
  for (const k of PROFILE_KINDS) t.push(P.proEmphasis(k), ...P.proToday(k), ...P.proSampleBrief(k));
  const base = { ...P.SIN_IA, entitled: true, tier: 'elite' as const, deepAllowed: true };
  for (const s of [base, { ...base, deepRemaining: 100000, deepTurns: 0 }, { ...base, deepRemaining: 100000, deepTurns: 1 }, { ...base, deepRemaining: 900000, deepTurns: 9 }]) {
    t.push(P.lineaProfundos(s));
  }
  for (const plan of ['pro_anual', 'elite_fundador', 'cortesia', 'owner', null, 'desconocido']) t.push(P.planLabel(plan));
  return t;
}

describe('textos generados', () => {
  test('ninguno vacío, sin guion largo, sin exclamaciones ni urgencias', () => {
    const textos = textosVisibles();
    expect(textos.length).toBeGreaterThan(150);
    for (const texto of textos) {
      expect(typeof texto).toBe('string');
      expect(texto.trim().length).toBeGreaterThan(0);
      expect(texto).not.toMatch(GUIONES);
      expect(texto).not.toMatch(/[!¡]/);
      expect(texto).not.toMatch(PROHIBIDO);
      expect(texto).not.toMatch(/cazador|mazmorra/i);
    }
  });

  test('la prueba se describe como es: estándar, sin tarjeta, sin renovación y sin modo profundo en Élite', () => {
    expect(P.textoPrueba('pro')).toMatch(/sin tarjeta/);
    expect(P.textoPrueba('pro')).toMatch(/No se renueva sola/);
    expect(P.textoPrueba('pro')).toMatch(/energía limitada/);
    expect(P.textoPrueba('elite')).toMatch(/de Pro/);
    expect(P.textoPrueba('elite')).toMatch(/sin modo profundo/);
    expect(P.tituloBotonPrueba('elite')).toBe('Probar Pro 7 días');
    expect(P.tituloBotonPrueba('pro')).toBe('Probar el coach 7 días');
    // Ninguna oferta introductoria de tienda en 1.0.8: la letra no la menciona sin que la tienda la declare.
    for (const p of P.PRO_PLANS) expect(P.legalText(p.id, '9,99 €')).not.toMatch(/prueba|Oferta de la tienda/);
  });
});
