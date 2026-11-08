// NIVL · FOCUS: el plan de estudio (puro, con tests).
//
// El CICLO es la clave:
//   · `pendiente` = por estudiar. `repasando` y `dominado` = ya visto: NUNCA
//     vuelve a «estudiar»; vuelve solo cuando vence su repaso (repaso.ts es el
//     ÚNICO calendario de repasos).
//   · Cada día hay una CAPACIDAD (`minutosDia`, o lo que quede hasta las 22:30
//     si es menos). Se llena en este orden: entregas que vencen en 2 días o
//     menos, repasos vencidos (con tope del 40 % del día), simulacro si es la
//     víspera, y el resto por prioridad = urgencia × peso × lo que falta.
//   · Lo que no cabe va a `fuera` y se avisa: no se amontona ni pasa de medianoche.
//   · Un examen sin fecha o con fecha estimada avanza en orden de temario al
//     ritmo de la capacidad, sin simulacro por fecha.
//   · `planHaciaExamen` proyecta los días con este mismo modelo: solo promete
//     lo que ocurrirá.
//
// Determinista: misma entrada, mismo plan. Empates por hora y título, nunca por
// uuid. Cero prosa: el porqué de cada bloque es un `Motivo` (clave de i18n en
// focus:motivo.*). Nada de esto paga XP.

import { diasEntre, sumarDias } from './fechas';
import type { ConfigPomodoro } from './pomodoro';
import { pendientesDeHoy, primerRepaso, programar } from './repaso';
import type { EstadoTema, TipoExamen } from './tipos';

export type TipoBloque = 'estudiar' | 'repasar' | 'simulacro' | 'entrega';

/** El porqué de un bloque: clave de focus:motivo.* y sus datos. Cero prosa aquí. */
export interface Motivo {
  clave: string;
  datos: Record<string, string | number>;
}

export interface BloqueDia {
  tipo: TipoBloque;
  /** null: tanda de tarjetas de varios mazos. */
  asignaturaId: string | null;
  temaId: string | null;
  examenId: string | null;
  minutos: number;
  motivo: Motivo;
}

export type MotivoSinPlan = 'tarde' | 'cupo_cubierto' | 'no_cabe' | 'examen_hoy' | 'poco_tiempo' | 'atraso_entrega' | 'sin_temas' | 'al_dia' | 'nada_que_planificar';

export interface PlanDelDia {
  bloques: BloqueDia[];
  fuera: BloqueDia[];
  minutosPlan: number;
  minutosDisponibles: number;
  avisoNoLlegas: boolean;
  sinPlan: MotivoSinPlan | null;
}

export interface TemaParaPlan {
  id: string;
  estado: EstadoTema;
  /** Con vueltas, un tema pendiente puede traer repaso programado. */
  repasoEl?: string | null;
  etapa?: number;
}

export interface ExamenParaDia {
  /** null: temario general de una asignatura sin ningún examen. */
  id: string | null;
  asignaturaId: string;
  titulo: string;
  fecha: string | null;
  hora: number | null;
  tipo: TipoExamen;
  estimada: boolean;
  peso: number | null;
  hechaEl?: string | null;
  /** En el orden del temario. */
  temas: readonly TemaParaPlan[];
}

export interface RepasoTemaParaDia {
  id: string;
  asignaturaId: string;
  vence: string | null;
  examenId?: string | null;
}

export interface EntradaDia {
  hoy: string;
  /** Minuto del día desde el que se puede estudiar; null: sin ventana (proyección). */
  desdeMin: number | null;
  minutosDia: number;
  /** Lo ya estudiado hoy: resta de la capacidad. */
  minutosHechos?: number;
  /** Minutos de un bloque de tema. */
  minutosBloque: number;
  /** Para calcular los descansos entre bloques. */
  ritmo: Pick<ConfigPomodoro, 'foco' | 'descanso'>;
  examenes: readonly ExamenParaDia[];
  /** Temas con repaso programado (los no vencidos se ignoran). */
  repasos: readonly RepasoTemaParaDia[];
  tarjetasVencidas?: number;
  /** Asignaturas con simulacro ya hecho hoy: no se vuelve a pedir. */
  simulacrosHechos?: readonly string[];
}

/** Nadie estudia más allá de esta hora. */
export const HORA_LIMITE = 22 * 60 + 30;
export const MINUTOS_TEMA = 50;
export const MINUTOS_TARJETA = 2;
export const MINUTOS_REPASO_TEMA = 10;
export const MINUTOS_SIMULACRO = 60;
export const TOPE_REPASOS = 0.4;
const MINIMO_BLOQUE = 20;
const PESO_POR_DEFECTO = 30;
const DIAS_ENTREGA = 2;
const DIAS_SIN_FECHA = 180;
const DIAS_TEMARIO_SUELTO = 365;
/** Con el examen hoy y hora conocida, se para media hora antes. */
const MARGEN_EXAMEN = 30;

/** Minutos de un bloque de tema: pomodoros enteros, unos 50 min. */
export function minutosBloqueDe(foco: number): number {
  const f = Math.max(1, Math.round(foco));
  return f * Math.max(1, Math.round(MINUTOS_TEMA / f));
}

/** El descanso que sigue a un bloque de `minutos`: uno por pomodoro entero. */
function pausaTras(minutos: number, ritmo: EntradaDia['ritmo']): number {
  return Math.round(minutos / Math.max(1, ritmo.foco)) * ritmo.descanso;
}

/** La hora de cada bloque si se encadenan desde `inicio`. */
export function horasDeBloquesDia(bloques: readonly Pick<BloqueDia, 'minutos'>[], inicio: number, ritmo: EntradaDia['ritmo']): number[] {
  const out: number[] = [];
  let t = inicio;
  for (const b of bloques) {
    out.push(t);
    t += b.minutos + pausaTras(b.minutos, ritmo);
  }
  return out;
}

const pesoDe = (p: number | null) => (p !== null && Number.isFinite(p) && p > 0 ? p : PESO_POR_DEFECTO);

const horaOrden = (h: number | null) => (h === null ? 24 * 60 : h);

/** Días que manda la urgencia. Sin fecha cierta, lejos pero no olvidado. */
function diasPara(x: ExamenParaDia, hoy: string): number {
  if (x.id === null) return DIAS_TEMARIO_SUELTO;
  if (x.fecha === null || x.estimada) return DIAS_SIN_FECHA;
  return Math.max(0.5, diasEntre(hoy, x.fecha));
}

function urgencia(dias: number): number {
  return 1 / (dias * dias);
}

/** Fecha cierta y futura o de hoy. Las pasadas ya no se planifican. */
function fechaCierta(x: ExamenParaDia): x is ExamenParaDia & { fecha: string } {
  return x.fecha !== null && !x.estimada;
}

const compararEmpate = (a: { hora: number | null; titulo: string; orden: number }, b: { hora: number | null; titulo: string; orden: number }) =>
  horaOrden(a.hora) - horaOrden(b.hora) || a.titulo.localeCompare(b.titulo) || a.orden - b.orden;

interface Frente {
  x: ExamenParaDia;
  orden: number;
  hora: number | null;
  titulo: string;
  dias: number;
  /** Temas por estudiar, en orden. */
  cola: TemaParaPlan[];
  /** Minuto del día a partir del cual ya no se estudia para esto. */
  hastaMin: number | null;
}

function motivoEstudio(f: Frente, hoy: string): Motivo {
  const x = f.x;
  if (x.id === null) return { clave: 'estudiarTemario', datos: {} };
  if (x.fecha === null) return { clave: 'estudiarSinFecha', datos: { titulo: x.titulo } };
  if (x.estimada) return { clave: 'estudiarEstimada', datos: { titulo: x.titulo } };
  const dias = diasEntre(hoy, x.fecha);
  if (dias <= 0) return { clave: 'estudiarExamenHoy', datos: { titulo: x.titulo } };
  if (dias === 1) return { clave: 'estudiarExamenManana', datos: { titulo: x.titulo } };
  return { clave: 'estudiarExamen', datos: { titulo: x.titulo, count: dias } };
}

/** Una linde de tiempo por día: minutos y reloj. */
class Dia {
  minutos: number;
  reloj: number | null;
  readonly limite: number | null;
  constructor(
    minutos: number,
    desdeMin: number | null,
    private ritmo: EntradaDia['ritmo'],
  ) {
    this.minutos = minutos;
    this.reloj = desdeMin;
    this.limite = desdeMin === null ? null : HORA_LIMITE;
  }
  cabe(m: number, hastaMin: number | null = null): boolean {
    if (m > this.minutos || m <= 0) return false;
    if (this.reloj === null) return true;
    const fin = this.reloj + m;
    return fin <= (hastaMin === null ? (this.limite as number) : Math.min(hastaMin, this.limite as number));
  }
  /** Los minutos que caben ahora mismo sin pasarse. */
  libres(hastaMin: number | null = null): number {
    if (this.reloj === null) return this.minutos;
    const tope = hastaMin === null ? (this.limite as number) : Math.min(hastaMin, this.limite as number);
    return Math.max(0, Math.min(this.minutos, tope - this.reloj));
  }
  poner(m: number): void {
    this.minutos -= m;
    if (this.reloj !== null) this.reloj += m + pausaTras(m, this.ritmo);
  }
}

export function planDelDia(e: EntradaDia): PlanDelDia {
  const ventana = e.desdeMin === null ? Infinity : Math.max(0, HORA_LIMITE - e.desdeMin);
  const hechos = Math.max(0, e.minutosHechos ?? 0);
  const minutosDisponibles = Math.max(0, Math.round(Math.min(Math.max(0, e.minutosDia - hechos), ventana)));
  const bloques: BloqueDia[] = [];
  const fuera: BloqueDia[] = [];
  const dia = new Dia(minutosDisponibles, e.desdeMin, e.ritmo);
  const poner = (b: BloqueDia, hastaMin: number | null = null) => {
    if (dia.cabe(b.minutos, hastaMin)) {
      dia.poner(b.minutos);
      bloques.push(b);
      return true;
    }
    fuera.push(b);
    return false;
  };
  const usados = new Set<string>();

  // 1. Entregas que vencen pronto.
  const entregas = e.examenes
    .map((x, orden) => ({ x, orden, hora: x.hora, titulo: x.titulo }))
    .filter(({ x }) => x.tipo === 'entrega' && !x.hechaEl && x.fecha !== null)
    .map((a) => ({ ...a, dias: diasEntre(e.hoy, a.x.fecha as string) }))
    .filter((a) => a.dias >= 0 && a.dias <= DIAS_ENTREGA && !(a.dias === 0 && a.hora !== null && e.desdeMin !== null && e.desdeMin >= a.hora))
    .sort((a, b) => a.dias - b.dias || compararEmpate(a, b));
  for (const a of entregas) {
    const hastaMin = a.dias === 0 ? a.hora : null;
    poner(
      {
        tipo: 'entrega',
        asignaturaId: a.x.asignaturaId,
        temaId: null,
        examenId: a.x.id,
        minutos: e.minutosBloque,
        motivo: { clave: a.dias === 0 ? 'entregaHoy' : a.dias === 1 ? 'entregaManana' : 'entregaDias', datos: { titulo: a.x.titulo, count: a.dias } },
      },
      hastaMin,
    );
  }

  // 2. Repasos vencidos, del más atrasado al más reciente y con tope.
  const tope = Math.floor(minutosDisponibles * TOPE_REPASOS);
  const vencidos = pendientesDeHoy(e.repasos, e.hoy);
  const nTarjetas = Math.max(0, Math.floor(e.tarjetasVencidas ?? 0));
  const minTarjetas = nTarjetas * MINUTOS_TARJETA;
  // Si hay de las dos cosas, las tarjetas no se comen más de la mitad del tope.
  const paraTarjetas = vencidos.length > 0 ? Math.min(minTarjetas, Math.floor(tope / 2)) : Math.min(minTarjetas, tope);
  let gastado = Math.floor(paraTarjetas / MINUTOS_TARJETA) * MINUTOS_TARJETA;
  const tarjetasDentro = gastado / MINUTOS_TARJETA;
  if (tarjetasDentro > 0) {
    poner({
      tipo: 'repasar',
      asignaturaId: null,
      temaId: null,
      examenId: null,
      minutos: tarjetasDentro * MINUTOS_TARJETA,
      motivo: { clave: 'repasoTarjetas', datos: { count: tarjetasDentro } },
    });
  }
  for (const r of vencidos) {
    const atraso = -diasEntre(e.hoy, r.vence as string);
    const b: BloqueDia = {
      tipo: 'repasar',
      asignaturaId: r.asignaturaId,
      temaId: r.id,
      examenId: r.examenId ?? null,
      minutos: MINUTOS_REPASO_TEMA,
      motivo: atraso > 0 ? { clave: 'repasoAtrasado', datos: { count: atraso } } : { clave: 'repasoHoy', datos: {} },
    };
    if (gastado + MINUTOS_REPASO_TEMA <= tope && poner(b)) {
      gastado += MINUTOS_REPASO_TEMA;
      usados.add(r.id);
    } else if (gastado + MINUTOS_REPASO_TEMA > tope) {
      fuera.push(b);
    }
  }
  if (nTarjetas > tarjetasDentro) {
    fuera.push({
      tipo: 'repasar',
      asignaturaId: null,
      temaId: null,
      examenId: null,
      minutos: (nTarjetas - tarjetasDentro) * MINUTOS_TARJETA,
      motivo: { clave: 'repasoTarjetas', datos: { count: nTarjetas - tarjetasDentro } },
    });
  }

  // 3. El simulacro de la víspera.
  const simulacrosHechos = new Set(e.simulacrosHechos ?? []);
  const estudiables = e.examenes
    .map((x, orden) => ({ x, orden }))
    .filter(({ x }) => x.tipo !== 'entrega' && !x.hechaEl)
    .filter(({ x }) => {
      if (!fechaCierta(x)) return true;
      const dias = diasEntre(e.hoy, x.fecha);
      if (dias > 0) return true;
      // El mismo día solo se estudia si es más tarde y se sabe la hora.
      return dias === 0 && x.hora !== null && (e.desdeMin === null || e.desdeMin + MARGEN_EXAMEN < x.hora);
    });
  const visperas = estudiables
    .filter(({ x }) => fechaCierta(x) && diasEntre(e.hoy, x.fecha as string) === 1 && !simulacrosHechos.has(x.asignaturaId))
    .map((a) => ({ ...a, hora: a.x.hora, titulo: a.x.titulo }))
    .sort(compararEmpate);
  for (const a of visperas) {
    const libres = dia.libres();
    const minutos = libres >= MINIMO_BLOQUE ? Math.min(MINUTOS_SIMULACRO, libres) : MINUTOS_SIMULACRO;
    poner({ tipo: 'simulacro', asignaturaId: a.x.asignaturaId, temaId: null, examenId: a.x.id, minutos, motivo: { clave: 'simulacroVispera', datos: { titulo: a.x.titulo } } });
  }

  // 4. El resto, por prioridad, con cuidado de que quepa hasta cada examen.
  const vistos = new Set<string>();
  const frentes: Frente[] = estudiables
    .map(({ x, orden }) => ({
      x,
      orden,
      hora: x.hora,
      titulo: x.titulo,
      dias: diasPara(x, e.hoy),
      hastaMin: fechaCierta(x) && diasEntre(e.hoy, x.fecha) === 0 ? (x.hora as number) - MARGEN_EXAMEN : null,
      cola: [] as TemaParaPlan[],
    }))
    // El tema general cuenta para varios exámenes: va con el que antes lo necesita.
    .sort((a, b) => a.dias - b.dias || compararEmpate(a, b));
  for (const f of frentes) {
    f.cola = f.x.temas.filter((t) => t.estado === 'pendiente' && !vistos.has(t.id) && !usados.has(t.id));
    for (const t of f.cola) vistos.add(t.id);
  }

  const bloqueDeTema = (f: Frente, t: TemaParaPlan, minutos: number): BloqueDia => ({
    tipo: 'estudiar',
    asignaturaId: f.x.asignaturaId,
    temaId: t.id,
    examenId: f.x.id,
    minutos,
    motivo: motivoEstudio(f, e.hoy),
  });

  // ¿Llega hasta cada examen con la capacidad de los días que quedan? Lo que
  // no, sale de la cola del examen con menos peso.
  const conFecha = frentes.filter((f) => fechaCierta(f.x));
  let carga = 0;
  for (let i = 0; i < conFecha.length; i++) {
    const f = conFecha[i]!;
    carga += f.cola.length * e.minutosBloque;
    const dias = diasEntre(e.hoy, f.x.fecha as string);
    const simulacros = conFecha.slice(0, i + 1).filter((g) => diasEntre(e.hoy, g.x.fecha as string) >= 2).length * MINUTOS_SIMULACRO;
    const capacidad = dia.minutos + Math.max(0, dias - 1) * Math.max(0, e.minutosDia) - simulacros;
    while (carga > capacidad) {
      const victima = conFecha
        .slice(0, i + 1)
        .filter((g) => g.cola.length > 0)
        .sort((a, b) => pesoDe(a.x.peso) - pesoDe(b.x.peso) || b.dias - a.dias || compararEmpate(a, b))[0];
      if (!victima) break;
      const t = victima.cola.pop() as TemaParaPlan;
      carga -= e.minutosBloque;
      fuera.push(bloqueDeTema(victima, t, e.minutosBloque));
    }
  }

  for (;;) {
    const vivos = frentes
      .filter((f) => f.cola.length > 0 && dia.libres(f.hastaMin) >= Math.min(MINIMO_BLOQUE, e.minutosBloque))
      .map((f) => ({ f, p: urgencia(f.dias) * pesoDe(f.x.peso) * f.cola.length }))
      .sort((a, b) => b.p - a.p || compararEmpate(a.f, b.f));
    const g = vivos[0];
    if (!g) break;
    const t = g.f.cola.shift() as TemaParaPlan;
    const minutos = Math.min(e.minutosBloque, dia.libres(g.f.hastaMin));
    dia.poner(minutos);
    bloques.push(bloqueDeTema(g.f, t, minutos));
  }
  // Lo que iba para hoy o mañana y no ha entrado ya no tiene otro día.
  for (const f of conFecha) {
    if (diasEntre(e.hoy, f.x.fecha as string) > 1) continue;
    for (const t of f.cola.splice(0)) fuera.push(bloqueDeTema(f, t, e.minutosBloque));
  }

  const minutosPlan = bloques.reduce((s, b) => s + b.minutos, 0);
  // Un tema que no se repasa hoy pero se estudia (o sale dos veces) no es «lo que no cabe».
  const enElPlan = new Set(bloques.map((b) => b.temaId).filter((id) => id !== null));
  const vistosFuera = new Set<string>();
  const fueraDeVerdad = fuera.filter((b) => {
    if (b.temaId === null) return true;
    if (enElPlan.has(b.temaId) || vistosFuera.has(b.temaId)) return false;
    vistosFuera.add(b.temaId);
    return true;
  });
  let sinPlan: MotivoSinPlan | null = null;
  if (bloques.length === 0) {
    const porEstudiar = e.examenes.filter((x) => x.tipo !== 'entrega' && !x.hechaEl);
    const hayTemas = porEstudiar.some((x) => x.temas.length > 0);
    const examenHoy = porEstudiar.some((x) => fechaCierta(x) && diasEntre(e.hoy, x.fecha) === 0);
    const entregaAtrasada = e.examenes.some((x) => {
      if (x.tipo !== 'entrega' || x.hechaEl || x.fecha === null) return false;
      const dias = diasEntre(e.hoy, x.fecha);
      return dias < 0 || (dias === 0 && x.hora !== null && e.desdeMin !== null && e.desdeMin >= x.hora);
    });
    if (e.desdeMin !== null && e.desdeMin >= HORA_LIMITE) sinPlan = 'tarde';
    else if (hechos > 0 && hechos >= e.minutosDia) sinPlan = 'cupo_cubierto';
    else if (fueraDeVerdad.length > 0) sinPlan = 'no_cabe';
    else if (examenHoy) sinPlan = 'examen_hoy';
    else if (frentes.some((f) => f.cola.length > 0)) sinPlan = 'poco_tiempo';
    else if (entregaAtrasada) sinPlan = 'atraso_entrega';
    else if (porEstudiar.length === 0) sinPlan = 'nada_que_planificar';
    else if (!hayTemas) sinPlan = 'sin_temas';
    else sinPlan = 'al_dia';
  }
  return { bloques, fuera: fueraDeVerdad, minutosPlan, minutosDisponibles, avisoNoLlegas: fueraDeVerdad.length > 0, sinPlan };
}

export interface ItemPlan {
  examenId: string;
  /** null en el simulacro (es de todo el temario). */
  temaId: string | null;
  tipo: TipoBloque;
}

export interface DiaPlan {
  fecha: string;
  items: ItemPlan[];
}

/** Lo que ya ha pasado hoy: el primer día proyectado tiene que casar con Hoy. */
export interface YaHechoHoy {
  minutosHechosHoy?: number;
  simulacrosHechosHoy?: readonly string[];
  tarjetasVencidasHoy?: number;
}

export interface EntradaProyeccion extends Omit<EntradaDia, 'desdeMin' | 'minutosHechos' | 'simulacrosHechos' | 'repasos' | 'tarjetasVencidas'>, YaHechoHoy {
  /** Temas con su calendario de repasos actual. */
  repasos: readonly (RepasoTemaParaDia & { etapa: number })[];
  /** Cuántos días proyectar desde hoy. */
  dias: number;
  /** Minuto de empezar cada día; null: sin ventana. */
  desdeMinDe?: (fecha: string, indice: number) => number | null;
}

export interface DiaProyectado {
  fecha: string;
  plan: PlanDelDia;
}

/**
 * Proyecta los próximos días con el modelo de `planDelDia`: lo estudiado pasa a
 * repaso según el calendario único y se supone que cada repaso va bien.
 */
export function proyectarDias(e: EntradaProyeccion): DiaProyectado[] {
  const estado = new Map<string, EstadoTema>();
  for (const x of e.examenes) for (const t of x.temas) estado.set(t.id, t.estado);
  const repasos = new Map(e.repasos.map((r) => [r.id, { ...r }]));
  const out: DiaProyectado[] = [];
  for (let i = 0; i < e.dias; i++) {
    const fecha = sumarDias(e.hoy, i);
    const plan = planDelDia({
      hoy: fecha,
      desdeMin: e.desdeMinDe ? e.desdeMinDe(fecha, i) : null,
      minutosDia: e.minutosDia,
      minutosHechos: i === 0 ? e.minutosHechosHoy : 0,
      simulacrosHechos: i === 0 ? e.simulacrosHechosHoy : [],
      tarjetasVencidas: i === 0 ? e.tarjetasVencidasHoy : 0,
      minutosBloque: e.minutosBloque,
      ritmo: e.ritmo,
      examenes: e.examenes.map((x) => ({ ...x, temas: x.temas.map((t) => ({ ...t, estado: estado.get(t.id) ?? t.estado })) })),
      repasos: [...repasos.values()],
    });
    out.push({ fecha, plan });
    for (const b of plan.bloques) {
      if (!b.temaId) continue;
      if (b.tipo === 'estudiar') {
        estado.set(b.temaId, 'repasando');
        const p = primerRepaso(fecha);
        repasos.set(b.temaId, { id: b.temaId, asignaturaId: b.asignaturaId as string, vence: p.vence, etapa: p.etapa, examenId: b.examenId });
      } else if (b.tipo === 'repasar') {
        const r = repasos.get(b.temaId);
        if (r) {
          const p = programar(r.etapa, 'bien', fecha);
          r.etapa = p.etapa;
          r.vence = p.vence;
        }
      }
    }
  }
  return out;
}

export interface EntradaPlan extends YaHechoHoy {
  examenId: string;
  /** Fecha del examen, 'YYYY-MM-DD'; null si aún no se sabe. */
  fecha: string | null;
  /** En el orden del temario. */
  temas: readonly TemaParaPlan[];
  hoy: string;
  asignaturaId?: string;
  titulo?: string;
  hora?: number | null;
  tipo?: TipoExamen;
  estimada?: boolean;
  peso?: number | null;
  minutosDia?: number;
  minutosBloque?: number;
  ritmo?: EntradaDia['ritmo'];
  /** Los demás exámenes: compiten por la misma capacidad. */
  otros?: readonly ExamenParaDia[];
  /** Repasos ya programados de todo el temario (si no, los de `temas`). */
  repasos?: readonly (RepasoTemaParaDia & { etapa: number })[];
  desdeMinDe?: EntradaProyeccion['desdeMinDe'];
}

const HORIZONTE_SIN_FECHA = 120;

/**
 * El plan hacia un examen: los días que quedan con lo que le toca a ESTE
 * examen, según la proyección. Lo que no llegue a ocurrir no aparece.
 */
export function planHaciaExamen(e: EntradaPlan): DiaPlan[] {
  const dias = e.fecha === null ? HORIZONTE_SIN_FECHA : diasEntre(e.hoy, e.fecha);
  if (dias <= 0) return [];
  const asignaturaId = e.asignaturaId ?? '';
  const este: ExamenParaDia = {
    id: e.examenId,
    asignaturaId,
    titulo: e.titulo ?? '',
    fecha: e.fecha,
    hora: e.hora ?? null,
    tipo: e.tipo ?? 'examen',
    estimada: e.estimada ?? false,
    peso: e.peso ?? null,
    temas: e.temas,
  };
  const ids = new Set(e.temas.map((t) => t.id));
  const propios = e.temas
    .filter((t) => typeof t.repasoEl === 'string')
    .map((t) => ({ id: t.id, asignaturaId, vence: t.repasoEl ?? null, etapa: t.etapa ?? 0, examenId: e.examenId }));
  const proyeccion = proyectarDias({
    hoy: e.hoy,
    minutosDia: e.minutosDia ?? 120,
    minutosBloque: e.minutosBloque ?? MINUTOS_TEMA,
    ritmo: e.ritmo ?? { foco: 25, descanso: 5 },
    examenes: [este, ...(e.otros ?? [])],
    repasos: e.repasos ?? propios,
    dias,
    desdeMinDe: e.desdeMinDe,
    minutosHechosHoy: e.minutosHechosHoy,
    simulacrosHechosHoy: e.simulacrosHechosHoy,
    tarjetasVencidasHoy: e.tarjetasVencidasHoy,
  });
  return proyeccion.map(({ fecha, plan }) => ({
    fecha,
    items: plan.bloques
      .filter((b) => b.examenId === e.examenId || (b.temaId !== null && b.tipo === 'repasar' && ids.has(b.temaId)))
      .map((b) => ({ examenId: e.examenId, temaId: b.temaId, tipo: b.tipo })),
  }));
}

/** % del temario hecho: dominado cuenta entero, repasando la mitad. */
export function progresoTemario(temas: readonly { estado: EstadoTema }[]): number {
  if (temas.length === 0) return 0;
  const hecho = temas.reduce((s, t) => s + (t.estado === 'dominado' ? 1 : t.estado === 'repasando' ? 0.5 : 0), 0);
  return Math.round((hecho / temas.length) * 100);
}

const arribaMedia = (min: number) => Math.ceil(min / 30) * 30;

/**
 * La hora a la que empezar a estudiar hoy: la siguiente media hora a partir de
 * ahora y, si hay clase, media hora después de la última. Más tarde de las
 * 22:30 ya no se propone hora (null).
 */
export function inicioEstudio(ahoraMin: number, finUltimaClase: number | null): number | null {
  const base = Math.max(arribaMedia(ahoraMin), finUltimaClase === null ? 0 : arribaMedia(finUltimaClase + 30));
  return base > HORA_LIMITE ? null : base;
}

/**
 * La hora de cada bloque si se encadenan pomodoros desde `inicio`: un bloque
 * por elemento, con su descanso (el largo cada `cadaLargo`).
 */
export function horasDeBloques(n: number, inicio: number, c: Pick<ConfigPomodoro, 'foco' | 'descanso' | 'largo' | 'cadaLargo'>): number[] {
  const out: number[] = [];
  let t = inicio;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += c.foco + ((i + 1) % c.cadaLargo === 0 ? c.largo : c.descanso);
  }
  return out;
}
