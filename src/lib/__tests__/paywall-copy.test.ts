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
    for (const tier of ['pro'] as const) {
      const c = P.copyUpsell(m, tier);
      t.push(c.eyebrow, c.titulo, c.linea, c.enlace, c.contexto);
    }
  }
  for (const b of P.PRO_BENEFITS) t.push(b.title, b.detail);
  t.push(P.COACH_USAGE_NOTICE);
  t.push(P.textoPrueba(), P.tituloBotonPrueba());
  for (const o of P.TIERS_A_LA_VENTA) t.push(o.name, o.label, o.power);
  const intro = P.textoIntro({ price: 0, priceString: '0 €', cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: 7 }, true)!;
  for (const p of P.PRO_PLANS) {
    t.push(P.tituloPlan(p.id), P.duracionPlan(p.id), P.pitchVisible(p));
    for (const os of ['ios', 'android', 'web']) {
      t.push(P.legalText(p.id, '9,99 €', null, os)!, P.legalText(p.id, '9,99 €', intro, os)!, P.textoGestionTienda(os));
    }
  }
  for (const k of PROFILE_KINDS) t.push(P.proEmphasis(k), ...P.proToday(k), ...P.proSampleBrief(k));
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

  test('la prueba se describe como es: estándar, gratis, una vez y sin renovación', () => {
    {
      expect(P.textoPrueba()).toMatch(/[Gg]ratis/);
      expect(P.textoPrueba()).toMatch(/una sola vez por cuenta/);
      expect(P.textoPrueba()).toMatch(/no se renueva sola|No se renueva sola/);
      expect(P.textoPrueba()).toMatch(/no se cobra nada/);
      // Apple 3.1.1: nada que contraponga la prueba al pago de la tienda.
      expect(P.textoPrueba()).not.toMatch(/tarjeta|método de pago|fuera de la tienda/i);
    }
    expect(P.LINEA_PRUEBA).toBe('Prueba el coach 7 días: gratis y sin renovación.');
    expect(P.LINEA_PRUEBA).not.toMatch(/tarjeta/i);
    expect(P.textoPrueba()).toMatch(/energía limitada/);
    expect(P.textoPrueba()).not.toMatch(/profundo|estándar|Élite/);
    expect(P.tituloBotonPrueba()).toBe('Probar el coach 7 días');
    // Ninguna oferta introductoria de tienda en 1.0.8: la letra no la menciona sin que la tienda la declare.
    for (const p of P.PRO_PLANS) expect(P.legalText(p.id, '9,99 €')).not.toMatch(/prueba|Oferta de la tienda/);
  });
});
