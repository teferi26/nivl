// Demo de la galería /kit/resistencia (solo desarrollo): un triatleta ficticio
// preparando un olímpico a diez semanas, con dieciséis semanas de historial.
//
// Todo es determinista: un generador con semilla y fechas fijas, sin Date.now ni
// Math.random, así que dos capturas de la galería salen iguales. Los números no
// se inventan: el plan, la carga, las zonas y los récords salen de las mismas
// funciones puras que usa la app, y cada entreno pasa por `normalizarEntreno`.
//
// La ruta es una curva cerrada alrededor del Retiro, sin relación con nadie.

import { addDays } from '@/lib/dates';
import { normalizarEntreno, type DeporteEntreno, type MuestraFc, type Parcial, type PuntoRuta } from '@/lib/entrenoMedido';
import { desnivelPositivo, distanciaRuta, parcialesDeRuta, recordsPersonales } from '@/lib/entrenomath';
import type { HoraClima } from '@/lib/mejorHora';
import { DISTANCIAS, generarPlan } from '@/lib/planCarrera';
import type { Bienestar, EntrenoFila, ObjetivoCarrera, PerfilEntreno, PlanSesionFila } from '@/lib/resistencia';
import { elegirSesionPlan, filasDelPlan } from '@/lib/resistenciaPura';
import { vistaCarrera, type CarreraVistaProps } from './CarreraVista';
import type { DetalleVistaProps } from './DetalleVista';
import { FORM_INICIAL, previaPlan, SIN_ERRORES, type HojaObjetivoProps } from './HojaObjetivo';
import { construirSalida, type HubVistaProps } from './HubVista';
import { datosProgreso, type PesoVista, type ProgresoVistaProps } from './ProgresoVista';

const nada = () => {};
const U = 'demo';

export const DEMO_HOY = '2026-10-21';
export const DEMO_CARRERA = '2026-12-27';
/** El plan arrancó hace dos semanas: así se ven sesiones ya hechas. */
const INICIO_PLAN = '2026-10-05';
const LUNES_ACTUAL = '2026-10-19';
const SEMANAS_HISTORIAL = 16;

export const DEMO_PERFIL: PerfilEntreno = {
  fc_max: 188,
  fc_reposo: 52,
  fc_umbral: 168,
  ftp_w: 225,
  css_seg_100m: 108,
  ubicacion_lat: 40.42,
  ubicacion_lon: -3.68,
  ubicacion_nombre: 'Madrid',
  ubicacion_consentida_en: '2026-06-29T08:00:00.000Z',
};

/** mulberry32: un generador pequeño y reproducible. */
function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CENTRO = { lat: 40.4153, lon: -3.6845 };
const M_POR_GRADO = 111320;
const ALTITUD = 660;

interface Curva {
  radio: number;
  desnivel: number;
  fase: number;
  x: number[];
  y: number[];
  acumulada: number[];
  largo: number;
}

const PASOS_CURVA = 1440;

function curva(radio: number, desnivel: number, fase: number): Curva {
  const x: number[] = [];
  const y: number[] = [];
  const acumulada: number[] = [0];
  for (let i = 0; i <= PASOS_CURVA; i++) {
    const th = (i / PASOS_CURVA) * 2 * Math.PI;
    const r = radio * (1 + 0.16 * Math.sin(3 * th + fase) + 0.07 * Math.sin(7 * th + fase * 2));
    x.push(r * Math.cos(th));
    y.push(0.78 * r * Math.sin(th));
    if (i > 0) acumulada.push(acumulada[i - 1]! + Math.hypot(x[i]! - x[i - 1]!, y[i]! - y[i - 1]!));
  }
  return { radio, desnivel, fase, x, y, acumulada, largo: acumulada[PASOS_CURVA]! };
}

/** Un punto de la curva a `s` metros de la salida, con el ruido de un GPS. */
function puntoEn(c: Curva, s: number, t: number, azar: () => number): PuntoRuta {
  const d = s % c.largo;
  let bajo = 0;
  let alto = PASOS_CURVA;
  while (alto - bajo > 1) {
    const medio = (bajo + alto) >> 1;
    if (c.acumulada[medio]! <= d) bajo = medio;
    else alto = medio;
  }
  const th = (bajo / PASOS_CURVA) * 2 * Math.PI;
  const ruido = () => (azar() - 0.5) * 2.4;
  const lat = CENTRO.lat + (c.y[bajo]! + ruido()) / M_POR_GRADO;
  const lon = CENTRO.lon + (c.x[bajo]! + ruido()) / (M_POR_GRADO * Math.cos((CENTRO.lat * Math.PI) / 180));
  const alt = ALTITUD + c.desnivel * Math.sin(2 * th + c.fase) + (c.desnivel / 3) * Math.sin(5 * th) + (azar() - 0.5) * 0.8;
  return { t, lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)), alt: Number(alt.toFixed(1)) };
}

interface Tramos {
  /** Reparto del esfuerzo: 1 es el ritmo medio de la sesión. */
  ritmo: (t: number) => number;
  /** El pulso al que tiende el corazón en ese momento. */
  pulso: (t: number) => number;
}

function continuo(pulso: number): Tramos {
  return { ritmo: (t) => 1 + 0.03 * Math.sin(t / 95), pulso: () => pulso };
}

function series(duracion: number): Tramos {
  const calentar = 600;
  const calma = 480;
  const fuerte = (t: number) => t >= calentar && t < duracion - calma && (t - calentar) % 300 < 180;
  return {
    ritmo: (t) => (t < calentar || t >= duracion - calma ? 0.84 : fuerte(t) ? 1.2 : 0.8),
    pulso: (t) => (t < calentar || t >= duracion - calma ? 138 : fuerte(t) ? 176 : 146),
  };
}

function serieFc(duracion: number, tramos: Tramos, azar: () => number): MuestraFc[] {
  const salida: MuestraFc[] = [];
  let actual = 92;
  for (let t = 0; t <= duracion; t += 30) {
    const deriva = (t / duracion) * 5;
    actual += (tramos.pulso(t) + deriva - actual) * 0.35;
    salida.push({ t, bpm: Math.round(actual + (azar() - 0.5) * 3) });
  }
  return salida;
}

function rutaDe(c: Curva, duracion: number, velocidad: number, cada: number, tramos: Tramos, azar: () => number): PuntoRuta[] {
  const ruta: PuntoRuta[] = [];
  let s = azar() * c.largo;
  for (let t = 0; t <= duracion; t += cada) {
    ruta.push(puntoEn(c, s, t, azar));
    s += velocidad * tramos.ritmo(t) * cada * (1 + (azar() - 0.5) * 0.04);
  }
  return ruta;
}

interface Bruto {
  deporte: DeporteEntreno;
  duracion_s: number;
  distancia_m: number | null;
  fc_serie: MuestraFc[] | null;
  ruta: PuntoRuta[] | null;
  parciales: Parcial[];
  largo_piscina_m: number | null;
  desnivel_m: number | null;
  fc_media: number | null;
  fc_max: number | null;
}

function fila(fecha: string, hora: string, b: Bruto, rpe: number, azar: () => number): EntrenoFila {
  const inicio = `${fecha}T${hora}:00.000Z`;
  const r = normalizarEntreno({
    origen: 'watch',
    externo_id: `demo:${fecha}:${b.deporte}`,
    deporte: b.deporte,
    inicio,
    fin: new Date(Date.parse(inicio) + b.duracion_s * 1000).toISOString(),
    duracion_s: b.duracion_s,
    distancia_m: b.distancia_m,
    kcal: Math.round((b.duracion_s / 3600) * (520 + azar() * 160)),
    fc_media: b.fc_media,
    fc_max: b.fc_max,
    desnivel_m: b.desnivel_m,
    ruta: b.ruta,
    parciales: b.parciales,
    largo_piscina_m: b.largo_piscina_m,
    fc_serie: b.fc_serie,
  });
  if (!r.ok) throw new Error(`demo: ${r.motivo}`);
  return { ...r.entreno, id: `demo-${fecha}-${b.deporte}`, user_id: U, fecha, rpe, notas: null, xp_awarded: 0 };
}

function mediasFc(serie: MuestraFc[]): { fc_media: number; fc_max: number } {
  return {
    fc_media: Math.round(serie.reduce((a, m) => a + m.bpm, 0) / serie.length),
    fc_max: Math.max(...serie.map((m) => m.bpm)),
  };
}

function exterior(deporte: 'carrera' | 'bici', c: Curva, duracion: number, velocidad: number, tramos: Tramos, azar: () => number): Bruto {
  const fc_serie = serieFc(duracion, tramos, azar);
  const ruta = rutaDe(c, duracion, velocidad, deporte === 'carrera' ? 10 : 15, tramos, azar);
  return {
    deporte,
    duracion_s: duracion,
    distancia_m: Math.round(distanciaRuta(ruta)),
    desnivel_m: Math.round(desnivelPositivo(ruta)),
    ruta,
    fc_serie,
    parciales: parcialesDeRuta(ruta, deporte === 'carrera' ? 1000 : 5000, fc_serie),
    largo_piscina_m: null,
    ...mediasFc(fc_serie),
  };
}

function piscina(metros: number, seg100: number, azar: () => number): Bruto {
  const LARGO = 25;
  const parciales: Parcial[] = [];
  let total = 0;
  for (let n = 1; n <= Math.round(metros / LARGO); n++) {
    const duracion_s = Math.round((seg100 / 4 + (azar() - 0.5) * 3) * 10) / 10;
    total += duracion_s;
    parciales.push({ n, tipo: 'largo', distancia_m: LARGO, duracion_s, fc_media: null, desnivel_m: null });
  }
  const duracion = Math.round(total);
  const fc_serie = serieFc(duracion, continuo(136), azar);
  return {
    deporte: 'piscina',
    duracion_s: duracion,
    distancia_m: parciales.length * LARGO,
    desnivel_m: null,
    ruta: null,
    fc_serie,
    parciales,
    largo_piscina_m: LARGO,
    ...mediasFc(fc_serie),
  };
}

function fuerza(duracion: number): Bruto {
  return {
    deporte: 'fuerza',
    duracion_s: duracion,
    distancia_m: null,
    desnivel_m: null,
    ruta: null,
    fc_serie: null,
    parciales: [],
    largo_piscina_m: null,
    fc_media: 112,
    fc_max: 138,
  };
}

function generarEntrenos(): EntrenoFila[] {
  const azar = generador(20261227);
  const circuito = curva(520, 7, 0.6);
  const carretera = curva(5200, 26, 1.9);
  const salida: EntrenoFila[] = [];
  const primerLunes = addDays(LUNES_ACTUAL, -SEMANAS_HISTORIAL * 7);

  for (let w = 0; w < SEMANAS_HISTORIAL; w++) {
    const lunes = addDays(primerLunes, w * 7);
    const descarga = w % 4 === 3;
    const f = (0.62 + (0.38 * w) / (SEMANAS_HISTORIAL - 1)) * (descarga ? 0.7 : 1);
    const mejora = 1 + (0.06 * w) / (SEMANAS_HISTORIAL - 1);
    const faltaUna = () => w < SEMANAS_HISTORIAL - 1 && azar() < 0.07;
    const rpe = (base: number) => Math.min(10, base + Math.round(azar() * 2));

    if (w % 2 === 0 && !faltaUna()) salida.push(fila(lunes, '18:00', fuerza(Math.round(2400 + azar() * 600)), rpe(5), azar));
    if (!faltaUna()) salida.push(fila(addDays(lunes, 1), '18:30', piscina(Math.round((2200 * f) / 25) * 25, 118 / mejora, azar), rpe(5), azar));
    if (!faltaUna()) {
      const d = Math.round(3000 * f + 900);
      salida.push(fila(addDays(lunes, 2), '07:00', exterior('carrera', circuito, d, 3.05 * mejora, series(d), azar), rpe(7), azar));
    }
    if (!faltaUna()) {
      salida.push(fila(addDays(lunes, 3), '07:00', exterior('bici', carretera, Math.round(3600 * f), 8.2 * mejora, continuo(142), azar), rpe(5), azar));
    }
    if (!faltaUna()) salida.push(fila(addDays(lunes, 4), '18:30', piscina(Math.round((1800 * f) / 25) * 25, 122 / mejora, azar), rpe(4), azar));
    if (!faltaUna()) {
      salida.push(fila(addDays(lunes, 5), '08:30', exterior('bici', carretera, Math.round(7200 * f), 7.7 * mejora, continuo(136), azar), rpe(5), azar));
    }
    if (!faltaUna()) {
      salida.push(fila(addDays(lunes, 6), '08:30', exterior('carrera', circuito, Math.round(4300 * f), 2.95 * mejora, continuo(148), azar), rpe(5), azar));
    }
  }
  // Esta semana, hasta ayer: hoy aún no se ha entrenado.
  salida.push(fila(LUNES_ACTUAL, '18:00', fuerza(2520), 5, azar));
  salida.push(fila(addDays(LUNES_ACTUAL, 1), '18:30', piscina(2200, 112, azar), 6, azar));
  return salida.sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
}

function generarPesos(): PesoVista[] {
  const azar = generador(74);
  const pesos: PesoVista[] = [];
  const dias = SEMANAS_HISTORIAL * 7;
  for (let i = 0; i <= dias; i += 4) {
    const fecha = addDays(DEMO_HOY, i - dias);
    const kg = 75.2 - (1.9 * i) / dias + (azar() - 0.5) * 0.6;
    pesos.push({ fecha, kg: Math.round(kg * 10) / 10 });
  }
  return pesos;
}

const OBJETIVO: ObjetivoCarrera = {
  id: 'objetivo-demo',
  user_id: U,
  tipo: 'olimpico',
  nombre: 'Olímpico de invierno',
  fecha: DEMO_CARRERA,
  natacion_m: DISTANCIAS.olimpico.natacion_m,
  bici_m: DISTANCIAS.olimpico.bici_m,
  carrera_m: DISTANCIAS.olimpico.carrera_m,
  horas_semana: 8,
  nivel: 'intermedio',
  activo: true,
  created_at: `${INICIO_PLAN}T09:00:00.000Z`,
};

function generarFilasPlan(entrenos: readonly EntrenoFila[]): PlanSesionFila[] {
  const plan = generarPlan({
    tipo: OBJETIVO.tipo,
    fecha_prueba: OBJETIVO.fecha,
    hoy: INICIO_PLAN,
    horas_semana: OBJETIVO.horas_semana,
    nivel: OBJETIVO.nivel,
  });
  const filas = filasDelPlan(plan, U, OBJETIVO.id).map(
    (f, i): PlanSesionFila => ({
      ...f,
      id: `sesion-${i}`,
      hecha_entreno_id: null,
      editada_por_coach: false,
      nota_coach: null,
      created_at: OBJETIVO.created_at,
    }),
  );
  // Lo que ya se hizo salda su sesión con la misma regla que al guardar.
  for (const e of entrenos.slice().reverse()) {
    const sesion = elegirSesionPlan(
      filas.filter((f) => f.fecha === e.fecha),
      e.deporte,
    );
    if (sesion) sesion.hecha_entreno_id = e.id;
  }
  const proxima = filas.find((f) => f.fecha === addDays(DEMO_HOY, 8) && f.disciplina !== 'descanso');
  if (proxima) {
    proxima.editada_por_coach = true;
    proxima.nota_coach = 'Esta semana bajas un punto: dormiste poco el fin de semana.';
  }
  return filas;
}

export interface DatosDemo {
  entrenos: EntrenoFila[];
  filasPlan: PlanSesionFila[];
  pesos: PesoVista[];
}

let cache: DatosDemo | null = null;

/** Generarlo cuesta unos milisegundos: solo se hace si se abre la galería. */
export function datosDemo(): DatosDemo {
  if (!cache) {
    const entrenos = generarEntrenos();
    cache = { entrenos, filasPlan: generarFilasPlan(entrenos), pesos: generarPesos() };
  }
  return cache;
}

export function demoCarrera(estado: CarreraVistaProps['estado'] = 'listo', sinObjetivo = false): CarreraVistaProps {
  const d = datosDemo();
  return {
    ...vistaCarrera(sinObjetivo ? null : OBJETIVO, sinObjetivo ? [] : d.filasPlan),
    estado,
    error: estado === 'error' ? 'Sin conexión. Vuelve a intentarlo.' : null,
    hoy: DEMO_HOY,
    plazoCorto: false,
    refreshing: false,
    borrando: false,
    onRefresh: nada,
    onReintentar: nada,
    onVolver: nada,
    onObjetivo: nada,
    onBorrar: nada,
    onVerEntreno: nada,
  };
}

export function demoHojaObjetivo(visible: boolean, onCerrar: () => void): HojaObjetivoProps {
  const form = { ...FORM_INICIAL, fecha: '27/12/2026', horas: '8' };
  return {
    visible,
    form,
    errores: SIN_ERRORES,
    previa: previaPlan(form, DEMO_HOY),
    guardando: false,
    reemplaza: true,
    onCambiar: nada,
    onGuardar: nada,
    onCerrar,
  };
}

export function demoProgreso(estado: ProgresoVistaProps['estado'] = 'listo', vacio = false): ProgresoVistaProps {
  const d = datosDemo();
  const perfil = { fc_max: DEMO_PERFIL.fc_max, fc_reposo: DEMO_PERFIL.fc_reposo, umbral: DEMO_PERFIL.fc_umbral };
  return {
    ...datosProgreso(vacio ? [] : d.entrenos, perfil, vacio ? [] : d.pesos, DEMO_HOY),
    estado,
    error: estado === 'error' ? 'Sin conexión. Vuelve a intentarlo.' : null,
    records: vacio ? [] : recordsPersonales(d.entrenos),
    recordsEstado: 'listo',
    refreshing: false,
    onRefresh: nada,
    onReintentar: nada,
    onVolver: nada,
    onRegistrar: nada,
    onVerEntreno: nada,
  };
}

/** Un día de otoño en 24 horas: fresco al amanecer, lluvia a última hora. */
function horasDemo(): HoraClima[] {
  return Array.from({ length: 24 }, (_, h): HoraClima => {
    const temp = Math.round(13 + 6 * Math.sin(((h - 9) / 24) * 2 * Math.PI));
    const lluvia = h >= 19 ? 70 : h >= 16 ? 35 : 5;
    return {
      hora: `${DEMO_HOY}T${String(h).padStart(2, '0')}:00`,
      temp,
      sensacion: temp - 1,
      lluvia_prob: lluvia,
      lluvia_mm: lluvia >= 70 ? 1.2 : 0,
      viento_kmh: 8 + (h % 5),
      racha_kmh: 16 + (h % 7),
      uv: h >= 10 && h <= 16 ? 3 : 0,
      codigo: lluvia >= 70 ? 61 : 1,
      es_de_dia: h >= 8 && h <= 19,
    };
  });
}

export interface OpcionesHub {
  cargando?: boolean;
  error?: boolean;
  /** Hoy se indicó dolor: en lugar del veredicto, la derivación. */
  dolor?: boolean;
}

export function demoHub({ cargando, error, dolor }: OpcionesHub = {}): HubVistaProps {
  const d = datosDemo();
  const forma = demoProgreso().forma;
  const sesiones = d.filasPlan.filter((f) => f.fecha === DEMO_HOY);
  const bienestar: Bienestar = {
    fecha: DEMO_HOY,
    sueno_h: dolor ? 6.2 : 7.4,
    calidad: 4,
    fatiga: 2,
    dolor: !!dolor,
    dolor_zona: dolor ? 'Rodilla derecha' : null,
    vfc_ms: 62,
    fc_reposo: 51,
    origen: 'manual',
  };
  return {
    cargado: !cargando,
    errorCarga: error ? 'Sin conexión. Vuelve a intentarlo.' : null,
    refrescando: false,
    hoy: DEMO_HOY,
    objetivo: OBJETIVO,
    sesiones,
    salida: construirSalida({
      hoy: DEMO_HOY,
      ahora: '07:30',
      bienestar,
      ciudad: DEMO_PERFIL.ubicacion_nombre,
      sesiones,
      horas: horasDemo(),
      estadoForma: forma.estado,
      ocupadas: [{ desde: '09:00', hasta: '14:00' }],
    }),
    bienestar,
    forma: { estado: forma.estado, ctl: forma.ctl, atl: forma.atl, tsb: forma.tsb },
    entrenos: d.entrenos.slice(0, 5),
    anuncio: null,
    acciones: {
      onVolver: nada,
      onReintentar: nada,
      onRefrescar: nada,
      onRegistrar: nada,
      onUbicacion: nada,
      onBienestar: nada,
      onCarrera: nada,
      onProgreso: nada,
      onEntreno: nada,
      onCerrarAnuncio: nada,
    },
  };
}

/** El entreno más reciente de ese deporte que tenga algún récord, para lucirlos. */
export function demoDetalle(deporte: DeporteEntreno = 'carrera'): DetalleVistaProps {
  const { entrenos } = datosDemo();
  const palmares = recordsPersonales(entrenos);
  const delDeporte = entrenos.filter((e) => e.deporte === deporte);
  const entreno = delDeporte.find((e) => palmares.some((r) => r.entreno_id === e.id)) ?? delDeporte[0] ?? null;
  return {
    cargado: true,
    errorCarga: null,
    entreno,
    perfil: DEMO_PERFIL,
    records: palmares.filter((r) => r.entreno_id === entreno?.id),
    acciones: { onVolver: nada, onReintentar: nada },
  };
}
