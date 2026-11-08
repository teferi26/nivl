// NIVL · El estudio del alumno, tal y como lo ve el coach (modo FOCUS). PURO y sin imports.
//
// Duplicado a propósito de src/focus (fechas, repaso, notas, horario, planEstudio y resumen): el empaquetado
// de la Edge Function no sube nada de fuera de supabase/. Si tocas uno, toca el otro: la paridad la vigila
// src/focus/__tests__/academico-paridad.test.ts, que corre los dos lados con los mismos datos, y
// academico_paridad_test.ts, con la misma tabla de casos en Deno.
//
// Se llama «académico» porque estudio.ts y «# ESTUDIO» ya están ocupados.
//
// Regla de oro: los números son deterministas y la IA solo decide qué hacer con ellos. Aquí salen el plan,
// los minutos, los días y las notas; el coach los lee hechos. Nada de esto paga XP.
//
// Los efectos (lecturas y herramientas) están en academico_datos.ts.

// ── Tipos ───────────────────────────────────────────────────────────────

export type EstadoTema = 'pendiente' | 'repasando' | 'dominado';
export type TipoExamen = 'examen' | 'entrega' | 'prueba';
export type Resultado = 'bien' | 'dudosa' | 'mal';

export interface Asignatura {
  id: string;
  nombre: string;
  notaObjetivo: number | null;
}

export interface Tema {
  id: string;
  asignaturaId: string;
  examenId: string | null;
  nombre: string;
  estado: EstadoTema;
  posicion: number;
  etapa: number;
  repasoEl: string | null;
}

export interface Examen {
  id: string;
  asignaturaId: string;
  titulo: string;
  fecha: string | null;
  peso: number | null;
  hora: number | null;
  tipo: TipoExamen;
  estimada: boolean;
  hechaEl: string | null;
}

export interface Sesion {
  asignaturaId: string | null;
  fecha: string;
  minutos: number;
  metodo: string | null;
}

export interface Clase {
  /** Sin él, cuenta siempre. */
  asignaturaId?: string;
  dia: number;
  inicio: number;
  fin: number;
}

export interface NotaParaMedia {
  nota: number;
  sobre: number;
  peso: number | null;
}

export interface Nota extends NotaParaMedia {
  asignaturaId: string;
  titulo?: string;
}

export interface DatosAcademicos {
  asignaturas: Asignatura[];
  temas: Tema[];
  examenes: Examen[];
  sesiones: Sesion[];
  clases: Clase[];
  notas: Nota[];
  mazos: { id: string; asignaturaId: string | null }[];
  tarjetas: { mazoId: string; vence: string }[];
  prefs: { minutosDia: number; sinClasesHasta: string | null };
}

/** El ritmo del bloque. El coach no ve el del móvil: va con el de por defecto de la app. */
export interface Ritmo {
  foco: number;
  descanso: number;
}

export const RITMO_POR_DEFECTO: Ritmo = { foco: 25, descanso: 5 };

// ── Fechas (espejo de src/focus/fechas.ts) ──────────────────────────────

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFecha(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = RE_FECHA.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function aUtc(s: string): number {
  const m = RE_FECHA.exec(s);
  if (!m) throw new Error(`Fecha inválida: ${s}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function deUtc(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

const DIA = 86_400_000;

export function sumarDias(fecha: string, n: number): string {
  return deUtc(aUtc(fecha) + n * DIA);
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemana(fecha: string): number {
  const d = new Date(aUtc(fecha)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function lunesDe(fecha: string): string {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

export function hhmm(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ── Repetición espaciada (espejo de src/focus/repaso.ts) ────────────────

export const INTERVALOS = [1, 3, 7, 14, 30] as const;
export const ETAPA_MAX = INTERVALOS.length - 1;

const etapaValida = (e: number) => Math.max(0, Math.min(ETAPA_MAX, Number.isFinite(e) ? Math.round(e) : 0));

export function primerRepaso(hoy: string): { etapa: number; vence: string } {
  return { etapa: 0, vence: sumarDias(hoy, INTERVALOS[0]) };
}

export function programar(etapa: number, resultado: Resultado, hoy: string): { etapa: number; vence: string } {
  const e = etapaValida(etapa);
  const nueva = resultado === 'bien' ? Math.min(ETAPA_MAX, e + 1) : resultado === 'dudosa' ? e : 0;
  return { etapa: nueva, vence: sumarDias(hoy, INTERVALOS[nueva] as number) };
}

export function vencido(vence: string | null | undefined, hoy: string): boolean {
  return typeof vence === 'string' && diasEntre(hoy, vence) <= 0;
}

export function pendientesDeHoy<T extends { vence: string | null }>(items: readonly T[], hoy: string): T[] {
  return items.filter((i) => vencido(i.vence, hoy)).sort((a, b) => (a.vence ?? '').localeCompare(b.vence ?? ''));
}

// ── Notas (espejo de src/focus/notas.ts) ────────────────────────────────

export interface Media {
  media: number | null;
  ponderada: boolean;
  pesoEvaluado: number;
  sinPeso: number;
}

const valida = (n: NotaParaMedia) => Number.isFinite(n.nota) && Number.isFinite(n.sobre) && n.sobre > 0 && n.nota >= 0 && n.nota <= n.sobre;

const sobre10 = (n: NotaParaMedia) => (n.nota / n.sobre) * 10;
const dos = (x: number) => Math.round(x * 100) / 100;
const pesoValido = (p: number | null): p is number => p !== null && Number.isFinite(p) && p > 0;

export function media(notas: readonly NotaParaMedia[]): Media {
  const v = notas.filter(valida);
  if (v.length === 0) return { media: null, ponderada: false, pesoEvaluado: 0, sinPeso: 0 };
  const conPeso = v.filter((n) => pesoValido(n.peso));
  if (conPeso.length === 0) {
    return { media: dos(v.reduce((s, n) => s + sobre10(n), 0) / v.length), ponderada: false, pesoEvaluado: 0, sinPeso: 0 };
  }
  const pesoTotal = conPeso.reduce((s, n) => s + (n.peso as number), 0);
  return {
    media: dos(conPeso.reduce((s, n) => s + sobre10(n) * (n.peso as number), 0) / pesoTotal),
    ponderada: true,
    pesoEvaluado: Math.min(100, dos(pesoTotal)),
    sinPeso: v.length - conPeso.length,
  };
}

export type Necesaria =
  | { tipo: 'asegurado' }
  | { tipo: 'encaminada' }
  | { tipo: 'imposible'; necesaria: number }
  | { tipo: 'necesaria'; necesaria: number }
  | { tipo: 'sin_datos' };

export function notaNecesaria(notas: readonly NotaParaMedia[], objetivo = 5): Necesaria {
  const conPeso = notas.filter(valida).filter((n) => pesoValido(n.peso));
  if (conPeso.length === 0) return { tipo: 'sin_datos' };
  const suma = conPeso.reduce((s, n) => s + (n.peso as number), 0);
  const escala = suma > 100 ? 100 / suma : 1;
  const llevo = conPeso.reduce((s, n) => s + (sobre10(n) * (n.peso as number) * escala) / 100, 0);
  const queda = 100 - Math.min(100, suma);
  if (queda <= 0) return llevo >= objetivo ? { tipo: 'asegurado' } : { tipo: 'sin_datos' };
  const falta = ((objetivo - llevo) * 100) / queda;
  if (falta <= 0) return { tipo: 'encaminada' };
  const necesaria = Math.round(falta * 100) / 100;
  return necesaria > 10 ? { tipo: 'imposible', necesaria } : { tipo: 'necesaria', necesaria };
}

// ── Horario y horas (espejo de src/focus/horario.ts) ────────────────────

export function finUltimaClase(horario: readonly Clase[], dia: number): number | null {
  const d = horario.filter((c) => c.dia === dia);
  return d.length === 0 ? null : Math.max(...d.map((c) => c.fin));
}

type SesionHoras = Pick<Sesion, 'asignaturaId' | 'fecha' | 'minutos'>;

export function minutosSemana(sesiones: readonly SesionHoras[], hoy: string): Map<string | null, number> {
  const lunes = lunesDe(hoy);
  const out = new Map<string | null, number>();
  for (const s of sesiones) {
    const d = diasEntre(lunes, s.fecha);
    if (d < 0 || d > 6 || !Number.isFinite(s.minutos) || s.minutos <= 0) continue;
    out.set(s.asignaturaId, (out.get(s.asignaturaId) ?? 0) + s.minutos);
  }
  return out;
}

export function hoyEstudiado(sesiones: readonly SesionHoras[], hoy: string): { minutos: number; bloques: number } {
  const de = sesiones.filter((s) => s.fecha === hoy && s.minutos > 0);
  return { minutos: de.reduce((s, x) => s + x.minutos, 0), bloques: de.length };
}

export function diasSeguidos(sesiones: readonly SesionHoras[], hoy: string): number {
  const dias = new Set(sesiones.filter((s) => s.minutos > 0).map((s) => s.fecha));
  let n = 0;
  let k = dias.has(hoy) ? 0 : 1;
  while (dias.has(sumarDias(hoy, -k))) {
    n++;
    k++;
  }
  return n;
}

// ── El plan del día (espejo de src/focus/planEstudio.ts) ────────────────

export type TipoBloque = 'estudiar' | 'repasar' | 'simulacro' | 'entrega';

export interface Motivo {
  clave: string;
  datos: Record<string, string | number>;
}

export interface BloqueDia {
  tipo: TipoBloque;
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
  repasoEl?: string | null;
  etapa?: number;
}

export interface ExamenParaDia {
  id: string | null;
  asignaturaId: string;
  titulo: string;
  fecha: string | null;
  hora: number | null;
  tipo: TipoExamen;
  estimada: boolean;
  peso: number | null;
  hechaEl?: string | null;
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
  desdeMin: number | null;
  minutosDia: number;
  minutosHechos?: number;
  minutosBloque: number;
  ritmo: Ritmo;
  examenes: readonly ExamenParaDia[];
  repasos: readonly RepasoTemaParaDia[];
  tarjetasVencidas?: number;
  simulacrosHechos?: readonly string[];
}

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
const MARGEN_EXAMEN = 30;

export function minutosBloqueDe(foco: number): number {
  const f = Math.max(1, Math.round(foco));
  return f * Math.max(1, Math.round(MINUTOS_TEMA / f));
}

function pausaTras(minutos: number, ritmo: Ritmo): number {
  return Math.round(minutos / Math.max(1, ritmo.foco)) * ritmo.descanso;
}

export function horasDeBloquesDia(bloques: readonly Pick<BloqueDia, 'minutos'>[], inicio: number, ritmo: Ritmo): number[] {
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

function diasPara(x: ExamenParaDia, hoy: string): number {
  if (x.id === null) return DIAS_TEMARIO_SUELTO;
  if (x.fecha === null || x.estimada) return DIAS_SIN_FECHA;
  return Math.max(0.5, diasEntre(hoy, x.fecha));
}

function urgencia(dias: number): number {
  return 1 / (dias * dias);
}

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
  cola: TemaParaPlan[];
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

class Dia {
  minutos: number;
  reloj: number | null;
  readonly limite: number | null;
  ritmo: Ritmo;
  constructor(minutos: number, desdeMin: number | null, ritmo: Ritmo) {
    this.minutos = minutos;
    this.reloj = desdeMin;
    this.limite = desdeMin === null ? null : HORA_LIMITE;
    this.ritmo = ritmo;
  }
  cabe(m: number, hastaMin: number | null = null): boolean {
    if (m > this.minutos || m <= 0) return false;
    if (this.reloj === null) return true;
    const fin = this.reloj + m;
    return fin <= (hastaMin === null ? (this.limite as number) : Math.min(hastaMin, this.limite as number));
  }
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

export function progresoTemario(temas: readonly { estado: EstadoTema }[]): number {
  if (temas.length === 0) return 0;
  const hecho = temas.reduce((s, t) => s + (t.estado === 'dominado' ? 1 : t.estado === 'repasando' ? 0.5 : 0), 0);
  return Math.round((hecho / temas.length) * 100);
}

const arribaMedia = (min: number) => Math.ceil(min / 30) * 30;

export function inicioEstudio(ahoraMin: number, finClase: number | null): number | null {
  const base = Math.max(arribaMedia(ahoraMin), finClase === null ? 0 : arribaMedia(finClase + 30));
  return base > HORA_LIMITE ? null : base;
}

// ── De los datos a lo que toca (espejo de src/focus/resumen.ts) ─────────

const porPosicion = <T extends { posicion: number; nombre: string }>(a: T, b: T) => a.posicion - b.posicion || a.nombre.localeCompare(b.nombre);

const activas = (d: DatosAcademicos) => new Set(d.asignaturas.map((a) => a.id));

const temasVivos = (d: DatosAcademicos) => {
  const v = activas(d);
  return d.temas.filter((t) => v.has(t.asignaturaId));
};

export function temasDeExamen(d: DatosAcademicos, x: Examen): Tema[] {
  const de = d.temas.filter((t) => t.asignaturaId === x.asignaturaId);
  const propios = de.filter((t) => t.examenId === x.id || t.examenId === null);
  return (propios.length > 0 ? propios : de).sort(porPosicion);
}

function temasDeAsignatura(d: DatosAcademicos, asignaturaId: string): Tema[] {
  return d.temas.filter((t) => t.asignaturaId === asignaturaId).sort(porPosicion);
}

export interface ExamenVista {
  examen: Examen & { fecha: string };
  asignatura: string;
  dias: number;
  progreso: number;
  temas: number;
}

const conFechaExamen = (x: Examen): x is Examen & { fecha: string } => x.fecha !== null;

export function examenesProximos(d: DatosAcademicos, hoy: string): ExamenVista[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .filter(conFechaExamen)
    .filter((x) => x.tipo !== 'entrega' && !x.hechaEl)
    .map((x) => ({ x, dias: diasEntre(hoy, x.fecha) }))
    .filter((e) => e.dias >= 0 && nombre.has(e.x.asignaturaId))
    .sort((a, b) => a.dias - b.dias || (a.x.hora ?? 1440) - (b.x.hora ?? 1440) || a.x.titulo.localeCompare(b.x.titulo))
    .map(({ x, dias }) => {
      const temas = temasDeExamen(d, x);
      return { examen: x, asignatura: nombre.get(x.asignaturaId) ?? '', dias, progreso: progresoTemario(temas), temas: temas.length };
    });
}

export interface ExamenSinFechaVista {
  examen: Examen;
  asignatura: string;
  progreso: number;
  temas: number;
}

export function examenesSinFecha(d: DatosAcademicos): ExamenSinFechaVista[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .filter((x) => x.fecha === null && x.tipo !== 'entrega' && !x.hechaEl && nombre.has(x.asignaturaId))
    .sort((a, b) => a.titulo.localeCompare(b.titulo))
    .map((x) => {
      const temas = temasDeExamen(d, x);
      return { examen: x, asignatura: nombre.get(x.asignaturaId) ?? '', progreso: progresoTemario(temas), temas: temas.length };
    });
}

export interface EntregaVista {
  examen: Examen;
  asignatura: string;
  dias: number | null;
}

export function entregasPendientes(d: DatosAcademicos, hoy: string): EntregaVista[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .filter((x) => x.tipo === 'entrega' && !x.hechaEl && nombre.has(x.asignaturaId))
    .map((x) => ({ examen: x, asignatura: nombre.get(x.asignaturaId) ?? '', dias: x.fecha === null ? null : diasEntre(hoy, x.fecha) }))
    .sort((a, b) => (a.dias ?? 1e6) - (b.dias ?? 1e6) || (a.examen.hora ?? 1440) - (b.examen.hora ?? 1440) || a.examen.titulo.localeCompare(b.examen.titulo));
}

export interface BloquePlan {
  hora: number | null;
  tipo: TipoBloque;
  asignaturaId: string | null;
  asignatura: string;
  temaId: string | null;
  tema: string | null;
  examenId: string | null;
  minutos: number;
  motivo: Motivo;
}

export interface PlanHoy {
  bloques: BloquePlan[];
  fuera: BloquePlan[];
  minutosPlan: number;
  minutosDisponibles: number;
  avisoNoLlegas: boolean;
  sinPlan: MotivoSinPlan | null;
}

function hayClases(d: DatosAcademicos, fecha: string): boolean {
  const hasta = d.prefs.sinClasesHasta;
  return hasta === null || diasEntre(fecha, hasta) < 0;
}

/** Una clase de una asignatura archivada no retrasa el inicio. */
function finClases(d: DatosAcademicos, fecha: string): number | null {
  if (!hayClases(d, fecha)) return null;
  const vivas = new Set(d.asignaturas.map((a) => a.id));
  return finUltimaClase(
    d.clases.filter((c) => c.asignaturaId === undefined || vivas.has(c.asignaturaId)),
    diaSemana(fecha),
  );
}

function frentesDe(d: DatosAcademicos, hoy: string): ExamenParaDia[] {
  const vivas = activas(d);
  const examenes = d.examenes.filter((x) => vivas.has(x.asignaturaId) && !x.hechaEl);
  const frentes: ExamenParaDia[] = examenes.map((x) => ({
    id: x.id,
    asignaturaId: x.asignaturaId,
    titulo: x.titulo,
    fecha: x.fecha,
    hora: x.hora,
    tipo: x.tipo,
    estimada: x.estimada,
    peso: x.peso,
    hechaEl: x.hechaEl,
    temas: x.tipo === 'entrega' ? [] : temasDeExamen(d, x),
  }));
  const conExamen = new Set(
    examenes.filter((x) => x.tipo !== 'entrega' && (x.fecha === null || x.estimada || diasEntre(hoy, x.fecha) >= 0)).map((x) => x.asignaturaId),
  );
  for (const a of d.asignaturas) {
    if (conExamen.has(a.id)) continue;
    const temas = temasDeAsignatura(d, a.id);
    if (temas.length > 0) {
      frentes.push({ id: null, asignaturaId: a.id, titulo: a.nombre, fecha: null, hora: null, tipo: 'examen', estimada: false, peso: null, temas });
    }
  }
  return frentes;
}

function examenDeTema(t: Tema, frentes: readonly ExamenParaDia[], hoy: string): string | null {
  if (t.examenId) return t.examenId;
  const candidato = frentes
    .filter((x) => x.id !== null && x.asignaturaId === t.asignaturaId && x.tipo !== 'entrega' && x.fecha !== null && diasEntre(hoy, x.fecha) >= 0)
    .sort((a, b) => (a.fecha as string).localeCompare(b.fecha as string))[0];
  return candidato?.id ?? null;
}

function repasosParaPlan(d: DatosAcademicos, frentes: readonly ExamenParaDia[], hoy: string): (RepasoTemaParaDia & { etapa: number })[] {
  return temasVivos(d)
    .filter((t) => t.repasoEl !== null)
    .map((t) => ({ id: t.id, asignaturaId: t.asignaturaId, vence: t.repasoEl, etapa: t.etapa, examenId: examenDeTema(t, frentes, hoy) }));
}

function tarjetasVivas(d: DatosAcademicos) {
  const vivas = activas(d);
  const mazo = new Map(d.mazos.map((m) => [m.id, m.asignaturaId]));
  return d.tarjetas.filter((c) => {
    const a = mazo.get(c.mazoId);
    return a === undefined || a === null || vivas.has(a);
  });
}

export function entradaDelDia(d: DatosAcademicos, hoy: string, ahoraMin: number, c: Ritmo): EntradaDia {
  const frentes = frentesDe(d, hoy);
  const inicio = inicioEstudio(ahoraMin, finClases(d, hoy));
  return {
    hoy,
    desdeMin: inicio ?? HORA_LIMITE,
    minutosDia: d.prefs.minutosDia,
    minutosHechos: hoyEstudiado(d.sesiones, hoy).minutos,
    minutosBloque: minutosBloqueDe(c.foco),
    ritmo: { foco: c.foco, descanso: c.descanso },
    examenes: frentes,
    repasos: repasosParaPlan(d, frentes, hoy),
    tarjetasVencidas: pendientesDeHoy(tarjetasVivas(d), hoy).length,
    simulacrosHechos: d.sesiones.filter((s) => s.fecha === hoy && s.metodo === 'anteriores' && s.asignaturaId !== null).map((s) => s.asignaturaId as string),
  };
}

function aVista(d: DatosAcademicos, b: BloqueDia, hora: number | null): BloquePlan {
  return {
    hora,
    tipo: b.tipo,
    asignaturaId: b.asignaturaId,
    asignatura: d.asignaturas.find((a) => a.id === b.asignaturaId)?.nombre ?? '',
    temaId: b.temaId,
    tema: b.temaId ? (d.temas.find((t) => t.id === b.temaId)?.nombre ?? null) : null,
    examenId: b.examenId,
    minutos: b.minutos,
    motivo: b.motivo,
  };
}

export function planDeHoyCompleto(d: DatosAcademicos, hoy: string, ahoraMin: number, c: Ritmo): PlanHoy {
  const e = entradaDelDia(d, hoy, ahoraMin, c);
  const plan = planDelDia(e);
  const horas = e.desdeMin === null || plan.sinPlan === 'tarde' ? [] : horasDeBloquesDia(plan.bloques, e.desdeMin, e.ritmo);
  return {
    bloques: plan.bloques.map((b, i) => aVista(d, b, horas[i] ?? null)),
    fuera: plan.fuera.map((b) => aVista(d, b, null)),
    minutosPlan: plan.minutosPlan,
    minutosDisponibles: plan.minutosDisponibles,
    avisoNoLlegas: plan.avisoNoLlegas,
    sinPlan: plan.sinPlan,
  };
}

export function repasosDeHoy(d: DatosAcademicos, hoy: string): { temas: Tema[]; tarjetas: number } {
  const temas = pendientesDeHoy(
    temasVivos(d).map((t) => ({ ...t, vence: t.repasoEl })),
    hoy,
  );
  return { temas, tarjetas: pendientesDeHoy(tarjetasVivas(d), hoy).length };
}

export interface NotasAsignatura {
  asignatura: Asignatura;
  media: Media;
  necesaria: Necesaria;
  notas: number;
  objetivo: number;
}

/** La marca de src/focus/agenda.ts: un simulacro es un ensayo, no mueve la media. */
const esSimulacro = (n: Nota) => n.peso === null && (n.titulo ?? '').startsWith('Test · ');

export function notasPorAsignatura(d: DatosAcademicos): NotasAsignatura[] {
  return d.asignaturas
    .map((a) => {
      const ns = d.notas.filter((n) => n.asignaturaId === a.id && !esSimulacro(n));
      const objetivo = a.notaObjetivo ?? 5;
      return { asignatura: a, media: media(ns), necesaria: notaNecesaria(ns, objetivo), notas: ns.length, objetivo };
    })
    .filter((x) => x.notas > 0);
}

// ── Lo que lee el coach ─────────────────────────────────────────────────

/** Los días de sesiones que se leen: «días seguidos» no sabe contar más allá. */
export const DIAS_DE_SESIONES = 60;
const TOPE_EXAMENES = 6;
const TOPE_SIN_FECHA = 6;
const TOPE_ENTREGAS = 8;
const TOPE_NOTAS = 12;
const TOPE_ASIGNATURAS = 20;
const TOPE_PLAN = 10;
const TOPE_FUERA = 3;

/** Un nombre escrito por el usuario, en una línea, sin etiquetas de datos y acotado. */
export function enUnaLinea(texto: unknown, tope: number): string {
  return String(texto ?? '')
    .replace(/<\/?\s*datos_del_gladiador\s*>/gi, '')
    .replace(/[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/gi, '[correo]')
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, tope);
}

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
const coma = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',');

/** El porqué de un bloque en palabras. Los mismos textos que focus:motivo.* de la app. */
export function textoMotivo(m: Motivo): string {
  const titulo = enUnaLinea(m.datos.titulo, 60);
  const n = Number(m.datos.count);
  switch (m.clave) {
    case 'entregaHoy': return `${titulo}: se entrega hoy`;
    case 'entregaManana': return `${titulo}: se entrega mañana`;
    case 'entregaDias': return `${titulo}: se entrega en ${dias(n)}`;
    case 'repasoHoy': return 'Hoy toca repasarlo';
    case 'repasoAtrasado': return `Repaso con ${dias(n)} de retraso`;
    case 'repasoTarjetas': return `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'} por repasar`;
    case 'simulacroVispera': return `${titulo} es mañana: un simulacro cronometrado`;
    case 'estudiarExamen': return `${titulo} en ${dias(n)}`;
    case 'estudiarExamenManana': return `${titulo} es mañana`;
    case 'estudiarExamenHoy': return `${titulo} es hoy, más tarde`;
    case 'estudiarSinFecha': return `${titulo}: sin fecha aún, sigue en orden`;
    case 'estudiarEstimada': return `${titulo}: fecha aproximada, sigue en orden`;
    case 'estudiarTemario': return 'Sigue con el temario en orden';
    default: return m.clave;
  }
}

const SIN_PLAN: Record<MotivoSinPlan, string> = {
  tarde: 'por hoy ya es tarde: nada de empezar más bloques.',
  cupo_cubierto: 'hoy ya ha hecho sus horas.',
  no_cabe: 'lo que queda no cabe en el rato que tiene hoy.',
  examen_hoy: 'hoy tiene examen: no se planifica más estudio.',
  poco_tiempo: 'le queda muy poco rato para un bloque: mañana sigue.',
  atraso_entrega: 'tiene una entrega atrasada sin cerrar.',
  sin_temas: 'falta el temario: pídele los temas y apúntalos con apuntar_estudio.',
  al_dia: 'va al día, no hay nada pendiente para hoy.',
  nada_que_planificar: 'no hay ningún examen ni temario apuntado.',
};

const VACIO =
  'Todavía no tiene asignaturas, exámenes ni temario apuntados. Pregúntale qué asignaturas tiene y cuándo son los exámenes, ' +
  'y apúntalo con apuntar_estudio: el plan del día sale solo.';

function lineaFecha(x: Examen): string {
  const fecha = x.fecha ?? 'sin fecha';
  const hora = x.hora === null ? '' : ` ${hhmm(x.hora)}`;
  return `${fecha}${hora}${x.estimada ? ' (aproximada)' : ''}`;
}

function lineaNecesaria(n: Necesaria): string {
  switch (n.tipo) {
    case 'asegurado': return 'objetivo cumplido, no queda nada por evaluar';
    case 'encaminada': return 'con lo que lleva ya llega, pero aún queda por evaluar';
    case 'necesaria': return `necesita un ${coma(n.necesaria)} en lo que queda`;
    case 'imposible': return `con lo que queda ya no llega al objetivo (haría falta un ${coma(n.necesaria)})`;
    case 'sin_datos': return 'sin porcentajes para calcular lo que necesita';
  }
}

/** La parte lenta: cambia solo al apuntar un examen o una nota. Sin «días que faltan»: esos van en la de hoy. */
export function seccionLenta(d: DatosAcademicos, hoy: string): string {
  if (d.asignaturas.length === 0) return '';
  const l: string[] = ['## FOCUS: exámenes y notas'];
  const nombres = d.asignaturas.slice(0, TOPE_ASIGNATURAS).map((a) => enUnaLinea(a.nombre, 40));
  l.push(`Asignaturas: ${nombres.join(', ')}${d.asignaturas.length > TOPE_ASIGNATURAS ? ` (+${d.asignaturas.length - TOPE_ASIGNATURAS} más)` : ''}.`);

  const proximos = examenesProximos(d, hoy);
  if (proximos.length) l.push('Exámenes (el más cercano primero):');
  for (const v of proximos.slice(0, TOPE_EXAMENES)) {
    l.push(`- [${v.examen.id}] ${enUnaLinea(v.asignatura, 40)} · ${enUnaLinea(v.examen.titulo, 60)} · ${lineaFecha(v.examen)}${v.examen.peso === null ? '' : ` · peso ${coma(v.examen.peso)} %`}`);
  }
  if (proximos.length > TOPE_EXAMENES) l.push(`- (+${proximos.length - TOPE_EXAMENES} más)`);

  const sinFecha = examenesSinFecha(d);
  if (sinFecha.length) l.push('Exámenes sin fecha:');
  for (const v of sinFecha.slice(0, TOPE_SIN_FECHA)) l.push(`- [${v.examen.id}] ${enUnaLinea(v.asignatura, 40)} · ${enUnaLinea(v.examen.titulo, 60)}`);
  if (sinFecha.length > TOPE_SIN_FECHA) l.push(`- (+${sinFecha.length - TOPE_SIN_FECHA} más)`);

  const notas = notasPorAsignatura(d);
  if (notas.length) l.push('Notas (sobre 10, ya calculadas):');
  for (const n of notas.slice(0, TOPE_NOTAS)) {
    const detalle = n.media.ponderada ? `ponderada, ${coma(n.media.pesoEvaluado)} % evaluado` : `${n.notas} ${n.notas === 1 ? 'nota' : 'notas'} sin porcentaje`;
    l.push(`- ${enUnaLinea(n.asignatura.nombre, 40)}: media ${n.media.media === null ? 'sin calcular' : coma(n.media.media)} (${detalle}) · objetivo ${coma(n.objetivo)} · ${lineaNecesaria(n.necesaria)}`);
  }
  if (notas.length > TOPE_NOTAS) l.push(`- (+${notas.length - TOPE_NOTAS} más)`);
  return l.join('\n');
}

function lineaBloque(b: BloquePlan, i: number): string {
  const hora = b.hora === null ? 'sin hora' : hhmm(b.hora);
  const que = [
    b.asignatura ? enUnaLinea(b.asignatura, 40) : null,
    b.temaId ? `tema [${b.temaId}] «${enUnaLinea(b.tema, 80)}»` : null,
  ].filter(Boolean).join(' · ');
  return `${i + 1}. ${hora} · ${b.minutos} min · ${b.tipo}${que ? ` · ${que}` : ''} · por qué: ${textoMotivo(b.motivo)}`;
}

function cuandoFalta(n: number): string {
  if (n < 0) return `vencida hace ${dias(-n)}`;
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `faltan ${dias(n)}`;
}

/** Lo que cambia dentro del día: va en el turno (SECCIONES_RAPIDAS), nunca en la parte cacheada. */
export function seccionHoy(d: DatosAcademicos, hoy: string, ahoraMin: number, c: Ritmo = RITMO_POR_DEFECTO): string {
  if (d.asignaturas.length === 0) return `## FOCUS hoy\n${VACIO}`;
  const l: string[] = ['## FOCUS hoy', 'Cifras y plan calculados por el sistema: úsalos tal cual, no los recalcules.'];

  const ahora = hoyEstudiado(d.sesiones, hoy);
  let semana = 0;
  for (const m of minutosSemana(d.sesiones, hoy).values()) semana += m;
  const seguidos = diasSeguidos(d.sesiones, hoy);
  const racha = seguidos >= DIAS_DE_SESIONES ? `${seguidos} o más` : String(seguidos);
  l.push(`Estudiado: hoy ${ahora.minutos} min en ${ahora.bloques} ${ahora.bloques === 1 ? 'bloque' : 'bloques'} · esta semana ${semana} min · días seguidos: ${racha}.`);

  const plan = planDeHoyCompleto(d, hoy, ahoraMin, c);
  l.push(`Capacidad: ${d.prefs.minutosDia} min al día · quedan ${plan.minutosDisponibles} min hoy · el plan ocupa ${plan.minutosPlan} min.`);

  const repasos = repasosDeHoy(d, hoy);
  l.push(`Repasos vencidos: ${repasos.temas.length} ${repasos.temas.length === 1 ? 'tema' : 'temas'} y ${repasos.tarjetas} ${repasos.tarjetas === 1 ? 'tarjeta' : 'tarjetas'}.`);

  const proximos = examenesProximos(d, hoy);
  if (proximos.length) l.push('Días que faltan y temario hecho:');
  for (const v of proximos.slice(0, TOPE_EXAMENES)) {
    l.push(`- ${enUnaLinea(v.asignatura, 40)} · ${enUnaLinea(v.examen.titulo, 60)}: ${cuandoFalta(v.dias)} · ${v.progreso} % de ${v.temas} ${v.temas === 1 ? 'tema' : 'temas'}`);
  }
  for (const v of examenesSinFecha(d).slice(0, TOPE_SIN_FECHA)) {
    l.push(`- ${enUnaLinea(v.asignatura, 40)} · ${enUnaLinea(v.examen.titulo, 60)}: sin fecha · ${v.progreso} % de ${v.temas} ${v.temas === 1 ? 'tema' : 'temas'}`);
  }

  const entregas = entregasPendientes(d, hoy);
  if (entregas.length) l.push('Entregas sin cerrar:');
  for (const v of entregas.slice(0, TOPE_ENTREGAS)) {
    l.push(`- [${v.examen.id}] ${enUnaLinea(v.asignatura, 40)} · ${enUnaLinea(v.examen.titulo, 60)}: ${v.dias === null ? 'sin fecha' : cuandoFalta(v.dias)}`);
  }
  if (entregas.length > TOPE_ENTREGAS) l.push(`- (+${entregas.length - TOPE_ENTREGAS} más)`);

  if (plan.bloques.length) {
    l.push('Plan de estudio de hoy, en orden (el primero es lo que toca ahora):');
    plan.bloques.slice(0, TOPE_PLAN).forEach((b, i) => l.push(lineaBloque(b, i)));
    if (plan.bloques.length > TOPE_PLAN) l.push(`(+${plan.bloques.length - TOPE_PLAN} bloques más)`);
  } else if (plan.sinPlan) {
    l.push(`Plan de estudio de hoy: ninguno, ${SIN_PLAN[plan.sinPlan]}`);
  }
  if (plan.avisoNoLlegas) {
    const primeros = plan.fuera.slice(0, TOPE_FUERA).map((b) => textoMotivo(b.motivo)).join(' · ');
    l.push(`AVISO: no llega a todo con esta capacidad. Se quedan fuera ${plan.fuera.length} ${plan.fuera.length === 1 ? 'bloque' : 'bloques'}: ${primeros}.`);
  }
  return l.join('\n');
}

/** Las dos secciones del estado. Sin nada apuntado, solo la de hoy, con la invitación a apuntarlo. */
export function seccionesAcademicas(d: DatosAcademicos, hoy: string, ahoraMin: number, c: Ritmo = RITMO_POR_DEFECTO): string {
  return [seccionLenta(d, hoy), seccionHoy(d, hoy, ahoraMin, c)].filter(Boolean).join('\n\n');
}

/** El minuto del día en una zona horaria; con una zona mala o ausente, la de la cuenta por defecto. */
export function minutoLocal(ahora: Date, zona: string | null | undefined): number {
  const fmt = (z: string) => {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora);
    return Number(f.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(f.find((p) => p.type === 'minute')?.value ?? 0);
  };
  try {
    return fmt(zona || 'Europe/Madrid');
  } catch {
    return fmt('Europe/Madrid');
  }
}

// ── Lo que dicta el alumno (validación de las herramientas del coach) ───

export const TOPE_TEMAS_POR_LLAMADA = 100;
export const TOPE_NOMBRE_TEMA = 160;
export const MINUTOS_SESION: readonly [number, number] = [1, 240];
/** Una sesión apuntada a mano se admite hasta esta antigüedad. */
export const DIAS_ATRAS_SESION = 7;

/** Para comparar nombres: sin mayúsculas, acentos ni espacios de más. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const NUMERO = /^\d{1,4}(?:[.,]\d{1,2})?$/;

/** «7,5», «7.5» u «8». null si no lo es. */
export function leerNumero(s: string): number | null {
  const t = s.trim();
  return NUMERO.test(t) ? Number(t.replace(',', '.')) : null;
}

/** Porcentaje de la nota final (0 a 100, sin el 0). */
export function leerPeso(s: string): number {
  const n = leerNumero(s.replace('%', ''));
  if (n === null || n <= 0 || n > 100) throw new Error(`peso inválido: ${s} (un porcentaje entre 1 y 100)`);
  return n;
}

/** «7,5» (sobre 10), «15/20» o «15 sobre 20». */
export function leerNota(s: string): { nota: number; sobre: number } {
  const m = /^\s*([\d.,]+)\s*(?:\/|sobre)\s*([\d.,]+)\s*$/i.exec(s);
  const nota = leerNumero(m ? (m[1] as string) : s);
  const sobre = m ? leerNumero(m[2] as string) : 10;
  if (nota === null || sobre === null || sobre <= 0 || sobre > 1000) throw new Error(`nota inválida: ${s} (ejemplos: 7,5 o 15/20)`);
  if (nota > sobre) throw new Error(`nota inválida: ${s} (si no es sobre 10, escríbela como 15/20)`);
  return { nota, sobre };
}

export function leerMinutos(s: string): number {
  const n = /^\d{1,4}$/.test(s.trim()) ? Number(s.trim()) : NaN;
  if (!Number.isInteger(n) || n < MINUTOS_SESION[0] || n > MINUTOS_SESION[1]) {
    throw new Error(`minutos inválidos: ${s} (entero de ${MINUTOS_SESION[0]} a ${MINUTOS_SESION[1]}; si son más, apunta varias sesiones)`);
  }
  return n;
}

const FECHA_HORA = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/;

/** 'YYYY-MM-DD' con hora opcional ('YYYY-MM-DD HH:MM'), dentro del rango que admite la tabla. */
export function leerFechaHora(s: string): { fecha: string; hora: number | null } {
  const m = FECHA_HORA.exec(s.trim());
  if (!m || !esFecha(m[1]) || m[1] < '2000-01-01' || m[1] > '2100-12-31') throw new Error(`fecha inválida: ${s} (YYYY-MM-DD, con hora opcional: YYYY-MM-DD HH:MM)`);
  if (m[2] === undefined) return { fecha: m[1], hora: null };
  const h = Number(m[2]);
  const mi = Number(m[3]);
  if (h > 23 || mi > 59) throw new Error(`hora inválida: ${s}`);
  return { fecha: m[1], hora: h * 60 + mi };
}

/** Temas dictados: uno por línea (o separados por «;»), sin viñetas, sin repetir y recortados al tope de la tabla. */
export function partirTemas(s: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const crudo of s.split(/[\n;]+/)) {
    const t = crudo.replace(/^\s*[-*·•]\s*/, '').trim().slice(0, TOPE_NOMBRE_TEMA).trim();
    const k = normalizar(t);
    if (!t || vistos.has(k)) continue;
    vistos.add(k);
    out.push(t);
  }
  if (out.length > TOPE_TEMAS_POR_LLAMADA) throw new Error(`Demasiados temas: ${out.length} (máximo ${TOPE_TEMAS_POR_LLAMADA} por llamada).`);
  return out;
}

export type Coincidencia<T> = { tipo: 'una'; elegido: T } | { tipo: 'varias'; candidatos: T[] } | { tipo: 'ninguna' };

/** Busca por nombre: primero exacto (sin acentos ni mayúsculas); si no, el único que contenga lo dicho o esté contenido. */
export function coincidir<T>(lista: readonly T[], nombre: string, nombreDe: (x: T) => string): Coincidencia<T> {
  const q = normalizar(nombre);
  if (!q) return { tipo: 'ninguna' };
  const exactos = lista.filter((x) => normalizar(nombreDe(x)) === q);
  if (exactos.length >= 1) return { tipo: 'una', elegido: exactos[0] as T };
  const parecidos = lista.filter((x) => {
    const n = normalizar(nombreDe(x));
    return n.includes(q) || q.includes(n);
  });
  if (parecidos.length === 1) return { tipo: 'una', elegido: parecidos[0] as T };
  return parecidos.length > 1 ? { tipo: 'varias', candidatos: parecidos } : { tipo: 'ninguna' };
}

export interface CambioDeTema {
  estado: EstadoTema;
  etapa: number;
  repasoEl: string | null;
  repasado: boolean;
}

/**
 * Lo que queda de un tema tras lo que dice el alumno. Mismas reglas que cambiarEstadoTema y repasarTema de
 * src/focus/datos.ts: etapa y fecha las calcula el calendario, nunca el modelo; volver a «pendiente» no borra
 * el repaso. Un repaso de algo que nunca se había estudiado lo da por visto.
 */
export function cambioDeTema(
  t: { estado: EstadoTema; etapa: number; repasoEl: string | null },
  pide: { estado?: EstadoTema; repaso?: Resultado },
  hoy: string,
): CambioDeTema {
  if (pide.repaso) {
    const p = programar(t.etapa, pide.repaso, hoy);
    const visto = t.estado === 'pendiente' && t.repasoEl === null ? 'repasando' : t.estado;
    return { estado: pide.estado ?? visto, etapa: p.etapa, repasoEl: p.vence, repasado: true };
  }
  const estado = pide.estado ?? t.estado;
  if (estado !== 'pendiente' && t.repasoEl === null) {
    const p = primerRepaso(hoy);
    return { estado, etapa: p.etapa, repasoEl: p.vence, repasado: false };
  }
  return { estado, etapa: t.etapa, repasoEl: t.repasoEl, repasado: false };
}
