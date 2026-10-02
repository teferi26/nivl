// NIVL · Cola de celebraciones (L3, SISTEMA.md §7 y §8). Lógica pura: sin
// Supabase ni React. El proveedor (CelebracionProvider) pone los relojes, la
// persistencia y la pintura; aquí solo se decide QUÉ se enseña y CUÁNDO.
//
// Una pantalla manda lo que va sabiendo de una acción (`AccionCelebrable`)
// en una o varias llamadas con el mismo `accion`: el XP llega antes, el rango
// del servidor llega tarde. Mientras la ventana está abierta se acumula; al
// cerrarse (final:true o 2,5 s) se decide UNA vez con todo lo acumulado:
//
//   celebrarCambio(acumulado) + extra → colaDeCelebracion(lista, vistas)
//
// Una principal y un resumen, nunca una cascada. Nunca dos toasts a la vez ni
// un toast con una ceremonia: si el rango llega tarde mientras se ve el toast
// de la MISMA acción, la ceremonia se lo come y su texto pasa al resumen.

import type { AccionCelebrable, PerfilEco } from '@/components/celebracion/contexto';
import { celebrarCambio, codigoRango, colaDeCelebracion, estadoDe, type Celebracion, type EstadoProgreso, type LogroInfo } from './progression';

export type FormaMomento = 'ceremonia-epica' | 'ceremonia-corta' | 'toast';

export interface Momento {
  principal: Celebracion | null;
  /** Líneas del resumen: las de la acción y las celebraciones que no son principal. */
  resumen: string[];
  clavesResto: string[];
  forma: FormaMomento;
  /** Acción de la que sale (para la absorción). null en un aviso suelto. */
  accion: string | null;
  /** Estado tras la acción (siguiente rango, tarjeta de nivel); null si no llegó perfil. */
  estado: EstadoProgreso | null;
}

/** Lo que se sabe de una acción, fusionado. */
export interface Acumulado {
  perfilAntes?: PerfilEco;
  perfilDespues?: PerfilEco;
  logrosAntes?: string[];
  logrosNuevos: LogroInfo[];
  fecha?: string;
  recuperadoXp?: number;
  extra: Celebracion[];
  resumen: string[];
  /** Ventana cerrada: lista para decidirse. */
  cerrada: boolean;
}

export interface EstadoCola {
  acciones: Map<string, Acumulado>;
  mostrando: Momento | null;
  vistas: Set<string>;
  cargado: boolean;
  /** Acciones cerradas que esperan turno, en orden de cierre. */
  listas: string[];
  /** Con la hoja de compartir abierta no sale nada nuevo. */
  pausa: boolean;
  /**
   * Acciones ya decididas (las últimas MAX_HISTORICO): si llega algo tarde de
   * una de ellas, la ventana se reabre con lo ya sabido (perfiles, logros).
   */
  historico: Map<string, Acumulado>;
}

export type EventoCola =
  /** Llegan las claves guardadas: desde aquí ya se puede enseñar. */
  | { tipo: 'cargar'; vistas: Iterable<string> }
  /** Cierre de sesión o cambio de usuario: memoria a cero y sin cargar. */
  | { tipo: 'vaciar' }
  | { tipo: 'llega'; a: AccionCelebrable }
  /** Fin de la ventana por tiempo (2,5 s). */
  | { tipo: 'cerrar'; accion: string }
  /** Toast suelto, por la misma cola. `id` lo da quien llama (único). */
  | { tipo: 'avisar'; id: string; texto: string }
  /** El momento visible terminó (toast apagado o ceremonia cerrada). */
  | { tipo: 'ocultar' }
  | { tipo: 'pausar'; pausa: boolean };

export const MAX_VISTAS = 300;
export const VENTANA_MS = 2500;
export const MAX_HISTORICO = 20;

const CERO: PerfilEco = { xp_total: 0, streak_days: 0, protection_stones: 0 };

export function estadoInicial(): EstadoCola {
  return { acciones: new Map(), mostrando: null, vistas: new Set(), cargado: false, listas: [], pausa: false, historico: new Map() };
}

/** Lo que dice la celebración en una línea (toast y resumen). */
export function textoDe(c: Celebracion): string {
  switch (c.tipo) {
    case 'rango':
      return `Rango ${c.rango} · ${c.nombre}`;
    case 'grado':
      return `${c.nombre} ${romano(c.grado)}`;
    case 'nivel':
      return `Nivel ${c.nivel}`;
    case 'logro':
      return `Logro · ${c.nombre}`;
    case 'racha':
      return `Racha de ${c.dias} días`;
    case 'piedra':
      return `Piedra de protección · ${c.total}`;
    case 'recuperacion':
      return `+${c.xp} XP recuperados`;
    case 'insignia':
      return `Insignia · ${c.nombre}`;
  }
}

export function romano(n: number): string {
  return n === 3 ? 'III' : n === 2 ? 'II' : 'I';
}

/** Texto del toast de un momento: [principal, ...resumen] con « · ». */
export function textoToast(m: Momento): string {
  return [...(m.principal ? [textoDe(m.principal)] : []), ...m.resumen].join(' · ');
}

export function formaDe(principal: Celebracion | null): FormaMomento {
  if (principal?.tipo === 'rango') return 'ceremonia-epica';
  if (principal?.tipo === 'grado' || principal?.tipo === 'nivel') return 'ceremonia-corta';
  return 'toast';
}

function sinRepetir(xs: string[]): string[] {
  return [...new Set(xs.filter((x) => x.trim().length > 0))];
}

/** Fusión de una llegada sobre lo acumulado de su acción. */
export function fusionar(prev: Acumulado | undefined, a: AccionCelebrable): Acumulado {
  const nuevos = new Map((prev?.logrosNuevos ?? []).map((l) => [l.codigo, l]));
  for (const l of a.logrosNuevos ?? []) if (!nuevos.has(l.codigo)) nuevos.set(l.codigo, l);
  return {
    perfilAntes: prev?.perfilAntes ?? a.perfilAntes,
    perfilDespues: a.perfilDespues ?? prev?.perfilDespues,
    logrosAntes: prev?.logrosAntes ?? (a.logrosAntes ? [...a.logrosAntes] : undefined),
    logrosNuevos: [...nuevos.values()],
    fecha: prev?.fecha ?? a.fecha,
    recuperadoXp: Math.max(prev?.recuperadoXp ?? 0, a.recuperadoXp ?? 0) || undefined,
    extra: [...(prev?.extra ?? []), ...(a.extra ?? [])],
    resumen: [...(prev?.resumen ?? []), ...(a.resumen ?? [])],
    cerrada: false,
  };
}

/** Lo que tocaría enseñar de una acción con las vistas de ahora, o null si nada. */
export function decidir(accion: string | null, ac: Acumulado, vistas: ReadonlySet<string>): Momento | null {
  const antes = ac.perfilAntes ?? ac.perfilDespues ?? CERO;
  const despues = ac.perfilDespues ?? ac.perfilAntes ?? CERO;
  const logrosAntes = ac.logrosAntes ?? [];
  const lista = [
    ...celebrarCambio({
      perfilAntes: antes,
      perfilDespues: despues,
      logrosAntes,
      logrosNuevos: ac.logrosNuevos,
      fecha: ac.fecha ?? '',
      recuperadoXp: ac.recuperadoXp,
    }),
    ...ac.extra,
  ];
  const { principal, resto } = colaDeCelebracion(lista, vistas);
  const resumen = sinRepetir([...ac.resumen, ...resto.map(textoDe)]);
  if (!principal && resumen.length === 0) return null;
  // Un rango que llega en `extra` también cuenta para el «siguiente».
  const rangos = lista.flatMap((c) => (c.tipo === 'rango' ? [codigoRango(c.rango)] : []));
  const estado = ac.perfilDespues
    ? estadoDe(ac.perfilDespues, [...logrosAntes, ...ac.logrosNuevos.map((l) => l.codigo), ...rangos])
    : null;
  return { principal, resumen, clavesResto: resto.map((c) => c.clave), forma: formaDe(principal), accion, estado };
}

function marcarVistas(vistas: Set<string>, m: Momento): Set<string> {
  const claves = [...(m.principal ? [m.principal.clave] : []), ...m.clavesResto];
  if (claves.length === 0) return vistas;
  const orden = [...vistas].filter((k) => !claves.includes(k));
  orden.push(...claves);
  return new Set(orden.slice(-MAX_VISTAS));
}

function mostrar(s: EstadoCola, m: Momento): EstadoCola {
  return { ...s, mostrando: m, vistas: marcarVistas(s.vistas, m) };
}

/** Quita una acción de las abiertas y la guarda en el histórico. */
function archivar(s: EstadoCola, id: string, ac: Acumulado): EstadoCola {
  const acciones = new Map(s.acciones);
  acciones.delete(id);
  const historico = new Map(s.historico);
  historico.delete(id);
  if (!id.startsWith('aviso:')) historico.set(id, ac);
  while (historico.size > MAX_HISTORICO) historico.delete(historico.keys().next().value!);
  return { ...s, acciones, historico };
}

/** Saca de la espera lo siguiente que haya que enseñar, si se puede. */
function avanzar(s: EstadoCola): EstadoCola {
  if (!s.cargado || s.pausa || s.mostrando) return s;
  let st = s;
  while (st.listas.length > 0) {
    const [id, ...resto] = st.listas as [string, ...string[]];
    const ac = st.acciones.get(id);
    st = { ...st, listas: resto };
    if (!ac) continue;
    st = archivar(st, id, ac);
    const m = decidir(id.startsWith('aviso:') ? null : id, ac, st.vistas);
    if (m) return mostrar(st, m);
  }
  return st;
}

/** Cierra la ventana de una acción y la pone en la cola (o absorbe el toast visible). */
function cerrar(s: EstadoCola, accion: string): EstadoCola {
  const ac = s.acciones.get(accion);
  if (!ac || ac.cerrada) return s;
  const acciones = new Map(s.acciones);
  acciones.set(accion, { ...ac, cerrada: true });
  const st: EstadoCola = { ...s, acciones };

  // Absorción: el toast visible es de esta misma acción.
  const vis = st.mostrando;
  if (st.cargado && !st.pausa && vis && vis.forma === 'toast' && vis.accion === accion) {
    const sin = archivar(st, accion, ac);
    const m = decidir(accion, ac, sin.vistas);
    if (!m) return sin;
    if (m.forma === 'toast') {
      // Nunca dos toasts: uno solo con todo, que vuelve a empezar.
      const lineaPrincipal = m.principal ? textoDe(m.principal) : null;
      const previas = [...(vis.principal ? [textoDe(vis.principal)] : []), ...vis.resumen];
      const resumen = sinRepetir([...previas, ...m.resumen]).filter((x) => x !== lineaPrincipal);
      return mostrar({ ...sin, mostrando: null }, { ...m, resumen });
    }
    // La ceremonia se come el toast: su texto pasa al resumen.
    const resumen = sinRepetir([textoToast(vis), ...m.resumen.filter((x) => !vis.resumen.includes(x))]);
    return mostrar({ ...sin, mostrando: null }, { ...m, resumen });
  }

  return avanzar({ ...st, listas: [...st.listas.filter((x) => x !== accion), accion] });
}

export function reducir(s: EstadoCola, e: EventoCola): EstadoCola {
  switch (e.tipo) {
    case 'cargar': {
      const vistas = new Set([...e.vistas, ...s.vistas]);
      return avanzar({ ...s, cargado: true, vistas: new Set([...vistas].slice(-MAX_VISTAS)) });
    }
    case 'vaciar':
      return estadoInicial();
    case 'llega': {
      const { accion } = e.a;
      // Una llegada tras el cierre (el rango tarde por red) reabre la ventana
      // con lo ya sabido: así lleva perfiles y logros de antes.
      const prev = s.acciones.get(accion) ?? s.historico.get(accion);
      const acciones = new Map(s.acciones);
      acciones.set(accion, fusionar(prev, e.a));
      const listas = s.listas.filter((x) => x !== accion);
      const st = { ...s, acciones, listas };
      return e.a.final ? cerrar(st, accion) : st;
    }
    case 'cerrar':
      return cerrar(s, e.accion);
    case 'avisar': {
      const acciones = new Map(s.acciones);
      acciones.set(e.id, { logrosNuevos: [], extra: [], resumen: [e.texto], cerrada: true });
      return avanzar({ ...s, acciones, listas: [...s.listas, e.id] });
    }
    case 'ocultar':
      return avanzar({ ...s, mostrando: null });
    case 'pausar':
      return avanzar({ ...s, pausa: e.pausa });
  }
}

/** Hay algo visible, esperando turno o con la ventana abierta. */
export function hayAlgo(s: EstadoCola): boolean {
  return s.mostrando !== null || s.listas.length > 0 || [...s.acciones.values()].some((a) => !a.cerrada);
}
