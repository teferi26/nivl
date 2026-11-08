// NIVL · WORK: lo que el coach recibe ya calculado (qué atacar, qué soltar, cuánta carga).
//
// ESPEJO de src/work/{fechas,prioridades,proyectos,carga,ahora}.ts: el empaquetado de la Edge Function no
// sube nada de fuera de supabase/, así que las fórmulas están duplicadas a propósito. La fuente de verdad
// es la app. SI TOCAS UNA, TOCA LA OTRA. Las dos pasan la misma tabla: trabajo_paridad.json, leída aquí por
// trabajo_test.ts y allí por src/work/__tests__/coach-paridad.test.ts.
//
// Regla de oro de AGENTS.md: los números son deterministas y la IA solo decide qué decir con ellos. Esto
// funciona igual sin IA en la app; aquí solo se le entrega el mismo resultado al coach.
//
// Va SOLO en modo work y en la parte rápida del estado (sección «## Trabajo ahora», ver SECCIONES_RAPIDAS
// en prompt.ts): cambia a cada rato, lleva la hora y no puede invalidar lo cacheado. Los demás modos no
// pasan por aquí.

import type { Db } from './db.ts';

// ── Constantes (espejo de src/work/tipos.ts) ─────────────────────────
const MIN_MINUTOS_MISION = 25;
const MINUTOS_BLOQUE_DEFECTO = 50;
const DURACION_EVENTO_DEFECTO = 45;
const FIN_JORNADA_MIN = 19 * 60;
const HORA_TARDE_MIN = 20 * 60;
const MAX_PRIORIDADES = 3;

// ── Tipos (espejo de src/work/tipos.ts) ──────────────────────────────
export type CodigoMotivoAhora =
  | 'bloque_en_curso'
  | 'bloque_pausado'
  | 'reunion_en_curso'
  | 'reunion_cerca'
  | 'plan_ahora'
  | 'hueco_corto'
  | 'prioridad_primera'
  | 'prioridad_siguiente'
  | 'mision_fija'
  | 'fuera_de_jornada'
  | 'entrega_atrasada'
  | 'entrega_hoy'
  | 'entrega_cerca'
  | 'planificar'
  | 'recuperar'
  | 'dia_cerrado'
  | 'soltar_no_cabe'
  | 'soltar_carga';

export interface Motivo {
  codigo: CodigoMotivoAhora;
  vars?: Record<string, string | number>;
}

export interface MisionTrabajo {
  id: string;
  titulo: string;
  hecha: boolean;
  penalizacion: boolean;
  xp: number;
  diaPrioridad: string | null;
  rango: number | null;
  creadaEn: string | null;
}

export interface BloquePlan {
  id: string;
  inicio: number;
  fin: number;
  titulo: string;
  tipo: string;
  hecho: boolean;
  questId: string | null;
}

export interface EventoTrabajo {
  id: string;
  titulo: string;
  fecha: string;
  inicio: number | null;
  fin: number | null;
  origen: 'manual' | 'dispositivo';
}

export interface Entrega {
  id: string;
  proyectoId: string | null;
  titulo: string;
  fecha: string | null;
  hecha: boolean;
  hechaEl: string | null;
  posicion: number;
}

export interface SesionTrabajo {
  fecha: string;
  inicioMin: number | null;
  minutos: number;
  tipo: 'bloque' | 'manual';
}

// ── Fechas (espejo de src/work/fechas.ts) ────────────────────────────
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA = 86_400_000;

function aUtc(s: string): number {
  const m = RE_FECHA.exec(s);
  if (!m) throw new Error(`Fecha inválida: ${s}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function deUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function sumarDias(fecha: string, n: number): string {
  return deUtc(aUtc(fecha) + n * DIA);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemana(fecha: string): number {
  const d = new Date(aUtc(fecha)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function esFinDeSemana(fecha: string): boolean {
  return diaSemana(fecha) >= 6;
}

export function horaAMin(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

export function minAHora(min: number): string {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ── Prioridades (espejo de src/work/prioridades.ts) ──────────────────
export function ordenarPrioridades<T extends MisionTrabajo>(misiones: readonly T[], hoy: string): T[] {
  const deHoy = (m: T) => (m.diaPrioridad === hoy ? 0 : 1);
  return [...misiones].sort(
    (a, b) =>
      Number(a.hecha) - Number(b.hecha) ||
      deHoy(a) - deHoy(b) ||
      (a.rango ?? 99) - (b.rango ?? 99) ||
      b.xp - a.xp ||
      (a.creadaEn ?? '').localeCompare(b.creadaEn ?? '') ||
      a.id.localeCompare(b.id),
  );
}

export function pendientes<T extends MisionTrabajo>(misiones: readonly T[], hoy: string): T[] {
  return ordenarPrioridades(
    misiones.filter((m) => !m.hecha && !m.penalizacion),
    hoy,
  );
}

// ── Entregas (espejo de src/work/proyectos.ts) ───────────────────────
export type RiesgoEntrega = 'hecha' | 'atrasada' | 'hoy' | 'en_riesgo' | 'a_tiempo' | 'sin_fecha';

export const DIAS_APRIETA = 2;
export const DIAS_SIN_TOCAR = 7;

export function riesgoEntrega(e: Pick<Entrega, 'fecha' | 'hecha'>, hoy: string, minutosRecientes = 0): RiesgoEntrega {
  if (e.hecha) return 'hecha';
  if (!e.fecha) return 'sin_fecha';
  const dias = diasEntre(hoy, e.fecha);
  if (dias < 0) return 'atrasada';
  if (dias === 0) return 'hoy';
  if (dias <= DIAS_APRIETA) return 'en_riesgo';
  if (dias <= DIAS_SIN_TOCAR && minutosRecientes === 0) return 'en_riesgo';
  return 'a_tiempo';
}

// ── Carga (espejo de src/work/carga.ts) ──────────────────────────────
export type NivelCarga = 'ligera' | 'normal' | 'alta';
export type CodigoSenal = 'reuniones_hoy' | 'reuniones_semana' | 'horas_semana' | 'tardes' | 'fin_de_semana' | 'dias_seguidos';

export interface SenalCarga {
  codigo: CodigoSenal;
  valor: number;
}

export const UMBRAL = {
  reunionesHoyMin: [180, 300],
  reunionesSemanaMin: [720, 1080],
  horasSemanaMin: [2700, 3300],
  diasTarde: [3, 5],
  diasSeguidos: [7, 10],
} as const;

export const PUNTOS_ALTA = 3;

export interface EntradaCarga {
  fecha: string;
  eventos: readonly EventoTrabajo[];
  sesiones: readonly SesionTrabajo[];
  horaTardeMin?: number;
}

export interface Carga {
  nivel: NivelCarga;
  puntos: number;
  reunionesHoyMin: number;
  reunionesSemanaMin: number;
  profundoHoyMin: number;
  profundoSemanaMin: number;
  trabajoSemanaMin: number;
  diasTarde: number;
  diasFinDeSemana: number;
  diasSeguidos: number;
  senales: SenalCarga[];
  soltar: CodigoSenal | null;
}

export function finEvento(e: Pick<EventoTrabajo, 'inicio' | 'fin'>): number | null {
  if (e.inicio === null) return null;
  if (e.fin === null) return Math.min(1440, e.inicio + DURACION_EVENTO_DEFECTO);
  return e.fin > e.inicio ? e.fin : 1440;
}

export function minutosOcupados(eventos: readonly Pick<EventoTrabajo, 'inicio' | 'fin'>[]): number {
  const tramos = eventos
    .map((e) => [e.inicio, finEvento(e)] as const)
    .filter((t): t is readonly [number, number] => t[0] !== null && t[1] !== null)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let hasta = -1;
  for (const [a, b] of tramos) {
    if (a >= hasta) {
      total += b - a;
      hasta = b;
    } else if (b > hasta) {
      total += b - hasta;
      hasta = b;
    }
  }
  return total;
}

const nivelDe = (v: number, [uno, dos]: readonly [number, number]) => (v >= dos ? 2 : v >= uno ? 1 : 0);

export function calcularCarga(e: EntradaCarga): Carga {
  const desde = sumarDias(e.fecha, -6);
  const tarde = e.horaTardeMin ?? HORA_TARDE_MIN;
  const sesiones = e.sesiones.filter((s) => s.fecha >= desde && s.fecha <= e.fecha && s.minutos > 0);

  const laborables = e.eventos.filter((x) => x.fecha >= desde && x.fecha <= e.fecha && !esFinDeSemana(x.fecha));
  const fechas = [...new Set(laborables.map((x) => x.fecha))];
  const reunionesSemanaMin = fechas.reduce((a, f) => a + minutosOcupados(laborables.filter((x) => x.fecha === f)), 0);
  const reunionesHoyMin = esFinDeSemana(e.fecha) ? 0 : minutosOcupados(laborables.filter((x) => x.fecha === e.fecha));

  const trabajoSemanaMin = sesiones.reduce((a, s) => a + s.minutos, 0);
  const profundo = sesiones.filter((s) => s.tipo === 'bloque');
  const profundoSemanaMin = profundo.reduce((a, s) => a + s.minutos, 0);
  const profundoHoyMin = profundo.filter((s) => s.fecha === e.fecha).reduce((a, s) => a + s.minutos, 0);

  const diasTarde = new Set(sesiones.filter((s) => s.inicioMin !== null && s.inicioMin + s.minutos > tarde).map((s) => s.fecha)).size;
  const conTrabajo = new Set(sesiones.map((s) => s.fecha));
  const diasFinDeSemana = [...conTrabajo].filter(esFinDeSemana).length;

  // Hacia atrás desde hoy (o desde ayer si hoy aún no hay nada): hoy sin
  // trabajar todavía no rompe la serie, no es descanso.
  const todas = new Set(e.sesiones.filter((s) => s.minutos > 0).map((s) => s.fecha));
  let f = todas.has(e.fecha) ? e.fecha : sumarDias(e.fecha, -1);
  let diasSeguidos = 0;
  while (todas.has(f) && diasSeguidos < 60) {
    diasSeguidos++;
    f = sumarDias(f, -1);
  }

  const lecturas: { codigo: CodigoSenal; valor: number; puntos: number }[] = [
    { codigo: 'reuniones_hoy', valor: reunionesHoyMin, puntos: nivelDe(reunionesHoyMin, UMBRAL.reunionesHoyMin) },
    { codigo: 'dias_seguidos', valor: diasSeguidos, puntos: nivelDe(diasSeguidos, UMBRAL.diasSeguidos) },
    { codigo: 'tardes', valor: diasTarde, puntos: nivelDe(diasTarde, UMBRAL.diasTarde) },
    { codigo: 'horas_semana', valor: trabajoSemanaMin, puntos: nivelDe(trabajoSemanaMin, UMBRAL.horasSemanaMin) },
    { codigo: 'reuniones_semana', valor: reunionesSemanaMin, puntos: nivelDe(reunionesSemanaMin, UMBRAL.reunionesSemanaMin) },
    { codigo: 'fin_de_semana', valor: diasFinDeSemana, puntos: diasFinDeSemana > 0 ? 1 : 0 },
  ];
  const activas = lecturas.filter((l) => l.puntos > 0).sort((a, b) => b.puntos - a.puntos);
  const puntos = activas.reduce((a, l) => a + l.puntos, 0);
  const nivel: NivelCarga = puntos >= PUNTOS_ALTA ? 'alta' : puntos > 0 ? 'normal' : 'ligera';

  return {
    nivel,
    puntos,
    reunionesHoyMin,
    reunionesSemanaMin,
    profundoHoyMin,
    profundoSemanaMin,
    trabajoSemanaMin,
    diasTarde,
    diasFinDeSemana,
    diasSeguidos,
    senales: activas.map(({ codigo, valor }) => ({ codigo, valor })),
    soltar: nivel === 'alta' ? (activas[0]?.codigo ?? null) : null,
  };
}

// ── Ahora (espejo de src/work/ahora.ts) ──────────────────────────────
export const AVISO_REUNION_MIN = 15;
export const TIPOS_BLOQUE_TRABAJO: readonly string[] = ['deep_work', 'ventas', 'contenido'];
const TIPOS_LIBRES: readonly string[] = ['libre', 'deep_work', 'ventas', 'contenido', 'redes'];
const MAX_SOLTAR = 3;

export type TipoAhora = 'bloque' | 'reunion' | 'plan' | 'hueco' | 'mision' | 'entrega' | 'planificar' | 'recuperar' | 'cerrado';
export type AccionAhora = 'seguir_bloque' | 'empezar_bloque' | 'planificar' | 'ninguna';

export interface BloqueEnCurso {
  titulo: string | null;
  questId: string | null;
  fase: 'corriendo' | 'pausado';
  restanteMin: number;
}

export interface Soltable {
  tipo: 'mision';
  id: string;
  titulo: string;
  motivo: Motivo;
  sinCoste: boolean;
}

export interface Ahora {
  tipo: TipoAhora;
  titulo: string | null;
  motivo: Motivo;
  accion: AccionAhora;
  questId: string | null;
  entregaId: string | null;
  /** El bloque del plan que se ataca; null si no sale del plan. */
  bloquePlanId: string | null;
  minutosSugeridos: number | null;
  hastaMin: number | null;
  soltar: Soltable[];
}

export interface EntradaAhora {
  fecha: string;
  ahoraMin: number;
  misiones: readonly MisionTrabajo[];
  plan: readonly BloquePlan[];
  eventos: readonly EventoTrabajo[];
  entregas: readonly Entrega[];
  bloque?: BloqueEnCurso | null;
  nivelCarga?: NivelCarga;
  finJornadaMin?: number;
}

export function esfuerzoMin(xp: number): number {
  if (xp <= 10) return 15;
  if (xp <= 25) return 25;
  if (xp <= 50) return MINUTOS_BLOQUE_DEFECTO;
  if (xp <= 100) return 90;
  return 180;
}

interface Tramo {
  inicio: number;
  fin: number;
}

function ocupaciones(e: EntradaAhora): Tramo[] {
  const deEventos = e.eventos
    .filter((x) => x.fecha === e.fecha && x.inicio !== null)
    .map((x) => ({ inicio: x.inicio as number, fin: finEvento(x) as number }));
  const dePlan = e.plan.filter((b) => !TIPOS_LIBRES.includes(b.tipo) && !b.hecho && b.fin > b.inicio).map((b) => ({ inicio: b.inicio, fin: b.fin }));
  return [...deEventos, ...dePlan].sort((a, b) => a.inicio - b.inicio);
}

export function minutosLibres(tramos: readonly Tramo[], desde: number, hasta: number): number {
  if (hasta <= desde) return 0;
  let libre = 0;
  let cursor = desde;
  for (const t of tramos) {
    if (t.fin <= cursor) continue;
    if (t.inicio >= hasta) break;
    if (t.inicio > cursor) libre += t.inicio - cursor;
    cursor = Math.max(cursor, Math.min(t.fin, hasta));
    if (cursor >= hasta) break;
  }
  return libre + Math.max(0, hasta - cursor);
}

export function queSoltar(e: EntradaAhora, tramos: readonly Tramo[]): Soltable[] {
  const lista = pendientes(e.misiones, e.fecha);
  if (lista.length < 2) return [];
  const fin = e.finJornadaMin ?? FIN_JORNADA_MIN;
  let queda = minutosLibres(tramos, e.ahoraMin, Math.max(fin, e.ahoraMin));
  const noCaben: MisionTrabajo[] = [];
  lista.forEach((m, i) => {
    const coste = esfuerzoMin(m.xp);
    if (i > 0 && coste > queda) noCaben.push(m);
    else queda -= coste;
  });
  const fila = (m: MisionTrabajo, codigo: 'soltar_no_cabe' | 'soltar_carga'): Soltable => ({
    tipo: 'mision',
    id: m.id,
    titulo: m.titulo,
    motivo: { codigo },
    sinCoste: m.diaPrioridad === e.fecha,
  });
  if (noCaben.length) return noCaben.reverse().slice(0, MAX_SOLTAR).map((m) => fila(m, 'soltar_no_cabe'));
  if (e.nivelCarga === 'alta') return [fila(lista[lista.length - 1]!, 'soltar_carga')];
  return [];
}

export function elegirAhora(e: EntradaAhora): Ahora {
  const tramos = ocupaciones(e);
  const soltar = queSoltar(e, tramos);
  const base = { questId: null, entregaId: null, bloquePlanId: null, minutosSugeridos: null, hastaMin: null, soltar };

  if (e.bloque) {
    return {
      ...base,
      tipo: 'bloque',
      titulo: e.bloque.titulo,
      motivo: { codigo: e.bloque.fase === 'pausado' ? 'bloque_pausado' : 'bloque_en_curso', vars: { minutos: e.bloque.restanteMin } },
      accion: 'seguir_bloque',
      questId: e.bloque.questId,
    };
  }

  const eventosHoy = e.eventos
    .filter((x) => x.fecha === e.fecha && x.inicio !== null)
    .sort((a, b) => (a.inicio as number) - (b.inicio as number));
  const enCurso = eventosHoy.find((x) => (x.inicio as number) <= e.ahoraMin && e.ahoraMin < (finEvento(x) as number));
  if (enCurso) {
    const hasta = finEvento(enCurso) as number;
    return { ...base, tipo: 'reunion', titulo: enCurso.titulo, motivo: { codigo: 'reunion_en_curso', vars: { minutos: hasta - e.ahoraMin } }, accion: 'ninguna', hastaMin: hasta };
  }
  const proxima = eventosHoy.find((x) => (x.inicio as number) > e.ahoraMin);
  const aReunion = proxima ? (proxima.inicio as number) - e.ahoraMin : null;
  if (proxima && aReunion !== null && aReunion <= AVISO_REUNION_MIN) {
    return { ...base, tipo: 'reunion', titulo: proxima.titulo, motivo: { codigo: 'reunion_cerca', vars: { minutos: aReunion } }, accion: 'ninguna', hastaMin: proxima.inicio };
  }

  const lista = pendientes(e.misiones, e.fecha);
  const delPlan = e.plan.find((b) => !b.hecho && TIPOS_BLOQUE_TRABAJO.includes(b.tipo) && b.inicio <= e.ahoraMin && e.ahoraMin < b.fin);
  const siguiente = tramos.find((t) => t.inicio > e.ahoraMin)?.inicio ?? null;
  const hueco = siguiente === null ? null : siguiente - e.ahoraMin;
  const cabe = (min: number) => (hueco === null ? min : Math.min(min, hueco));

  if (delPlan && cabe(delPlan.fin - e.ahoraMin) >= MIN_MINUTOS_MISION) {
    // Sin misión propia, el bloque ataca la primera pendiente, y la tarjeta dice cuál: lo que paga se ve.
    const mision = delPlan.questId ? lista.find((m) => m.id === delPlan.questId) : lista[0];
    return {
      ...base,
      tipo: 'plan',
      titulo: delPlan.questId ? delPlan.titulo : (mision?.titulo ?? delPlan.titulo),
      motivo: { codigo: 'plan_ahora', vars: { hasta: minAHora(delPlan.fin) } },
      accion: 'empezar_bloque',
      questId: mision?.id ?? null,
      bloquePlanId: delPlan.id,
      minutosSugeridos: cabe(delPlan.fin - e.ahoraMin),
      hastaMin: delPlan.fin,
    };
  }

  const primera = lista[0];
  if (primera && hueco !== null && hueco < MIN_MINUTOS_MISION) {
    return { ...base, tipo: 'hueco', titulo: primera.titulo, motivo: { codigo: 'hueco_corto', vars: { minutos: hueco } }, accion: 'ninguna', questId: primera.id, hastaMin: siguiente };
  }

  const fin = e.finJornadaMin ?? FIN_JORNADA_MIN;
  if (primera) {
    const hechasHoy = e.misiones.some((m) => m.hecha && !m.penalizacion);
    const codigo =
      e.ahoraMin >= fin ? 'fuera_de_jornada' : primera.diaPrioridad !== e.fecha ? 'mision_fija' : hechasHoy ? 'prioridad_siguiente' : 'prioridad_primera';
    return {
      ...base,
      tipo: 'mision',
      titulo: primera.titulo,
      motivo: { codigo, vars: { restantes: lista.length - 1 } },
      accion: 'empezar_bloque',
      questId: primera.id,
      minutosSugeridos: cabe(Math.max(MIN_MINUTOS_MISION, esfuerzoMin(primera.xp))),
      hastaMin: siguiente,
    };
  }

  const entrega = e.entregas
    .filter((x) => !x.hecha && x.fecha !== null)
    .map((x) => ({ x, r: riesgoEntrega(x, e.fecha) }))
    .filter(({ r, x }) => r === 'atrasada' || r === 'hoy' || (r === 'en_riesgo' && x.fecha! <= sumarDias(e.fecha, DIAS_APRIETA)))
    .sort((a, b) => a.x.fecha!.localeCompare(b.x.fecha!) || a.x.posicion - b.x.posicion)[0];
  if (entrega) {
    return {
      ...base,
      tipo: 'entrega',
      titulo: entrega.x.titulo,
      motivo: { codigo: entrega.r === 'atrasada' ? 'entrega_atrasada' : entrega.r === 'hoy' ? 'entrega_hoy' : 'entrega_cerca' },
      accion: 'empezar_bloque',
      entregaId: entrega.x.id,
      minutosSugeridos: cabe(MINUTOS_BLOQUE_DEFECTO),
      hastaMin: siguiente,
    };
  }

  const huboAlgoHoy = e.misiones.some((m) => !m.penalizacion);
  const pena = e.misiones.find((m) => m.penalizacion && !m.hecha);
  if (huboAlgoHoy && pena) return { ...base, tipo: 'recuperar', titulo: pena.titulo, motivo: { codigo: 'recuperar' }, accion: 'ninguna', questId: pena.id };
  if (huboAlgoHoy) return { ...base, tipo: 'cerrado', titulo: null, motivo: { codigo: 'dia_cerrado' }, accion: 'ninguna' };
  return { ...base, tipo: 'planificar', titulo: null, motivo: { codigo: 'planificar' }, accion: 'planificar' };
}

// ── El texto para el coach (solo este lado) ──────────────────────────
//
// Cifras y hechos, sin diagnóstico: el modelo tiende a imitar lo que lee.

const TOPE_TITULO = 120;
const MAX_ENTREGAS = 5;
const MAX_REUNIONES = 5;

/**
 * Un título en una línea. Importa: partirEstado corta por líneas que empiezan por «## », y un título de un
 * evento importado del calendario lo escribe un tercero. Si llevase un salto de línea podría colar una
 * sección falsa.
 */
export function enLinea(v: unknown, tope = TOPE_TITULO): string {
  return String(v ?? '')
    .replace(/<\/?\s*datos_del_gladiador\s*>/gi, '')
    .replace(/[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/gi, '[correo]')
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, tope);
}

function textoMotivo(m: Motivo): string {
  const v = m.vars ?? {};
  switch (m.codigo) {
    case 'bloque_en_curso': return `tiene un bloque en marcha, le quedan ${v.minutos} min`;
    case 'bloque_pausado': return `tiene un bloque en pausa, le quedan ${v.minutos} min`;
    case 'reunion_en_curso': return `está en esta reunión, acaba en ${v.minutos} min`;
    case 'reunion_cerca': return `empieza en ${v.minutos} min: que no abra nada nuevo`;
    case 'plan_ahora': return `es lo que tenía planificado ahora, hasta las ${v.hasta}`;
    case 'hueco_corto': return `solo tiene ${v.minutos} min antes de lo siguiente: que cierre algo pequeño`;
    case 'prioridad_primera': return `es la primera que escribió para hoy (quedan ${v.restantes} más)`;
    case 'prioridad_siguiente': return `es la siguiente de su lista (quedan ${v.restantes} más)`;
    case 'mision_fija': return `es una misión fija que toca hoy (quedan ${v.restantes} más)`;
    case 'fuera_de_jornada': return 'ya pasó su fin de jornada: si no cabe hoy, se suelta';
    case 'entrega_atrasada': return 'esta entrega ya ha pasado de fecha';
    case 'entrega_hoy': return 'esta entrega vence hoy';
    case 'entrega_cerca': return 'esta entrega vence en pocos días';
    case 'planificar': return 'no hay nada planificado';
    case 'recuperar': return 'lo de hoy está hecho y aún puede recuperar lo perdido ayer completándola hoy';
    case 'dia_cerrado': return 'lo de hoy está hecho';
    case 'soltar_no_cabe': return 'no cabe hoy en lo que queda de jornada';
    case 'soltar_carga': return 'la semana va llena y esto puede esperar';
  }
}

const SENAL: Record<CodigoSenal, (v: number) => string> = {
  reuniones_hoy: (v) => `${horas(v)} de reuniones hoy`,
  reuniones_semana: (v) => `${horas(v)} de reuniones en 7 días`,
  horas_semana: (v) => `${horas(v)} registradas en 7 días`,
  tardes: (v) => `${v} días trabajando tarde`,
  fin_de_semana: (v) => `${v} días de fin de semana con trabajo`,
  dias_seguidos: (v) => `${v} días seguidos trabajando`,
};

// Espejo de trabajogestion:carga.soltar (es) de la app.
const SOLTAR_CARGA: Record<CodigoSenal, string> = {
  reuniones_hoy: 'mover o declinar una reunión de hoy',
  reuniones_semana: 'dejar una reunión fija fuera de la próxima semana',
  horas_semana: 'dejar una entrega para la semana que viene',
  tardes: 'cortar hoy a su hora; lo que quede, mañana',
  fin_de_semana: 'dejar el próximo fin de semana sin trabajo',
  dias_seguidos: 'elegir un día de esta semana sin trabajo',
};

function horas(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function lineaAtacar(a: Ahora): string {
  const motivo = textoMotivo(a.motivo);
  if (a.tipo === 'planificar') {
    return `ATACAR YA: nada todavía, ${motivo}. Pregúntale qué tiene que sacar hoy (tres cosas como mucho) y que las escriba en Hoy, en la tarjeta Ahora.`;
  }
  if (a.tipo === 'cerrado') return `ATACAR YA: nada, ${motivo}. No le busques más trabajo.`;
  const partes = [`ATACAR YA: "${enLinea(a.titulo)}"${a.questId ? ` [${a.questId}]` : ''}, ${motivo}.`];
  if (a.accion === 'empezar_bloque' && a.minutosSugeridos !== null) partes.push(`Bloque sugerido: ${a.minutosSugeridos} min.`);
  if (a.hastaMin !== null) partes.push(`Hasta las ${minAHora(a.hastaMin)}.`);
  return partes.join(' ');
}

function lineasSoltar(a: Ahora): string[] {
  if (!a.soltar.length) return ['SOLTAR HOY: nada.'];
  return [
    'SOLTAR HOY:',
    ...a.soltar.map((s) => `- "${enLinea(s.titulo)}" [${s.id}], ${textoMotivo(s.motivo)}, ${s.sinCoste ? 'sin coste si se quita hoy' : 'es una misión fija: no se quita por un día'}`),
  ];
}

const RIESGO_TEXTO: Partial<Record<RiesgoEntrega, string>> = { atrasada: 'atrasada', hoy: 'vence hoy', en_riesgo: 'en riesgo' };

export interface EntradaEstudio extends EntradaAhora {
  sesiones: readonly SesionTrabajo[];
}

/** El bloque de texto. Puro: mismo dato, mismos bytes. */
export function estudioTrabajo(e: EntradaEstudio): string {
  const carga = calcularCarga({ fecha: e.fecha, eventos: e.eventos, sesiones: e.sesiones });
  const ahora = elegirAhora({ ...e, nivelCarga: carga.nivel });
  const lineas: string[] = [
    '## Trabajo ahora (modo WORK, ya calculado: no lo recalcules)',
    `Hora local: ${minAHora(e.ahoraMin)}. No ves si tiene un bloque en marcha en el móvil: si te lo dice, no se lo interrumpas.`,
    lineaAtacar(ahora),
    ...lineasSoltar(ahora),
  ];

  const normales = e.misiones.filter((m) => !m.penalizacion);
  if (normales.length) {
    const orden = ordenarPrioridades(normales, e.fecha);
    lineas.push(`MISIONES DE WORK HOY (${normales.filter((m) => m.hecha).length} de ${normales.length} hechas):`);
    for (const m of orden.slice(0, MAX_PRIORIDADES)) lineas.push(`- ${m.hecha ? '[HECHA] ' : ''}"${enLinea(m.titulo)}" [${m.id}]`);
    if (orden.length > MAX_PRIORIDADES) lineas.push(`- y ${orden.length - MAX_PRIORIDADES} más. Con más de tres en el día, sobra alguna.`);
  }

  const reuniones = e.eventos
    .filter((x) => x.fecha === e.fecha && x.inicio !== null && (finEvento(x) as number) > e.ahoraMin)
    .sort((a, b) => (a.inicio as number) - (b.inicio as number))
    .slice(0, MAX_REUNIONES);
  if (reuniones.length) {
    lineas.push('LO QUE QUEDA HOY EN LA AGENDA:');
    for (const x of reuniones) lineas.push(`- ${minAHora(x.inicio as number)}-${minAHora(finEvento(x) as number)} "${enLinea(x.titulo)}"`);
  }

  const aprietan = e.entregas
    .filter((x) => !x.hecha && x.fecha !== null)
    .map((x) => ({ x, r: riesgoEntrega(x, e.fecha) }))
    .filter(({ r }) => RIESGO_TEXTO[r] !== undefined)
    .sort((a, b) => a.x.fecha!.localeCompare(b.x.fecha!) || a.x.posicion - b.x.posicion)
    .slice(0, MAX_ENTREGAS);
  if (aprietan.length) {
    lineas.push('ENTREGAS QUE APRIETAN:');
    for (const { x, r } of aprietan) lineas.push(`- "${enLinea(x.titulo)}", ${x.fecha}, ${RIESGO_TEXTO[r]}`);
  }

  lineas.push(
    `CARGA: ${carga.nivel}. En 7 días: ${horas(carga.reunionesSemanaMin)} de agenda entre semana, ${horas(carga.trabajoSemanaMin)} registradas, ${horas(carga.profundoSemanaMin)} en bloques. Hoy: ${horas(carga.reunionesHoyMin)} de agenda, ${horas(carga.profundoHoyMin)} en bloques.`,
  );
  if (carga.senales.length) lineas.push(`Señales: ${carga.senales.map((s) => SENAL[s.codigo](s.valor)).join(', ')}.`);
  if (carga.soltar) lineas.push(`Para aligerar, lo primero: ${SOLTAR_CARGA[carga.soltar]}.`);

  return lineas.join('\n');
}

// ── De las filas a la entrada (efectos, solo lectura y con el cliente del usuario) ─────

/** Minutos desde medianoche en la zona del perfil; con una zona inválida o sin ella, Madrid. */
export function minutosEnZona(ahora: Date, zona: string | null | undefined): number {
  const formatear = (tz: string) => {
    const partes = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora);
    const valor = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
    return valor('hour') * 60 + valor('minute');
  };
  try {
    return formatear(zona || 'Europe/Madrid');
  } catch {
    return formatear('Europe/Madrid');
  }
}

// Espejo de XP_BY_DIFFICULTY (src/lib/game.ts), solo para estimar el esfuerzo igual que Hoy.
const XP_BASE: Record<string, number> = { trivial: 10, facil: 25, media: 50, dificil: 100, epica: 250 };

interface FilaMision {
  id: string;
  title: string;
  difficulty?: string;
  days_of_week?: number[] | null;
  active?: boolean;
  is_penalty?: boolean;
  penalty_date?: string | null;
  acquired_at?: string | null;
  modes?: unknown;
  work_day?: string | null;
  work_rank?: number | null;
  created_at?: string | null;
}

/** Espejo de questsScheduledOn (closing.ts) + misionEnModo (modos/tipos.ts), para el modo work. */
export function misionesDeHoy(filas: readonly FilaMision[], hechas: ReadonlySet<string>, hoy: string): MisionTrabajo[] {
  const dia = diaSemana(hoy);
  return filas
    .filter((q) => {
      if (q.active === false) return false;
      if (q.is_penalty) return q.penalty_date === hoy;
      if (q.acquired_at) return false;
      if (q.work_day && q.work_day.slice(0, 10) !== hoy) return false;
      return (q.days_of_week ?? []).includes(dia) && Array.isArray(q.modes) && q.modes.includes('work');
    })
    .map((q) => ({
      id: q.id,
      titulo: q.title,
      hecha: hechas.has(q.id),
      penalizacion: q.is_penalty === true,
      xp: XP_BASE[q.difficulty ?? ''] ?? 0,
      diaPrioridad: q.work_day ?? null,
      rango: q.work_rank ?? null,
      creadaEn: q.created_at ?? null,
    }));
}

// Sin la 0115 o la 0116 aplicadas la tabla o la columna no existen: se trata como vacío, igual que la app.
function filas<T>(r: { data: unknown; error: unknown }): T[] {
  return r.error || !Array.isArray(r.data) ? [] : (r.data as T[]);
}

/**
 * El estudio de WORK, listo para el estado. Si algo falla, cadena vacía: el turno no se cae por esto. Todo
 * con el cliente del USUARIO: RLS manda. Ningún dato de dinero entra aquí a propósito: el estudio económico
 * ya viaja aparte y las horas facturables no le aportan nada a «qué atacar ahora».
 */
export async function construirEstudioTrabajo(sb: Db, userId: string, today: string, zona: string | null | undefined, ahora = new Date()): Promise<string> {
  try {
    const desdeAgenda = sumarDias(today, -6);
    const [questsRes, hechasRes, planRes, entregasRes, sesionesRes] = await Promise.all([
      sb.from('quests').select('*').eq('user_id', userId).eq('active', true),
      sb.from('completions').select('quest_id').eq('user_id', userId).eq('date', today),
      sb.from('day_plans').select('id').eq('user_id', userId).eq('date', today).maybeSingle(),
      sb.from('work_deliverables').select('id,project_id,title,due_date,done,done_on,position').eq('user_id', userId).eq('done', false).limit(100),
      sb.from('work_sessions').select('session_date,start_min,minutes,kind').eq('user_id', userId).gte('session_date', sumarDias(today, -60)).limit(1000),
    ]);
    if (questsRes.error) return '';

    // Con la 0116 trae hora de fin; sin ella, la lectura de siempre.
    let agendaRes: { data: unknown; error: unknown } = await sb.from('calendar_events').select('id,title,date,time,end_time,source').eq('user_id', userId).gte('date', desdeAgenda).lte('date', today).limit(300);
    if (agendaRes.error) agendaRes = await sb.from('calendar_events').select('id,title,date,time').eq('user_id', userId).gte('date', desdeAgenda).lte('date', today).limit(300);

    const planId = (planRes.data as { id?: string } | null)?.id;
    const bloquesRes = planId
      ? await sb.from('day_blocks').select('id,start_min,end_min,title,kind,done,quest_id').eq('plan_id', planId).order('position')
      : { data: [], error: null };

    const hechas = new Set(filas<{ quest_id: string }>(hechasRes).map((c) => c.quest_id));
    return estudioTrabajo({
      fecha: today,
      ahoraMin: minutosEnZona(ahora, zona),
      misiones: misionesDeHoy(filas<FilaMision>(questsRes), hechas, today),
      plan: filas<Record<string, any>>(bloquesRes).map((b) => ({
        id: String(b.id),
        inicio: Number(b.start_min),
        fin: Number(b.end_min),
        titulo: String(b.title ?? ''),
        tipo: String(b.kind ?? ''),
        hecho: b.done === true,
        questId: b.quest_id ?? null,
      })),
      eventos: filas<Record<string, any>>(agendaRes).map((x) => ({
        id: String(x.id),
        titulo: String(x.title ?? ''),
        fecha: String(x.date ?? '').slice(0, 10),
        inicio: horaAMin(x.time),
        fin: horaAMin(x.end_time),
        origen: x.source === 'dispositivo' ? 'dispositivo' as const : 'manual' as const,
      })),
      entregas: filas<Record<string, any>>(entregasRes).map((x) => ({
        id: String(x.id),
        proyectoId: x.project_id ?? null,
        titulo: String(x.title ?? ''),
        fecha: x.due_date ?? null,
        hecha: x.done === true,
        hechaEl: x.done_on ?? null,
        posicion: Number(x.position) || 0,
      })),
      sesiones: filas<Record<string, any>>(sesionesRes).map((s) => ({
        fecha: String(s.session_date ?? ''),
        inicioMin: s.start_min ?? null,
        minutos: Number(s.minutes) || 0,
        tipo: s.kind === 'bloque' ? 'bloque' as const : 'manual' as const,
      })),
    });
  } catch {
    return '';
  }
}
