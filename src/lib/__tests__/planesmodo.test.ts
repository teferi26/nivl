// El cobro por modos: precios, productos y quién tiene derecho a qué.
// Los archivos del servidor se leen como texto: el empaquetado de las Edge
// Functions no sube nada de fuera de `supabase/`, así que la lista está copiada.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compraModoReflejada,
  derechosDe,
  importeTabla,
  legalModo,
  MODOS_DE_PAGO,
  modoDePerfil,
  modosDeFila,
  modosDelPlan,
  pasosPrueba,
  productoExacto,
  productoModo,
  PRODUCTOS_MODO,
  puertaMundo,
  textoBotonCompra,
  tipoCambioModo,
  type FilaSuscripcion,
} from '../planesmodo';

const AHORA = Date.parse('2026-11-08T12:00:00Z');
const MANANA = '2026-11-09T12:00:00Z';
const AYER = '2026-11-07T12:00:00Z';
const HACE_UNA_SEMANA = '2026-11-01T12:00:00Z';

const fila = (o: Partial<FilaSuscripcion>): FilaSuscripcion => ({
  status: 'active',
  plan: 'iron_mensual',
  provider: 'apple',
  current_period_end: MANANA,
  store_product_id: 'nivl_iron_mensual',
  ...o,
});

describe('productos y precios', () => {
  test('diez productos: cuatro modos y todos, mensual y anual', () => {
    expect(PRODUCTOS_MODO).toHaveLength(10);
    expect(new Set(PRODUCTOS_MODO.map((p) => p.id)).size).toBe(10);
    expect(PRODUCTOS_MODO.map((p) => p.id)).toContain('nivl_founder_anual');
    expect(PRODUCTOS_MODO.map((p) => p.id)).toContain('nivl_todos_mensual');
  });

  test('los importes de la decisión del dueño', () => {
    for (const modo of MODOS_DE_PAGO) {
      expect(productoModo(modo, 'mensual').cents).toBe(1499);
      expect(productoModo(modo, 'anual').cents).toBe(5999);
    }
    expect(productoModo('todos', 'mensual').cents).toBe(3000);
    expect(productoModo('todos', 'anual').cents).toBe(9900);
    expect(importeTabla(5999)).toBe('59,99 €');
    expect(importeTabla(9900)).toBe('99 €');
  });

  test('el anual lleva 7 días gratis y el mensual no', () => {
    for (const p of PRODUCTOS_MODO) expect(p.diasGratis).toBe(p.periodo === 'anual' ? 7 : 0);
  });

  test('no se venden combinaciones: un modo abre uno y todos abre los cuatro', () => {
    for (const p of PRODUCTOS_MODO) expect(p.modos).toHaveLength(p.alcance === 'todos' ? 4 : 1);
  });
});

describe('derechos', () => {
  test('uno: solo su modo', () => {
    expect(modosDeFila(fila({}), AHORA)).toEqual(['iron']);
    expect(modosDelPlan('focus_anual')).toEqual(['focus']);
  });

  test('todos: los cuatro', () => {
    expect(modosDeFila(fila({ plan: 'todos_anual', store_product_id: 'nivl_todos_anual' }), AHORA)).toEqual(MODOS_DE_PAGO);
  });

  test('caducado: nada, pasados los dos días de gracia del webhook', () => {
    expect(modosDeFila(fila({ current_period_end: HACE_UNA_SEMANA }), AHORA)).toEqual([]);
    expect(modosDeFila(fila({ current_period_end: AYER }), AHORA)).toEqual(['iron']);
    expect(modosDeFila(fila({ status: 'canceled' }), AHORA)).toEqual([]);
    expect(modosDeFila(null, AHORA)).toEqual([]);
  });

  test('Pro y Élite antiguos: todo hasta que caduque', () => {
    for (const plan of ['mensual', 'anual', 'pro_mensual', 'pro_anual', 'elite_mensual', 'elite_anual', 'elite_fundador']) {
      expect(modosDeFila(fila({ plan, provider: 'stripe', store_product_id: null }), AHORA)).toEqual(MODOS_DE_PAGO);
    }
    expect(modosDeFila(fila({ plan: 'pro_anual', store_product_id: 'nivl_pro_anual' }), AHORA)).toEqual(MODOS_DE_PAGO);
    expect(modosDeFila(fila({ plan: 'pro_anual', store_product_id: 'nivl_pro_anual', current_period_end: HACE_UNA_SEMANA }), AHORA)).toEqual([]);
  });

  test('la prueba del anual de un modo abre ese modo, no los cuatro, aunque se guarde como cortesía', () => {
    const prueba = fila({ status: 'trialing', plan: 'cortesia', store_product_id: 'nivl_iron_anual' });
    expect(modosDeFila(prueba, AHORA)).toEqual(['iron']);
    // Y sin días de gracia: una prueba no se renueva.
    expect(modosDeFila({ ...prueba, current_period_end: AYER }, AHORA)).toEqual([]);
  });

  test('las pruebas y cortesías del servidor abren todo mientras duran', () => {
    expect(modosDeFila(fila({ status: 'trialing', plan: 'cortesia', provider: 'manual', store_product_id: null }), AHORA)).toEqual(MODOS_DE_PAGO);
    expect(modosDeFila(fila({ status: 'trialing', plan: 'prueba_auto', provider: 'prueba', store_product_id: null }), AHORA)).toEqual(MODOS_DE_PAGO);
  });

  test('un plan desconocido no abre nada', () => {
    expect(modosDelPlan('plan_del_futuro')).toEqual([]);
    expect(modosDeFila(fila({ plan: 'plan_del_futuro', provider: 'stripe', store_product_id: null }), AHORA)).toEqual([]);
  });

  test('cliente antiguo: una respuesta sin lista de modos es «no se sabe», y la puerta no se cierra', () => {
    expect(derechosDe({ entitled: true, plan: 'pro_anual' })).toBeNull();
    expect(derechosDe(null)).toBeNull();
    expect(puertaMundo(true, null, 'iron')).toBe('abierto');
  });

  test('la respuesta del servidor se limpia: lo desconocido no cuenta', () => {
    const d = derechosDe({ modos: ['iron', 'general', 3], plan: 'iron_anual', producto: 'nivl_iron_anual', expira: MANANA, trial: true })!;
    expect(d.modos).toEqual(['iron']);
    expect(d.todos).toBe(false);
    expect(d.trial).toBe(true);
    expect(derechosDe({ modos: MODOS_DE_PAGO })!.todos).toBe(true);
  });

  test('la puerta de un mundo', () => {
    const iron = derechosDe({ modos: ['iron'] });
    expect(puertaMundo(false, null, 'iron')).toBe('esperar');
    expect(puertaMundo(true, iron, 'iron')).toBe('abierto');
    expect(puertaMundo(true, iron, 'focus')).toBe('cerrado');
    expect(puertaMundo(true, derechosDe({ modos: [] }), 'focus')).toBe('cerrado');
  });
});

describe('la compra', () => {
  test('de un modo a los cuatro es subida; el resto va al renovar', () => {
    expect(tipoCambioModo(null, 'nivl_iron_anual')).toBe('nueva');
    expect(tipoCambioModo('nivl_iron_anual:anual', 'nivl_iron_anual')).toBe('mismo');
    expect(tipoCambioModo('nivl_iron_anual', 'nivl_todos_anual')).toBe('subida');
    expect(tipoCambioModo('nivl_iron_anual', 'nivl_focus_anual')).toBe('cambio');
    expect(tipoCambioModo('nivl_iron_mensual', 'nivl_iron_anual')).toBe('cambio');
    expect(tipoCambioModo('nivl_todos_anual', 'nivl_iron_anual')).toBe('cambio');
    expect(tipoCambioModo('nivl_pro_anual', 'nivl_todos_anual')).toBe('cambio');
  });

  test('una compra está reflejada cuando el servidor abre sus modos', () => {
    const iron = derechosDe({ modos: ['iron'], producto: 'nivl_iron_mensual' });
    expect(compraModoReflejada(iron, 'nivl_iron_anual')).toBe(true);
    expect(compraModoReflejada(iron, 'nivl_todos_anual')).toBe(false);
    expect(productoExacto(iron, 'nivl_iron_mensual')).toBe(true);
    expect(productoExacto(iron, 'nivl_iron_anual')).toBe(false);
  });

  test('el botón y la letra dicen el importe facturado, y la prueba solo si la tienda la declara', () => {
    expect(textoBotonCompra('nivl_iron_mensual', '14,99 €', null)).toBe('Suscribirme por 14,99 € al mes');
    expect(textoBotonCompra('nivl_iron_anual', '59,99 €', null)).toBe('Suscribirme por 59,99 € al año');
    expect(textoBotonCompra('nivl_iron_anual', '59,99 €', '7 días')).toBe('Empezar mis 7 días gratis');
    expect(legalModo('nivl_iron_anual', '59,99 €', '7 días', 'ios')).toContain('7 días gratis y después 59,99 € al año');
    expect(legalModo('nivl_iron_anual', '59,99 €', null, 'ios')).not.toContain('gratis y después');
    expect(legalModo('nivl_iron_anual', null, null, 'ios')).toBeNull();
    expect(legalModo('nivl_todos_mensual', '30 €', null, 'android')).toContain('renovación automática');
    expect(pasosPrueba('7 días').map((p) => p.dia)).toEqual(['Hoy', 'Día 7']);
    expect(pasosPrueba(null)).toEqual([]);
  });

  test('el modo que se ofrece primero sale del perfil', () => {
    expect(modoDePerfil('estudiante')).toBe('focus');
    expect(modoDePerfil('emprendedor')).toBe('founder');
    expect(modoDePerfil('general')).toBe('iron');
    expect(modoDePerfil(undefined)).toBe('iron');
  });
});

describe('paridad con el servidor', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8');
  const migracion = leer('supabase/migrations/0140_cobro_por_modos.sql');
  const espejo = leer('supabase/functions/_shared/productos-modo.ts');

  test.each(PRODUCTOS_MODO.map((p) => [p.id, p.plan] as const))('%s está en la 0140 y en las Edge Functions', (id, plan) => {
    expect(migracion).toContain(`('${id}', '${plan}'`);
    expect(espejo).toContain(`'${id}'`);
  });

  test('la 0140 da a cada plan sus modos y a Pro y Élite, todos', () => {
    expect(migracion).toMatch(/'mensual', 'anual', 'pro_mensual', 'pro_anual',\s+'elite_mensual', 'elite_anual', 'elite_fundador', 'cortesia', 'owner', 'prueba_auto'/);
  });

  test('ninguna migración de cobro borra datos de un modo', () => {
    expect(migracion).not.toMatch(/\b(delete from|drop table|truncate)\b/i);
  });
});

describe('salida a tienda', () => {
  const { avisoCambioModo, catalogoTrasCargar, legalModo } = require('../planesmodo') as typeof import('../planesmodo');

  test('cambiar de un modo a otro avisa antes de cobrar y nombra lo que se pierde', () => {
    const aviso = avisoCambioModo('nivl_iron_mensual', 'nivl_focus_mensual');
    expect(aviso).toMatch(/IRON/);
    expect(aviso).toMatch(/FOCUS/);
  });

  test('sin plan, el mismo plan o pasar a los cuatro no avisan', () => {
    expect(avisoCambioModo(null, 'nivl_focus_mensual')).toBeNull();
    expect(avisoCambioModo('nivl_iron_mensual', 'nivl_iron_mensual')).toBeNull();
    expect(avisoCambioModo('nivl_iron_mensual', 'nivl_todos_mensual')).toBeNull();
  });

  test('una tienda sin productos es error con reintento, no pantalla muerta', () => {
    expect(catalogoTrasCargar({})).toBe('error');
    expect(catalogoTrasCargar({ nivl_iron_mensual: '14,99 €' })).toBe('listo');
  });

  test('la letra declara el freno de uso y no promete uso ilimitado', () => {
    const letra = legalModo('nivl_iron_anual', '59,99 €', null, 'ios')!;
    expect(letra).toMatch(/pausar el coach/);
    expect(letra).not.toMatch(/cuanto quieras/i);
  });
});

describe('plantilla del contrato', () => {
  const IDIOMAS = ['es', 'en', 'fr', 'de', 'pt', 'it'];
  test.each(IDIOMAS)('%s: ni dieta ni ejercicio como castigo', (l) => {
    const d = JSON.parse(readFileSync(join(__dirname, `../../i18n/${l}/contrato.json`), 'utf8'));
    const textos = Object.values(d.hook.plantilla as Record<string, { consecuencia: string }>).map((p) => p.consecuencia);
    for (const c of textos) expect(c).not.toMatch(/km|dieta|diet|régime|Diät|comiendo|eating|ayun|fasting/i);
  });
});
