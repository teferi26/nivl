// NIVL · Las herramientas de resistencia del coach: cuándo salir, carrera, plan
// y entreno a mano.
//
// Van aparte de tools.ts porque traen su propio mundo (previsión, planes,
// espejo en `cardio_sessions`). Se ejecutan con el cliente del USUARIO: RLS y el
// permiso de salud siguen mandando. El XP sale de las tablas, nunca del modelo.

import type { Db } from './db.ts';
import { espejoCardio, type EspejoFila } from './entrenoEspejo.ts';
import { externoManual, normalizarEntreno, tipoCardioDe, type DeporteEntreno } from './entrenoMedido.ts';
import { limitesZonas, zonaDe } from './entrenomath.ts';
import { dolorVigente, formaDe, sumarDias, type FilaBienestar, type FilaPerfil } from './estudioResistencia.ts';
import { franjasOcupadas, horaEnPuntoSiguiente, mejorVentana, tramoDelDia, type ContextoSalida, type HoraClima, type VeredictoSalida, type Ventana } from './mejorHora.ts';
import { DISTANCIAS, generarPlan, type DistanciasPrueba, type PlanCarrera, type TipoPrueba } from './planCarrera.ts';
import { fetchPrevision, zonaSegura } from './tiempo.ts';

export interface CtxResistencia {
  sb: Db;
  userId: string;
  today: string;
}

/** Lo que devuelve `propagarActo` en tools.ts. */
export interface EcoActo {
  texto: string;
  enlazadas: number;
  pagadoMisiones: number | null;
  xpAhora: number | null;
}

export interface PuertasXp {
  propagarActo: (ctx: CtxResistencia, link: string, opts: { desglose: boolean; deporte?: string }) => Promise<EcoActo>;
  restoDelModulo: (base: number, pagadoMisiones: number | null) => number;
}

export const TIPOS_PRUEBA = ['sprint', 'olimpico', 'medio', 'ironman', '5k', '10k', 'media', 'maraton', 'otra'];
export const NIVELES_CARRERA = ['principiante', 'intermedio', 'avanzado'];
export const DEPORTES_REGISTRO = ['carrera', 'bici', 'piscina', 'aguas_abiertas', 'caminar', 'fuerza', 'otro'];
export const DISCIPLINAS_PLAN = ['natacion', 'bici', 'carrera', 'brick', 'transicion', 'fuerza', 'descanso'];
export const DISCIPLINAS_SALIDA = ['carrera', 'bici', 'aguas_abiertas', 'otro'];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const valor = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  return s === '' ? undefined : s;
};

function fechaValida(v: unknown, campo = 'fecha'): string {
  const f = String(v ?? '').trim();
  if (!FECHA.test(f) || Number.isNaN(Date.parse(`${f}T00:00:00Z`))) throw new Error(`${campo} inválida: ${f} (YYYY-MM-DD)`);
  return f;
}

function numeroPositivo(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function enLinea(v: unknown, tope: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, tope);
}

// ── Espejos puros de la app ─────────────────────────────────────────
// De src/lib/game.ts; un test compara las constantes con las de allí.
export const CARDIO_SESSION_XP = 40;
export const CARDIO_WALK_XP = 15;
export const CARDIO_DAILY_CAP = 60;

/** Espejo de `cardioXp`. */
export function cardioXp(kind: string, yaPagadoHoy: number): number {
  const base = kind === 'caminar' ? CARDIO_WALK_XP : CARDIO_SESSION_XP;
  return Math.max(0, Math.min(base, CARDIO_DAILY_CAP - Math.max(0, yaPagadoHoy)));
}

/** Espejo de `xpPagado`: lo que entró de verdad tras los topes del servidor. */
export function xpPagado(pedido: number, antes: number, despues: number): number {
  return Math.max(0, Math.min(pedido, despues - antes));
}

/**
 * La misión enlazada descuenta solo a la primera sesión del día que la marca;
 * a las demás, solo lo que hayan marcado ellas ahora (`pagoActo.descuentoDeMision`).
 */
export function descuentoEco(eco: Pick<EcoActo, 'pagadoMisiones' | 'xpAhora'> | null, primera: boolean): number | null {
  if (!eco) return 0;
  return primera ? eco.pagadoMisiones : eco.xpAhora;
}

/** Espejo de `disciplinaDeDeporte` + `elegirSesionPlan` (src/lib/resistenciaPura.ts). */
export function elegirSesionPlan<S extends { id: string; disciplina: string; clave: boolean; hecha_entreno_id: string | null }>(
  sesiones: readonly S[],
  deporte: string,
): S | null {
  const disciplina: Record<string, string> = { carrera: 'carrera', bici: 'bici', piscina: 'natacion', aguas_abiertas: 'natacion', fuerza: 'fuerza' };
  const objetivo = disciplina[deporte];
  if (!objetivo) return null;
  const pendientes = sesiones.filter((s) => s.hecha_entreno_id === null);
  const primera = (l: S[]) => l.find((s) => s.clave) ?? l[0] ?? null;
  const directas = pendientes.filter((s) => s.disciplina === objetivo);
  if (directas.length) return primera(directas);
  return deporte === 'bici' || deporte === 'carrera' ? primera(pendientes.filter((s) => s.disciplina === 'brick')) : null;
}

/** Espejo de `filasDelPlan` (src/lib/resistenciaPura.ts). */
export function filasDelPlan(plan: PlanCarrera, userId: string, objetivoId: string) {
  return plan.semanas.flatMap((semana) =>
    semana.sesiones.map((s) => ({
      user_id: userId,
      objetivo_id: objetivoId,
      semana: s.semana,
      fecha: s.fecha,
      disciplina: s.disciplina,
      titulo: s.titulo,
      detalle: s.detalle,
      duracion_min: s.duracion_min,
      zona: s.zona,
      clave: s.clave,
      fase: semana.fase,
    })),
  );
}

// ── Fechas y horas locales ──────────────────────────────────────────

function zonaReal(tz: unknown): string {
  const z = zonaSegura(tz);
  if (z === 'auto') return 'Europe/Madrid';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return z;
  } catch {
    return 'Europe/Madrid';
  }
}

function desfaseMs(ms: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - ms;
}

/** El instante UTC de una fecha y hora locales de esa zona, con cambio de hora incluido. */
export function instanteLocal(fecha: string, hora: string, tz: string): number {
  const ingenuo = Date.parse(`${fecha}T${hora}:00Z`);
  const primero = ingenuo - desfaseMs(ingenuo, tz);
  return ingenuo - desfaseMs(primero, tz);
}

export function horaLocal(ms: number, tz: string): string {
  return new Date(ms + desfaseMs(ms, tz)).toISOString().slice(11, 16);
}

export { franjasOcupadas, horaEnPuntoSiguiente, tramoDelDia };

const horaDe = (iso: string) => iso.slice(11, 16);

function lineaVentana(v: Ventana): string {
  const c = v.clima;
  return (
    `${horaDe(v.inicio)} a ${horaDe(v.fin)} (nota ${v.puntuacion}): ` +
    `${c.temp ?? '?'} °C, lluvia hasta ${c.lluvia_prob ?? '?'} %, viento hasta ${c.viento_kmh ?? '?'} km/h. Motivos: ${v.motivos.join(', ')}.`
  );
}

/** El veredicto en texto para el modelo. La hora y la decisión ya están tomadas. */
export function textoVeredicto(v: VeredictoSalida, dolorZona: string | null): string {
  switch (v.tipo) {
    case 'salir':
      return [`Veredicto: salir. Mejor ventana ${lineaVentana(v.ventana)}`, ...v.alternativas.map((a) => `Alternativa: ${lineaVentana(a)}`)].join('\n');
    case 'suave':
      return [`Veredicto: solo suave (${v.motivo}), Z1 o Z2 y sin series. Ventana ${lineaVentana(v.ventana)}`, ...v.alternativas.map((a) => `Alternativa: ${lineaVentana(a)}`)].join('\n');
    case 'descanso':
      if (v.motivo === 'dolor') {
        return (
          `Veredicto: no salir, ha indicado dolor${dolorZona ? ` (${enLinea(dolorZona, 80)})` : ''}. ` +
          'NO le recomiendes salir ni entrenar esa zona y no diagnostiques: dile que pare y lo consulte con un profesional sanitario; urgencias si es grave (dolor en el pecho, mareo, falta de aire).'
        );
      }
      return `Veredicto: descanso (${v.motivo === 'sueno' ? 'ha dormido muy poco' : 'forma en riesgo y recuperación insuficiente'}). Hoy no se sale a entrenar.`;
    case 'sin_ventana':
      return v.motivo === 'clima'
        ? 'Veredicto: sin ventana segura por el tiempo. No propongas una hora: propón interior o moverlo de día.'
        : 'Veredicto: sin hueco en su horario para esa duración. No propongas una hora: propón acortarla o moverla de día.';
  }
}

// ── cuando_salir ────────────────────────────────────────────────────

export async function cuandoSalir(ctx: CtxResistencia, input: Record<string, unknown>): Promise<string> {
  const { sb, userId, today } = ctx;
  const fecha = input.dia === 'manana' ? sumarDias(today, 1) : today;
  const esHoy = fecha === today;

  const [perfilR, bienestarR, entrenosR, cuentaR, objetivoR, planR, eventosR] = await Promise.all([
    sb.from('entreno_perfil').select('fc_max, fc_reposo, fc_umbral, ubicacion_lat, ubicacion_lon, ubicacion_nombre, ubicacion_consentida_en').eq('user_id', userId).maybeSingle(),
    sb.from('entreno_bienestar').select('fecha, sueno_h, calidad, fatiga, dolor, dolor_zona').eq('user_id', userId).gte('fecha', sumarDias(today, -2)).lte('fecha', today),
    sb.from('entrenos_medidos').select('fecha, deporte, duracion_s, fc_media, rpe').eq('user_id', userId).gte('fecha', sumarDias(today, -180)).lte('fecha', today).limit(500),
    sb.from('profiles').select('timezone, wake_time, sleep_time').eq('id', userId).maybeSingle(),
    sb.from('objetivos_carrera').select('id').eq('user_id', userId).eq('activo', true).maybeSingle(),
    sb.from('day_plans').select('id').eq('user_id', userId).eq('date', fecha).maybeSingle(),
    sb.from('calendar_events').select('time').eq('user_id', userId).eq('date', fecha),
  ]);
  if (perfilR.error || bienestarR.error || entrenosR.error) {
    return 'No puedo leer sus datos de entreno ahora. No inventes un veredicto: dile que lo intente luego.';
  }

  const perfil = perfilR.data as (FilaPerfil & { ubicacion_lat: number | null; ubicacion_lon: number | null; ubicacion_nombre: string | null; ubicacion_consentida_en: string | null }) | null;
  const bienestar = (bienestarR.data ?? []) as FilaBienestar[];
  const cuenta = cuentaR.data as { timezone?: string; wake_time?: string; sleep_time?: string } | null;
  const objetivoId = (objetivoR.data as { id: string } | null)?.id;

  const sesionesR = objetivoId
    ? await sb.from('plan_sesiones').select('disciplina, titulo, duracion_min, zona, clave').eq('user_id', userId).eq('objetivo_id', objetivoId).eq('fecha', fecha)
    : { data: [] };
  const sesiones = (sesionesR.data ?? []) as { disciplina: string; titulo: string; duracion_min: number; zona: string | null; clave: boolean }[];
  const sesion = sesiones.find((s) => s.clave && s.disciplina !== 'descanso') ?? sesiones.find((s) => s.disciplina !== 'descanso') ?? null;

  const planId = (planR.data as { id: string } | null)?.id;
  const bloquesR = planId
    ? await sb.from('day_blocks').select('start_min, end_min, kind').eq('user_id', userId).eq('plan_id', planId)
    : { data: [] };

  const pedida = valor(input.disciplina);
  const porPlan: Record<string, ContextoSalida['disciplina']> = { carrera: 'carrera', bici: 'bici', brick: 'bici' };
  const disciplina = (pedida && DISCIPLINAS_SALIDA.includes(pedida) ? pedida : porPlan[sesion?.disciplina ?? ''] ?? (sesion ? 'otro' : 'carrera')) as ContextoSalida['disciplina'];
  const duracion = numeroPositivo(input.duracion_min) ?? (numeroPositivo(sesion?.duracion_min) ?? 60);

  const tz = zonaReal(cuenta?.timezone);
  const { desde, hasta } = tramoDelDia({ esHoy, ahora: horaLocal(Date.now(), tz), despertar: cuenta?.wake_time, dormir: cuenta?.sleep_time });

  const dolor = dolorVigente(bienestar, today);
  const deHoy = bienestar.find((b) => b.fecha === today);
  const forma = formaDe((entrenosR.data ?? []) as Parameters<typeof formaDe>[0], perfil, today);
  const contexto: ContextoSalida = {
    disciplina,
    duracion_min: duracion,
    estado_forma: forma.estado,
    sueno_h: deHoy?.sueno_h === null || deHoy?.sueno_h === undefined ? null : Number(deHoy.sueno_h),
    fatiga: deHoy?.fatiga === null || deHoy?.fatiga === undefined ? null : Number(deHoy.fatiga),
    dolor: dolor !== null,
    franjas_ocupadas: franjasOcupadas(
      ((bloquesR.data ?? []) as { start_min: number; end_min: number; kind: string }[]),
      ((eventosR.data ?? []) as { time: string | null }[]),
    ),
    desde,
    hasta,
  };

  const cabecera = `${esHoy ? 'Hoy' : 'Mañana'} (${fecha}), ${disciplina}, ${Math.round(duracion)} min.`;
  const pie =
    `Datos: forma ${forma.estado}, sueño ${contexto.sueno_h ?? 'sin dato'} h, fatiga ${contexto.fatiga ?? 'sin dato'} de 5.` +
    (sesion ? ` Plan: ${enLinea(sesion.titulo, 100)} (${sesion.disciplina}, ${Math.round(Number(sesion.duracion_min))} min${sesion.zona ? `, ${sesion.zona}` : ''}).` : '') +
    (sesion?.disciplina === 'natacion' && !pedida ? ' La sesión es de natación: en piscina el tiempo no importa.' : '');

  // Con dolor no se mira el cielo: ni siquiera se pregunta la previsión.
  let horas: HoraClima[] = [];
  if (!contexto.dolor) {
    if (!perfil || perfil.ubicacion_lat === null || perfil.ubicacion_lon === null || !perfil.ubicacion_consentida_en) {
      return `${cabecera}\nSin ubicación guardada con su permiso: no hay previsión. Dile que elija su ciudad en Resistencia. No inventes el tiempo.\n${pie}`;
    }
    const previstas = await fetchPrevision(Number(perfil.ubicacion_lat), Number(perfil.ubicacion_lon), tz);
    if (!previstas) return `${cabecera}\nLa previsión no está disponible ahora. No inventes el tiempo ni una hora.\n${pie}`;
    horas = previstas.filter((h) => h.hora.startsWith(fecha));
  }

  return `${cabecera}\n${textoVeredicto(mejorVentana(horas, contexto), dolor?.dolor_zona ?? null)}\n${pie}`;
}

// ── fijar_carrera ───────────────────────────────────────────────────

export async function fijarCarrera(ctx: CtxResistencia, input: Record<string, unknown>): Promise<string> {
  const { sb, userId, today } = ctx;
  const tipo = String(input.tipo) as TipoPrueba;
  if (!TIPOS_PRUEBA.includes(tipo)) throw new Error(`Tipo de prueba desconocido: ${input.tipo}`);
  const nivel = String(input.nivel) as 'principiante' | 'intermedio' | 'avanzado';
  if (!NIVELES_CARRERA.includes(nivel)) throw new Error(`Nivel desconocido: ${input.nivel}`);
  const fecha = fechaValida(input.fecha);
  if (fecha <= today) throw new Error('La carrera tiene que ser en el futuro.');
  if (fecha > sumarDias(today, 730)) throw new Error('Más de dos años vista no se planifica todavía.');
  const horas = Number(input.horas_semana);
  if (!(horas >= 2 && horas <= 30)) throw new Error(`${input.horas_semana} horas por semana está fuera de rango (2 a 30).`);

  let distancias: DistanciasPrueba | undefined;
  if (tipo === 'otra') {
    distancias = {
      natacion_m: Math.max(0, Number(input.natacion_m) || 0),
      bici_m: Math.max(0, Number(input.bici_m) || 0),
      carrera_m: Math.max(0, Number(input.carrera_m) || 0),
    };
    if (!distancias.natacion_m && !distancias.bici_m && !distancias.carrera_m) {
      throw new Error('Una prueba de tipo otra necesita al menos una distancia en metros.');
    }
  }
  const metros = distancias ?? DISTANCIAS[tipo as Exclude<TipoPrueba, 'otra'>];

  const plan = generarPlan({ tipo, fecha_prueba: fecha, hoy: today, horas_semana: horas, distancias, nivel });
  if (!plan.semanas.length) throw new Error(plan.aviso ?? 'No se ha podido calcular el plan.');

  // Mismo orden que crearObjetivo en la app: si algo falla, se deshace.
  const { data: previo, error: e0 } = await sb.from('objetivos_carrera').select('id').eq('user_id', userId).eq('activo', true).maybeSingle();
  if (e0) throw e0;
  const previoId = (previo as { id: string } | null)?.id;
  const reactivar = async () => {
    if (previoId) await sb.from('objetivos_carrera').update({ activo: true }).eq('id', previoId).eq('user_id', userId).then(() => {}, () => {});
  };
  if (previoId) {
    const { error } = await sb.from('objetivos_carrera').update({ activo: false }).eq('id', previoId).eq('user_id', userId);
    if (error) throw error;
  }

  const { data: nuevo, error: e1 } = await sb
    .from('objetivos_carrera')
    .insert({
      user_id: userId, tipo, nombre: valor(input.nombre)?.slice(0, 120) ?? null, fecha,
      natacion_m: metros.natacion_m, bici_m: metros.bici_m, carrera_m: metros.carrera_m,
      horas_semana: horas, nivel, activo: true,
    })
    .select('id')
    .single();
  if (e1) {
    await reactivar();
    throw e1;
  }
  const objetivoId = (nuevo as { id: string }).id;
  const filas = filasDelPlan(plan, userId, objetivoId);
  const { error: e2 } = await sb.from('plan_sesiones').insert(filas);
  if (e2) {
    await sb.from('objetivos_carrera').delete().eq('id', objetivoId).eq('user_id', userId);
    await reactivar();
    throw e2;
  }
  return (
    `Carrera fijada (id ${objetivoId}): ${tipo} el ${fecha}. Plan de ${plan.semanas.length} semanas y ${filas.length} sesiones.` +
    (previoId ? ' La carrera anterior queda desactivada.' : '') +
    (plan.aviso ? ` Aviso: ${plan.aviso}` : '')
  );
}

// ── ajustar_sesion_plan ─────────────────────────────────────────────

function lunesDe(fecha: string): number {
  const d = Date.parse(`${fecha}T00:00:00Z`);
  return d - ((new Date(d).getUTCDay() + 6) % 7) * 86400000;
}

export async function ajustarSesionPlan(ctx: CtxResistencia, input: Record<string, unknown>): Promise<string> {
  const { sb, userId, today } = ctx;
  const id = valor(input.sesion_id);
  if (!id) throw new Error('Falta el id de la sesión.');
  const nota = enLinea(input.motivo, 1000);
  if (!nota) throw new Error('Un cambio en el plan necesita su motivo.');

  const { data: fila, error: e0 } = await sb
    .from('plan_sesiones')
    .select('id, objetivo_id, semana, fecha, hecha_entreno_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (e0) throw e0;
  const sesion = fila as { id: string; objetivo_id: string; semana: number; fecha: string; hecha_entreno_id: string | null } | null;
  if (!sesion) throw new Error(`No existe la sesión ${id}. Los ids salen en el estudio o en consultar_historial con que=plan.`);
  if (sesion.hecha_entreno_id) throw new Error('Esa sesión ya está hecha: lo que pasó no se reescribe.');

  const patch: Record<string, unknown> = { editada_por_coach: true, nota_coach: nota };
  const titulo = valor(input.titulo);
  if (titulo) patch.titulo = enLinea(titulo, 160);
  const detalle = valor(input.detalle);
  if (detalle) patch.detalle = String(detalle).slice(0, 2000);

  const disciplina = valor(input.disciplina);
  if (disciplina) {
    if (!DISCIPLINAS_PLAN.includes(disciplina)) throw new Error(`Disciplina desconocida: ${disciplina}`);
    patch.disciplina = disciplina;
  }
  const duracion = Number(input.duracion_min) || 0;
  if (duracion < 0 || duracion > 2880) throw new Error(`Duración fuera de rango: ${input.duracion_min}`);
  if (duracion > 0) patch.duracion_min = duracion;
  const zona = valor(input.zona);
  if (zona) patch.zona = zona === 'ninguna' ? null : zona;
  if (disciplina === 'descanso') {
    patch.duracion_min = 0;
    patch.zona = null;
  }

  const fecha = valor(input.fecha);
  if (fecha) {
    const nueva = fechaValida(fecha);
    if (nueva < today) throw new Error('No se mueve una sesión al pasado.');
    const { data: obj, error: e1 } = await sb.from('objetivos_carrera').select('fecha').eq('id', sesion.objetivo_id).eq('user_id', userId).maybeSingle();
    if (e1) throw e1;
    const limite = (obj as { fecha: string } | null)?.fecha;
    if (limite && nueva > limite) throw new Error(`La carrera es el ${limite}: no se programa nada después.`);
    patch.fecha = nueva;
    patch.semana = Math.max(1, sesion.semana + Math.round((lunesDe(nueva) - lunesDe(sesion.fecha)) / (7 * 86400000)));
  }

  if (Object.keys(patch).length === 2) return 'Nada que cambiar: no has rellenado ningún campo.';
  const { error } = await sb.from('plan_sesiones').update(patch).eq('id', id).eq('user_id', userId);
  if (error) throw error;
  const cambios = Object.keys(patch).filter((k) => k !== 'editada_por_coach' && k !== 'nota_coach' && k !== 'semana');
  return `Sesión ${id} ajustada: ${cambios.join(', ')}.`;
}

// ── registrar_entreno ───────────────────────────────────────────────

async function enlazarPlan(ctx: CtxResistencia, entrenoId: string, fecha: string, deporte: string): Promise<void> {
  const { sb, userId } = ctx;
  try {
    const { data: obj } = await sb.from('objetivos_carrera').select('id').eq('user_id', userId).eq('activo', true).maybeSingle();
    if (!obj) return;
    const { data } = await sb
      .from('plan_sesiones')
      .select('id, disciplina, clave, hecha_entreno_id')
      .eq('user_id', userId)
      .eq('objetivo_id', (obj as { id: string }).id)
      .eq('fecha', fecha);
    const sesion = elegirSesionPlan((data ?? []) as { id: string; disciplina: string; clave: boolean; hecha_entreno_id: string | null }[], deporte);
    if (sesion) await sb.from('plan_sesiones').update({ hecha_entreno_id: entrenoId }).eq('id', sesion.id).eq('user_id', userId);
  } catch {
    /* el entreno ya cuenta; la sesión se puede enlazar aparte */
  }
}

function resumenEntreno(deporte: string, km: number | null, min: number, fecha: string): string {
  return `${deporte}${km ? ` ${Math.round(km * 100) / 100} km` : ''} en ${Math.round(min)} min el ${fecha}`;
}

export async function registrarEntreno(ctx: CtxResistencia, input: Record<string, unknown>, puertas: PuertasXp): Promise<string> {
  const { sb, userId, today } = ctx;
  const deporte = String(input.deporte) as DeporteEntreno;
  if (!DEPORTES_REGISTRO.includes(deporte)) throw new Error(`Deporte desconocido: ${input.deporte}`);
  const fecha = valor(input.fecha) ? fechaValida(input.fecha) : today;
  if (fecha > today) throw new Error('No se registra lo que todavía no ha pasado.');

  const minutos = Number(input.duracion_min);
  if (!(minutos >= 1 && minutos <= 2880)) throw new Error(`${input.duracion_min} minutos no es una duración válida. Pregúntale cuánto duró.`);
  const duracion_s = Math.round(minutos * 60);
  const km = numeroPositivo(input.distancia_km);
  if (km !== null && km > 1000) throw new Error(`${input.distancia_km} km no es una distancia válida.`);
  const hora = valor(input.hora);
  if (hora && !HHMM.test(hora)) throw new Error(`Hora inválida: ${hora} (HH:MM en 24h)`);

  const kind = tipoCardioDe(deporte);
  // Igual que la app (`decidirPago`): solo hoy y desde cinco minutos.
  const pagable = kind !== null && fecha === today && duracion_s >= 300;

  // «Te he subido la carrera» ya está en la tabla: no se apunta otra vez.
  if (kind && input.es_otra_sesion !== true) {
    const { data: consta, error } = await sb
      .from('cardio_sessions')
      .select('distance_km, duration_min')
      .eq('user_id', userId)
      .eq('date', fecha)
      .eq('kind', kind)
      .maybeSingle();
    if (error) throw error;
    if (consta) {
      const c = consta as { distance_km: number | null; duration_min: number };
      return (
        `Ya consta ${kind} el ${fecha}: ${c.distance_km ?? 'sin'} km en ${c.duration_min} min. No se ha apuntado nada. ` +
        'Si de verdad es OTRA sesión distinta ese día, vuelve a llamar con es_otra_sesion=true.'
      );
    }
  }

  const [cuentaR, perfilR] = await Promise.all([
    sb.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
    sb.from('entreno_perfil').select('fc_max, fc_reposo, fc_umbral').eq('user_id', userId).maybeSingle(),
  ]);
  const tz = zonaReal((cuentaR.data as { timezone?: string } | null)?.timezone);

  const ahora = Date.now();
  let inicioMs: number;
  if (hora) inicioMs = instanteLocal(fecha, hora, tz);
  else if (fecha === today) inicioMs = ahora - duracion_s * 1000;
  else inicioMs = instanteLocal(fecha, '12:00', tz);
  const finMs = inicioMs + duracion_s * 1000;
  if (finMs > ahora + 5 * 60 * 1000) throw new Error('A esa hora el entreno aún no ha terminado: no se registra lo que no ha pasado.');

  const fc = numeroPositivo(input.fc_media);
  const distancia_m = km === null ? null : Math.round(km * 1000);
  // Determinista a propósito: si el modelo repite la llamada, no hay dos filas.
  const llave = externoManual(`coach-${fecha}-${deporte}-${hora ?? ''}-${duracion_s}-${distancia_m ?? 0}`);
  const normal = normalizarEntreno({
    origen: 'manual',
    externo_id: llave,
    deporte,
    inicio: new Date(inicioMs).toISOString(),
    fin: new Date(finMs).toISOString(),
    duracion_s,
    distancia_m,
    kcal: null,
    fc_media: fc,
    fc_max: null,
    desnivel_m: numeroPositivo(input.desnivel_m),
    ruta: null,
    parciales: [],
    largo_piscina_m: deporte === 'piscina' ? numeroPositivo(input.largo_piscina_m) : null,
  });
  if (!normal.ok) throw new Error(`Entreno no válido: ${normal.motivo}.`);
  const e = normal.entreno;

  const rpeN = Number(input.rpe);
  const rpe = Number.isFinite(rpeN) && rpeN >= 1 && rpeN <= 10 ? rpeN : null;
  const notas = valor(input.notas)?.slice(0, 2000) ?? null;

  const { data: creado, error: e1 } = await sb
    .from('entrenos_medidos')
    .upsert(
      {
        user_id: userId, origen: e.origen, externo_id: e.externo_id, deporte: e.deporte, fecha, inicio: e.inicio, fin: e.fin,
        duracion_s: e.duracion_s, distancia_m: e.distancia_m, kcal: e.kcal, fc_media: e.fc_media, fc_max: e.fc_max,
        desnivel_m: e.desnivel_m, ruta: null, parciales: [], fc_serie: null, largo_piscina_m: e.largo_piscina_m, rpe, notas,
      },
      { onConflict: 'user_id,externo_id', ignoreDuplicates: true },
    )
    .select('id');
  if (e1) throw e1;
  const entrenoId = ((creado ?? []) as { id: string }[])[0]?.id;
  if (!entrenoId) return 'Ese entreno ya estaba registrado. No se duplica ni se paga dos veces.';

  const resumen = resumenEntreno(deporte, km, minutos, fecha);
  if (!kind) {
    await enlazarPlan(ctx, entrenoId, fecha, deporte);
    return `Entreno registrado: ${resumen}. Cuenta para la carga. La fuerza no paga aquí: el acto real es la sesión del gimnasio.`;
  }
  if (!pagable) {
    await enlazarPlan(ctx, entrenoId, fecha, deporte);
    return `Entreno registrado: ${resumen}. Se guarda y cuenta para la carga, pero no paga XP: solo pagan las sesiones de hoy de al menos cinco minutos.`;
  }

  // El acto primero: si esto falla, se deshace la fila para que se pueda reintentar.
  let base = 0;
  let yaConstaba = false;
  let primera = true;
  let espejo = null as unknown as EspejoFila<string, string>;
  const guardarEspejo = async (f: typeof espejo) => {
    const { xp, ...resto } = f;
    const { error } = await sb.from('cardio_sessions').upsert({ user_id: userId, ...resto, xp_awarded: xp }, { onConflict: 'user_id,date,kind' });
    if (error) throw error;
  };
  try {
    const { data: delDia, error } = await sb
      .from('cardio_sessions')
      .select('kind, xp_awarded, distance_km, duration_min, avg_hr, rpe, zone, notes')
      .eq('user_id', userId)
      .eq('date', fecha);
    if (error) throw error;
    const filas = (delDia ?? []) as { kind: string; xp_awarded: number; distance_km: number | null; duration_min: number; avg_hr: number | null; rpe: number | null; zone: string; notes: string | null }[];
    // Ese día ya hay cardio de ese tipo: no se reescribe ni se cobra otra vez.
    yaConstaba = filas.some((f) => f.kind === kind);
    if (!yaConstaba) {
      primera = !filas.some((f) => f.kind !== 'caminar');
      base = cardioXp(kind, filas.reduce((a, f) => a + Number(f.xp_awarded ?? 0), 0));
      const perfil = perfilR.data as FilaPerfil | null;
      const limites = perfil ? limitesZonas({ fc_max: perfil.fc_max, fc_reposo: perfil.fc_reposo, umbral: perfil.fc_umbral }) : null;
      const zona = (e.fc_media !== null && limites ? zonaDe(e.fc_media, limites) : null) ?? 'libre';
      espejo = espejoCardio<string, string>({
        date: fecha,
        kind,
        distance_km: e.distancia_m === null ? null : e.distancia_m / 1000,
        duration_min: e.duracion_s / 60,
        avg_hr: e.fc_media,
        rpe,
        zone: zona,
        notes: notas,
        // Nada pagado aún: el XP se apunta cuando la RPC lo confirma.
        xp: 0,
      });
      await guardarEspejo(espejo);
    }
  } catch (err) {
    await sb.from('entrenos_medidos').delete().eq('id', entrenoId).eq('user_id', userId).then(() => {}, () => {});
    throw err;
  }

  if (yaConstaba) {
    await enlazarPlan(ctx, entrenoId, fecha, deporte);
    return `Entreno registrado: ${resumen}. Ese día ya había una sesión de ese tipo: no se reescribe ni vuelve a pagar.`;
  }

  let eco: EcoActo | null = null;
  let nuevo = 0;
  let pagado = 0;
  try {
    // Un paseo no salda un «Correr 5 km»: como en la app.
    if (kind !== 'caminar') eco = await puertas.propagarActo(ctx, 'cardio', { desglose: true, deporte });
    nuevo = puertas.restoDelModulo(base, descuentoEco(eco, primera));
    if (nuevo > 0) {
      const { data: antes } = await sb.from('profiles').select('xp_total').eq('id', userId).maybeSingle();
      const { data: despues, error } = await sb.rpc('award_xp', {
        p_amount: nuevo,
        p_stat: 'FUE',
        p_event: 'cardio_session',
        p_payload: { kind, km: espejo.distance_km, min: espejo.duration_min, zone: espejo.zone, via: 'coach', date: fecha, entreno_id: entrenoId },
      });
      if (error) throw error;
      const a = Number((antes as { xp_total?: number } | null)?.xp_total);
      const d = Number((despues as { xp_total?: number } | null)?.xp_total);
      pagado = Number.isFinite(a) && Number.isFinite(d) ? xpPagado(nuevo, a, d) : nuevo;
    }
    // Se apunta lo PAGADO: de ahí sale el tope diario de cardio.
    if (pagado > 0) await guardarEspejo({ ...espejo, xp: pagado });
    if (pagado > 0) await sb.from('entrenos_medidos').update({ xp_awarded: pagado }).eq('id', entrenoId).eq('user_id', userId);
  } catch {
    // Si la RPC confirmó y se perdió la respuesta, se apunta lo que entró de verdad.
    const { data: evento } = await sb.from('events').select('payload').eq('user_id', userId).eq('type', 'cardio_session').contains('payload', { entreno_id: entrenoId }).limit(1);
    const cobrado = Number((evento?.[0] as { payload?: { xp?: unknown } } | undefined)?.payload?.xp) || 0;
    if (cobrado > 0) {
      await guardarEspejo({ ...espejo, xp: cobrado }).then(() => {}, () => {});
      await sb.from('entrenos_medidos').update({ xp_awarded: cobrado }).eq('id', entrenoId).eq('user_id', userId).then(() => {}, () => {});
    }
    await enlazarPlan(ctx, entrenoId, fecha, deporte);
    return `Entreno registrado: ${resumen}. El XP no se ha podido confirmar: no le digas una cifra.${eco?.texto ?? ''}`;
  }

  await enlazarPlan(ctx, entrenoId, fecha, deporte);
  const xp = pagado > 0
    ? ` +${pagado} XP.`
    : nuevo === 0 && base > 0
      ? ' El XP ya lo pagó la misión enlazada.'
      : ` Sin XP: el cardio de ese día ya está en su tope de ${CARDIO_DAILY_CAP}.`;
  return `Entreno registrado: ${resumen}.${xp}${eco?.texto ?? ''}`;
}

// ── consultar_dia ───────────────────────────────────────────────────

/** El detalle medido de una fecha y la anterior. El resumen ya va en la línea Cardio. */
export async function lineasEntrenosMedidos(sb: Db, userId: string, fecha: string): Promise<string> {
  try {
    const { data, error } = await sb
      .from('entrenos_medidos')
      .select('fecha, deporte, origen, duracion_s, distancia_m, fc_media, desnivel_m, rpe')
      .eq('user_id', userId)
      .gte('fecha', sumarDias(fecha, -1))
      .lte('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(20);
    if (error || !data?.length) return '';
    const lineas = (data as Record<string, unknown>[]).map((e) =>
      [
        `- ${e.fecha} ${e.deporte} (${e.origen})`,
        e.distancia_m ? `${Math.round(Number(e.distancia_m) / 10) / 100} km` : null,
        `${Math.round(Number(e.duracion_s) / 60)} min`,
        e.fc_media ? `${Math.round(Number(e.fc_media))} ppm` : null,
        e.desnivel_m ? `${Math.round(Number(e.desnivel_m))} m+` : null,
        e.rpe ? `RPE ${e.rpe}` : null,
      ].filter(Boolean).join(', '),
    );
    return `\nEntrenos medidos (detalle; el de cardio ya está sumado en la línea Cardio, no lo cuentes dos veces):\n${lineas.join('\n')}`;
  } catch {
    return '';
  }
}
