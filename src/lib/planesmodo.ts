// NIVL · El cobro por modos (1.1): productos, precios y derechos, en datos.
//
// Decisión del dueño: un modo (IRON, FOCUS, WORK o FOUNDER) cuesta 14,99 € al
// mes o 59,99 € al año; los cuatro, 30 € al mes o 99 € al año. El anual lleva
// 7 días gratis y el mensual no. No se venden combinaciones de 2 o 3: dos ya
// cuestan lo mismo que los cuatro, y Apple permite una sola suscripción activa
// por grupo. Los diez productos van en un solo grupo: de un modo a los cuatro
// lo gestiona la tienda como mejora.
//
// La base NIVL y sus hábitos siguen gratis. Quien pagó Pro o Élite conserva
// todo hasta que caduque. Los datos de un modo no se borran al dejar de pagar:
// aquí solo se decide qué se abre.
//
// Módulo PURO: sin Supabase. Los efectos (leer, comprar) están en `pro.ts`. La
// verdad de los derechos es `public.ai_modos` (0140); `modosDeFila` es su
// espejo para los tests y para pensar. Si tocas uno, toca el otro, y también
// `supabase/functions/_shared/productos-modo.ts` (el test de paridad avisa).

import type { ModoEtiqueta } from '@/modos/tipos';
import { NOMBRE_MODO } from '@/modos/tipos';
import { precioVisible, textoGestionTienda } from './proplans';

export type ModoDePago = ModoEtiqueta;
export const MODOS_DE_PAGO: readonly ModoDePago[] = ['iron', 'focus', 'work', 'founder'];

/** Lo que cubre un producto: un modo o los cuatro. */
export type Alcance = ModoDePago | 'todos';
export type Periodo = 'mensual' | 'anual';

export type ProductoModoId = `nivl_${Alcance}_${Periodo}`;
/** El valor de `subscriptions.plan` y `ai_plans.plan` (0140). */
export type PlanModo = `${Alcance}_${Periodo}`;

export interface ProductoModo {
  id: ProductoModoId;
  plan: PlanModo;
  alcance: Alcance;
  periodo: Periodo;
  cents: number;
  modos: readonly ModoDePago[];
  /** Días gratis que hay que configurar en la tienda como oferta introductoria. */
  diasGratis: number;
}

/** Los importes de la decisión del dueño. Si cambian, rehaz antes docs/PRECIOS.md y el freno de la 0140. */
export const PRECIOS_CENTS: Readonly<Record<'uno' | 'todos', Record<Periodo, number>>> = {
  uno: { mensual: 1499, anual: 5999 },
  todos: { mensual: 3000, anual: 9900 },
};

export const DIAS_GRATIS_ANUAL = 7;

function producto(alcance: Alcance, periodo: Periodo): ProductoModo {
  return {
    id: `nivl_${alcance}_${periodo}`,
    plan: `${alcance}_${periodo}`,
    alcance,
    periodo,
    cents: PRECIOS_CENTS[alcance === 'todos' ? 'todos' : 'uno'][periodo],
    modos: alcance === 'todos' ? MODOS_DE_PAGO : [alcance],
    diasGratis: periodo === 'anual' ? DIAS_GRATIS_ANUAL : 0,
  };
}

const ALCANCES: readonly Alcance[] = [...MODOS_DE_PAGO, 'todos'];
const PERIODOS: readonly Periodo[] = ['mensual', 'anual'];

/** Los diez productos de tienda, en un solo grupo de suscripción. */
export const PRODUCTOS_MODO: readonly ProductoModo[] = ALCANCES.flatMap((a) => PERIODOS.map((p) => producto(a, p)));

export function productoModo(alcance: Alcance, periodo: Periodo): ProductoModo {
  return PRODUCTOS_MODO.find((p) => p.alcance === alcance && p.periodo === periodo)!;
}

/** El id sin la parte de base plan de Google Play («nivl_iron_anual:anual»). */
function base(id: string | null | undefined): string {
  return (id ?? '').split(':')[0]!.trim();
}

export function esProductoModo(id: string | null | undefined): id is ProductoModoId {
  const b = base(id);
  return PRODUCTOS_MODO.some((p) => p.id === b);
}

export function productoPorId(id: string | null | undefined): ProductoModo | null {
  const b = base(id);
  return PRODUCTOS_MODO.find((p) => p.id === b) ?? null;
}

/** «14,99 €» o «30 €»: sin decimales cuando el importe es redondo. Solo para la tabla sin tienda. */
export function importeTabla(cents: number): string {
  const e = Math.round(cents) / 100;
  const texto = Number.isInteger(e) ? String(e) : e.toFixed(2).replace('.', ',');
  return `${texto} €`;
}

// ── Derechos ────────────────────────────────────────────────────────

/** Los planes de antes de la 1.1 y las pruebas: abren todo mientras duren (`ai_plans.modos`, 0140). */
const PLANES_CON_TODO: ReadonlySet<string> = new Set([
  'mensual',
  'anual',
  'pro_mensual',
  'pro_anual',
  'elite_mensual',
  'elite_anual',
  'elite_fundador',
  'cortesia',
  'owner',
  'prueba_auto',
]);

/** Qué abre un plan. Un plan desconocido no abre nada: cerrado por defecto. */
export function modosDelPlan(plan: string | null | undefined): readonly ModoDePago[] {
  if (!plan) return [];
  if (PLANES_CON_TODO.has(plan)) return MODOS_DE_PAGO;
  return PRODUCTOS_MODO.find((p) => p.plan === plan)?.modos ?? [];
}

/** Productos antiguos de la tienda: abren todo, como su plan. */
const PRODUCTOS_ANTIGUOS: ReadonlySet<string> = new Set([
  'nivl_pro_mensual',
  'nivl_pro_anual',
  'nivl_elite_mensual',
  'nivl_elite_anual',
  'nivl_elite_fundador',
]);

/** Qué abre un producto de tienda, o null si no es del catálogo. */
function modosDelProducto(id: string | null | undefined): readonly ModoDePago[] | null {
  if (PRODUCTOS_ANTIGUOS.has(base(id))) return MODOS_DE_PAGO;
  return productoPorId(id)?.modos ?? null;
}

export interface FilaSuscripcion {
  status: string;
  plan: string;
  provider: string | null;
  current_period_end: string | null;
  store_product_id: string | null;
}

const DIAS_GRACIA_MS = 2 * 24 * 3600_000;

/**
 * Espejo de `ai_state` + `ai_modos` (0140). La prueba de tienda del anual se
 * guarda como plan `cortesia` (la 0033 la escribe así, con su presupuesto de
 * prueba): por eso manda el producto de tienda antes que el plan, o una prueba
 * de IRON abriría los cuatro.
 */
export function modosDeFila(fila: FilaSuscripcion | null | undefined, ahora: number = Date.now()): readonly ModoDePago[] {
  if (!fila) return [];
  if (fila.status !== 'active' && fila.status !== 'trialing') return [];
  const prueba = fila.status === 'trialing' && (fila.plan === 'cortesia' || fila.plan === 'prueba_auto');
  const fin = fila.current_period_end ? Date.parse(fila.current_period_end) : null;
  if (prueba) {
    if (fin === null || !(fin > ahora)) return [];
  } else if (fin !== null && !(fin > ahora - DIAS_GRACIA_MS)) {
    return [];
  }
  if ((fila.provider === 'apple' || fila.provider === 'google') && fila.plan !== 'owner') {
    const delProducto = modosDelProducto(fila.store_product_id);
    if (delProducto) return delProducto;
  }
  return modosDelPlan(fila.plan);
}

/** Lo que devuelve la RPC `mis_modos()` (0140). */
export interface DerechosModos {
  modos: readonly ModoDePago[];
  todos: boolean;
  plan: string | null;
  producto: string | null;
  expira: string | null;
  trial: boolean;
}

function esModoDePago(v: unknown): v is ModoDePago {
  return typeof v === 'string' && (MODOS_DE_PAGO as readonly string[]).includes(v);
}

/** Lo que llega del servidor, con tipos. Sin lista de modos: null (no se sabe). */
export function derechosDe(v: unknown): DerechosModos | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.modos)) return null;
  const modos = MODOS_DE_PAGO.filter((m) => (o.modos as unknown[]).some((x) => x === m && esModoDePago(x)));
  const texto = (x: unknown) => (typeof x === 'string' && x ? x : null);
  return {
    modos,
    todos: modos.length === MODOS_DE_PAGO.length,
    plan: texto(o.plan),
    producto: texto(o.producto),
    expira: texto(o.expira),
    trial: o.trial === true,
  };
}

export function tieneModo(derechos: DerechosModos | null | undefined, modo: ModoDePago): boolean {
  return !!derechos?.modos.includes(modo);
}

/**
 * La puerta de un mundo. `esperar` hasta la primera lectura. Si la lectura
 * falla (derechos null) se abre: a quien paga no se le vende ni se le cierra
 * nada por un fallo de red, y el coach lo vuelve a comprobar en el servidor.
 */
export function puertaMundo(leido: boolean, derechos: DerechosModos | null, modo: ModoDePago): 'esperar' | 'abierto' | 'cerrado' {
  if (!leido) return 'esperar';
  if (!derechos) return 'abierto';
  return tieneModo(derechos, modo) ? 'abierto' : 'cerrado';
}

/** ¿La compra de `id` ya está reflejada en el servidor? */
export function compraModoReflejada(derechos: DerechosModos | null | undefined, id: ProductoModoId): boolean {
  const p = productoPorId(id);
  return !!p && !!derechos && p.modos.every((m) => derechos.modos.includes(m));
}

/** El servidor ya refleja exactamente ese producto (un cambio dentro del grupo). */
export function productoExacto(derechos: DerechosModos | null | undefined, id: ProductoModoId): boolean {
  return !!derechos && base(derechos.producto) === id;
}

/**
 * Qué supone comprar `nuevo` teniendo `actual` en la tienda. `subida` es de un
 * modo a los cuatro: inmediata. El resto (otro modo, otra duración, de los
 * cuatro a uno, o un Pro/Élite antiguo que pasa a modos) se aplica al renovar.
 */
export function tipoCambioModo(
  actual: string | null | undefined,
  nuevo: ProductoModoId,
): 'nueva' | 'mismo' | 'subida' | 'cambio' {
  if (!actual) return 'nueva';
  const a = base(actual);
  if (a === nuevo) return 'mismo';
  const previo = productoPorId(a);
  return previo && previo.alcance !== 'todos' && productoPorId(nuevo)?.alcance === 'todos' ? 'subida' : 'cambio';
}

/** El modo que se ofrece primero según el perfil de uso. */
const MODO_DE_PERFIL: Readonly<Record<string, ModoDePago>> = {
  deportista: 'iron',
  estudiante: 'focus',
  trabajador: 'work',
  emprendedor: 'founder',
};

export function modoDePerfil(kind: unknown): ModoDePago {
  return (typeof kind === 'string' && MODO_DE_PERFIL[kind]) || 'iron';
}

// ── Lo que se dice ──────────────────────────────────────────────────
// Español, como la letra de compra de proplans: es texto legal y espera
// revisión en cada idioma. Los equivalentes mensuales y los ahorros no se
// calculan: la tienda puede aplicar otro precio en cada país.

export function tituloProducto(id: ProductoModoId): string {
  const p = productoPorId(id)!;
  const que = p.alcance === 'todos' ? 'Todos los modos' : NOMBRE_MODO[p.alcance];
  return `NIVL ${que} ${p.periodo}`; // i18n-ok: nombre del producto en la tienda
}

export function periodoCorto(periodo: Periodo): string {
  return periodo === 'mensual' ? 'al mes' : 'al año';
}

export function notaAlcance(alcance: Alcance): string {
  return alcance === 'todos' ? 'IRON, FOCUS, WORK y FOUNDER, con su coach.' : 'Solo este modo y su coach.'; // i18n-ok: letra de compra
}

export const AVISO_IA = 'NIVL es una IA, no un profesional sanitario.'; // i18n-ok: letra de compra

/** Lo que el modo abre, en una línea, para su puerta cerrada. Solo lo que existe. */
export const QUE_ABRE: Readonly<Record<ModoDePago, string>> = {
  iron: 'Entreno, dieta y su coach, que programa tus cargas y corrige tu comida.', // i18n-ok: oferta
  focus: 'Temario, exámenes y su coach, que reparte tu estudio hasta cada fecha.', // i18n-ok: oferta
  work: 'Economía, agenda y su coach, que protege tu jornada.', // i18n-ok: oferta
  founder: 'Agenda, economía del negocio y su coach, que te pide las cifras.', // i18n-ok: oferta
};

export const LINEA_DATOS = 'Lo que registraste aquí sigue siendo tuyo. Nada se borra por no pagar.'; // i18n-ok: oferta
export const LINEA_BASE = 'NIVL y tus hábitos siguen gratis.'; // i18n-ok: oferta

export function textoBotonCompra(id: ProductoModoId, precio: string, periodoGratis: string | null): string {
  if (periodoGratis) return `Empezar mis ${periodoGratis} gratis`; // i18n-ok: letra de compra
  return `Suscribirme por ${precio} ${periodoCorto(productoPorId(id)!.periodo)}`; // i18n-ok: letra de compra
}

/** Los dos pasos de la prueba, solo si la tienda la declara. El día de cobro sale de sus días. */
export function pasosPrueba(periodoGratis: string | null): readonly { dia: string; texto: string }[] {
  const dias = periodoGratis ? /^(\d+) d[ií]as$/.exec(periodoGratis)?.[1] : null;
  if (!dias) return [];
  return [
    { dia: 'Hoy', texto: 'Empieza gratis' }, // i18n-ok: letra de compra
    { dia: `Día ${dias}`, texto: 'Primer cobro' }, // i18n-ok: letra de compra
  ];
}

/**
 * La letra que exigen las tiendas. `precio` es el de la tienda: sin precio
 * confirmado no hay condiciones que mostrar. `periodoGratis` solo si la tienda
 * declara la oferta introductoria para esta cuenta.
 */
export function legalModo(
  id: ProductoModoId,
  precio: string | null | undefined,
  periodoGratis: string | null,
  plataforma: string,
): string | null {
  const confirmado = precioVisible(precio);
  if (!confirmado) return null;
  const p = productoPorId(id)!;
  const duracion = p.periodo === 'mensual' ? 'mensual (1 mes)' : 'anual (1 año)';
  const cobro = periodoGratis
    ? `${periodoGratis} gratis y después ${confirmado} ${periodoCorto(p.periodo)}`
    : `${confirmado} ${periodoCorto(p.periodo)}`;
  return (
    `${tituloProducto(id)}: suscripción ${duracion} de renovación automática. ${cobro}. ` + // i18n-ok: letra de compra
    'El cobro se hace en tu cuenta de la tienda y se renueva sola salvo que la canceles al menos 24 horas antes de que acabe el periodo. ' + // i18n-ok: letra de compra
    `${textoGestionTienda(plataforma)} ${LINEA_BASE} ${AVISO_IA}`
  );
}
