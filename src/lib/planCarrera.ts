// NIVL · El plan hacia una carrera: semanas, fases y sesiones.
//
// Puro, determinista y SIN IMPORTS a propósito: el mismo archivo se copia tal
// cual a `supabase/functions/_shared/planCarrera.ts` (Deno), y un test de
// paridad comprueba que no se han separado. Si tocas uno, toca el otro.
//
// Doctrina: 80/20 (la calidad no pasa del 20 % del tiempo), la tirada larga no
// pasa del 35 % de la semana ni de un tope por prueba, el volumen sube menos
// del 10 % por semana y cada cuarta semana se descarga un 30 %.
//
// Las fechas son números de día en UTC: un cambio de hora no mueve el plan.

export type TipoPrueba = 'sprint' | 'olimpico' | 'medio' | 'ironman' | '5k' | '10k' | 'media' | 'maraton' | 'otra';

export interface DistanciasPrueba {
  natacion_m: number;
  bici_m: number;
  carrera_m: number;
}

export const DISTANCIAS: Record<Exclude<TipoPrueba, 'otra'>, DistanciasPrueba> = {
  sprint: { natacion_m: 750, bici_m: 20000, carrera_m: 5000 },
  olimpico: { natacion_m: 1500, bici_m: 40000, carrera_m: 10000 },
  medio: { natacion_m: 1900, bici_m: 90000, carrera_m: 21100 },
  ironman: { natacion_m: 3800, bici_m: 180000, carrera_m: 42200 },
  '5k': { natacion_m: 0, bici_m: 0, carrera_m: 5000 },
  '10k': { natacion_m: 0, bici_m: 0, carrera_m: 10000 },
  media: { natacion_m: 0, bici_m: 0, carrera_m: 21100 },
  maraton: { natacion_m: 0, bici_m: 0, carrera_m: 42200 },
};

export type Fase = 'base' | 'construccion' | 'pico' | 'afinado' | 'carrera';
export type Disciplina = 'natacion' | 'bici' | 'carrera' | 'brick' | 'transicion' | 'fuerza' | 'descanso';
type ZonaPlan = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';

export interface SesionPlan {
  semana: number; // 1..N
  dia: number; // 1 = lunes .. 7
  fecha: string;
  disciplina: Disciplina;
  titulo: string;
  detalle: string;
  duracion_min: number;
  zona: ZonaPlan | null;
  clave: boolean; // sesión clave
}

export interface SemanaPlan {
  n: number;
  lunes: string;
  fase: Fase;
  descarga: boolean;
  horas: number; // de entrenamiento: la propia carrera no cuenta
  sesiones: SesionPlan[];
}

export interface PlanCarrera {
  tipo: TipoPrueba;
  fecha: string;
  semanas: SemanaPlan[];
  aviso: string | null; // plazo corto
}

type Nivel = 'principiante' | 'intermedio' | 'avanzado';

/** Una sesión aún sin fecha: lo que toca un día de la semana tipo. */
interface Hueco {
  dia: number;
  disciplina: Disciplina;
  titulo: string;
  detalle: string;
  min: number;
  zona: ZonaPlan | null;
  clave: boolean;
  /** `min` es un tope de doctrina: redondear no puede pasarse. */
  techo?: boolean;
}

interface Contexto {
  nivel: Nivel;
  horas: number;
  dist: DistanciasPrueba;
  /** Parte del tiempo semanal de cada disciplina en triatlón; suman 1. */
  reparto: { natacion: number; bici: number; carrera: number };
}

const MS_DIA = 86400000;
const MAX_SEMANAS = 52;
const SEMANAS_PLAZO_CORTO = 6;
const DESCARGA = 0.7;
const SUBIDA_SEMANAL = 1.05;
const CARGA_INICIAL = 0.7;
const DIAS_APROXIMACION = 6;
const TOPE_TIRADA = 0.35;
const MIN_SESION = 20;
// Un punto por debajo del 20 %: el redondeo a 5 minutos no puede pasarlo.
const MAX_CALIDAD = 0.19;
const TOPE_SESION_CALIDAD = 75;

function aDia(fecha: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const ms = Date.UTC(anio, mes - 1, dia);
  const f = new Date(ms);
  if (f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return Math.round(ms / MS_DIA);
}

function aFecha(dia: number): string {
  return new Date(dia * MS_DIA).toISOString().slice(0, 10);
}

/** 1 = lunes .. 7 = domingo. El día 0 fue jueves. */
function diaSemana(dia: number): number {
  return (((dia + 3) % 7) + 7) % 7 + 1;
}

function lunesDe(dia: number): number {
  return dia - (diaSemana(dia) - 1);
}

/** Semanas de afinado, sin contar la semana de la propia carrera. */
function semanasAfinado(tipo: TipoPrueba, dist: DistanciasPrueba): number {
  switch (tipo) {
    case 'ironman':
      return 3;
    case 'medio':
    case 'maraton':
      return 2;
    case 'otra':
      return dist.bici_m >= 90000 || dist.carrera_m >= 30000 ? 2 : 1;
    default:
      return 1;
  }
}

/** La fase de la semana `n` de `total`, con `afinado` semanas de afinado. */
function faseConAfinado(n: number, total: number, afinado: number): Fase {
  if (n >= total) return 'carrera';
  const previas = total - 1;
  const af = Math.min(afinado, Math.ceil(previas / 3));
  if (n > previas - af) return 'afinado';

  // Base 40, construcción 35, pico 15: lo que queda tras apartar el afinado.
  const resto = previas - af;
  const pico = resto >= 3 ? Math.max(1, Math.round((resto * 15) / 90)) : 0;
  const construccion = resto >= 2 ? Math.max(1, Math.round((resto * 35) / 90)) : resto;
  const base = resto - pico - construccion;
  if (n <= base) return 'base';
  if (n <= base + construccion) return 'construccion';
  return 'pico';
}

/**
 * La fase sin saber la prueba: el afinado se estima como una décima parte del
 * plan (entre 1 y 3 semanas). `generarPlan` sí conoce la prueba y usa su tabla.
 */
export function faseDeSemana(n: number, total: number): Fase {
  return faseConAfinado(n, total, Math.min(3, Math.max(1, Math.round(total * 0.1))));
}

function esDescarga(n: number, fase: Fase): boolean {
  return n % 4 === 0 && (fase === 'base' || fase === 'construccion' || fase === 'pico');
}

function repartoDe(tipo: TipoPrueba, dist: DistanciasPrueba): Contexto['reparto'] {
  const tabla: Partial<Record<TipoPrueba, [number, number, number]>> = {
    sprint: [0.25, 0.45, 0.3],
    olimpico: [0.22, 0.48, 0.3],
    medio: [0.18, 0.52, 0.3],
    ironman: [0.15, 0.55, 0.3],
  };
  // Sin tabla, el reparto sale del tiempo esperado de cada parte.
  const [nat, bici, carrera] = tabla[tipo] ?? [dist.natacion_m / 2000, dist.bici_m / 27000, dist.carrera_m / 10000];
  const n = dist.natacion_m > 0 ? nat : 0;
  const b = dist.bici_m > 0 ? bici : 0;
  const c = dist.carrera_m > 0 ? carrera : 0;
  const suma = n + b + c;
  if (suma <= 0) return { natacion: 0, bici: 0, carrera: 1 };
  return { natacion: n / suma, bici: b / suma, carrera: c / suma };
}

function topeTirada(ctx: Contexto): number {
  const m = ctx.dist.carrera_m;
  const tope = m <= 5000 ? 75 : m <= 10000 ? 90 : m <= 21100 ? 120 : 180;
  return ctx.nivel === 'principiante' ? tope * 0.85 : tope;
}

function zonaCalidad(ctx: Contexto, fase: Fase): ZonaPlan {
  if (ctx.nivel === 'principiante') return 'Z3';
  return ctx.nivel === 'avanzado' && fase === 'pico' ? 'Z5' : 'Z4';
}

function huecosPie(ctx: Contexto, fase: Fase, descarga: boolean, t: number): Hueco[] {
  const calidad = !descarga && fase !== 'base';
  const completa = ctx.horas >= 4 && ctx.nivel !== 'principiante';
  const huecos: Hueco[] = [
    calidad
      ? {
          dia: 2,
          disciplina: 'carrera',
          titulo: 'Series',
          detalle: 'Calienta bien y haz series con recuperación completa. Vuelta a la calma suave.',
          min: t * 0.2,
          zona: zonaCalidad(ctx, fase),
          clave: true,
        }
      : {
          dia: 2,
          disciplina: 'carrera',
          titulo: 'Rodaje con progresiones',
          detalle: 'Ritmo cómodo y unas progresiones cortas al final.',
          min: t * 0.2,
          zona: 'Z2',
          clave: false,
        },
    {
      dia: 3,
      disciplina: 'carrera',
      titulo: 'Rodaje suave',
      detalle: 'Ritmo de conversación. Hoy no se demuestra nada.',
      min: t * (completa ? 0.2 : 0.35),
      zona: 'Z2',
      clave: false,
    },
    {
      dia: 4,
      disciplina: 'fuerza',
      titulo: 'Fuerza para correr',
      detalle: 'Sentadilla, peso muerto rumano, gemelo y core. Sin llegar al fallo.',
      min: t * 0.1,
      zona: null,
      clave: false,
    },
  ];
  if (completa) {
    huecos.push({
      dia: 5,
      disciplina: 'carrera',
      titulo: 'Rodaje de recuperación',
      detalle: 'Corto y muy suave.',
      min: t * 0.15,
      zona: 'Z1',
      clave: false,
    });
  }
  huecos.push({
    dia: 7,
    disciplina: 'carrera',
    titulo: 'Tirada larga',
    detalle: 'Ritmo cómodo de principio a fin. Ensaya la bebida y la comida de la carrera.',
    min: Math.min(t * TOPE_TIRADA, topeTirada(ctx)),
    zona: 'Z2',
    clave: true,
    techo: true,
  });
  return huecos;
}

function huecosTriatlon(ctx: Contexto, fase: Fase, descarga: boolean, minutos: number): Hueco[] {
  const { natacion: s, bici: b, carrera: r } = ctx.reparto;
  const calidad = !descarga && fase !== 'base';
  const hayBrick = (fase === 'construccion' || fase === 'pico' || fase === 'afinado') && b > 0 && r > 0;
  const hayTransicion = fase === 'pico' && b > 0 && r > 0;
  const principiante = ctx.nivel === 'principiante';
  const sesiones = ctx.horas >= 5 && !principiante ? 6 : ctx.horas >= 3.5 ? 5 : 4;
  const t = hayTransicion ? minutos - MIN_SESION : minutos;
  const huecos: Hueco[] = [];

  if (s > 0) {
    const dos = sesiones === 6;
    huecos.push({
      dia: 2,
      disciplina: 'natacion',
      titulo: 'Técnica de natación',
      detalle: 'Series cortas con descanso. Cuida la posición y la respiración.',
      min: t * s * (dos ? 0.5 : 1),
      zona: 'Z2',
      clave: false,
    });
    if (dos) {
      huecos.push({
        dia: 5,
        disciplina: 'natacion',
        titulo: 'Natación aeróbica',
        detalle: 'Bloques largos a ritmo continuo, mirando al frente cada pocas brazadas.',
        min: t * s * 0.5,
        zona: 'Z2',
        clave: false,
      });
    }
  }

  const runCalidad = r * (calidad ? 0.3 : 0.45);
  const runBrick = hayBrick ? r * 0.25 : 0;
  if (r > 0) {
    huecos.push(
      calidad
        ? {
            dia: 3,
            disciplina: 'carrera',
            titulo: 'Series de carrera',
            detalle: 'Calienta bien y haz series con recuperación completa.',
            min: t * runCalidad,
            zona: zonaCalidad(ctx, fase),
            clave: true,
          }
        : {
            dia: 3,
            disciplina: 'carrera',
            titulo: 'Rodaje aeróbico',
            detalle: 'Ritmo de conversación.',
            min: t * runCalidad,
            zona: 'Z2',
            clave: false,
          },
    );
    huecos.push({
      dia: 7,
      disciplina: 'carrera',
      titulo: 'Tirada larga',
      detalle: 'Ritmo cómodo de principio a fin.',
      min: Math.min(t * (r - runCalidad - runBrick), t * TOPE_TIRADA, topeTirada(ctx)),
      zona: 'Z2',
      clave: true,
      techo: true,
    });
  }

  const bikeMedia = sesiones >= 5 && b > 0 ? b * (calidad ? 0.2 : 0.35) : 0;
  if (bikeMedia > 0) {
    huecos.push(
      calidad
        ? {
            dia: 4,
            disciplina: 'bici',
            titulo: 'Bloques de bici',
            detalle: 'Bloques a ritmo de prueba con recuperación suave entre ellos.',
            min: t * bikeMedia,
            zona: zonaCalidad(ctx, fase),
            clave: true,
          }
        : {
            dia: 4,
            disciplina: 'bici',
            titulo: 'Bici aeróbica',
            detalle: 'Cadencia alta y pedaleo redondo.',
            min: t * bikeMedia,
            zona: 'Z2',
            clave: false,
          },
    );
  }
  const bikeLarga = b - bikeMedia;
  if (hayBrick) {
    const biciMin = Math.round(t * bikeLarga);
    const pieMin = Math.round(t * runBrick);
    huecos.push({
      dia: 6,
      disciplina: 'brick',
      titulo: 'Brick: bici y carrera',
      detalle: `${biciMin} min de bici y, sin pausa, ${pieMin} min de carrera. Las piernas tienen que aprender el cambio.`,
      min: t * (bikeLarga + runBrick),
      zona: 'Z2',
      clave: true,
    });
  } else if (b > 0) {
    huecos.push({
      dia: 6,
      disciplina: 'bici',
      titulo: 'Salida larga de bici',
      detalle: 'Ritmo cómodo. Ensaya la bebida y la comida de la carrera.',
      min: t * bikeLarga,
      zona: 'Z2',
      clave: true,
    });
  }

  if (hayTransicion) {
    huecos.push({
      dia: 5,
      disciplina: 'transicion',
      titulo: 'Práctica de transiciones',
      detalle: 'Repite el paso de neopreno a bici y de bici a zapatillas hasta que salga sin pensar.',
      min: MIN_SESION,
      zona: 'Z2',
      clave: false,
    });
  }
  return huecos;
}

/**
 * 80/20 y tirada sobre lo que de verdad se va a hacer esa semana, ya con los
 * topes: lo que no cabe se recorta, no se reparte. Recortar baja el total, así
 * que se repite hasta que las dos proporciones cuadran. Si una sesión de calidad
 * se queda sin el mínimo, pasa a ser un rodaje.
 */
function limitarCalidad(huecos: Hueco[]): void {
  const calidad = huecos.filter((h) => h.zona === 'Z3' || h.zona === 'Z4' || h.zona === 'Z5');
  const larga = huecos.find((h) => h.titulo === 'Tirada larga');
  for (const h of calidad) h.min = Math.min(h.min, TOPE_SESION_CALIDAD);
  for (let i = 0; i < 12; i++) {
    const total = huecos.reduce((a, h) => a + h.min, 0);
    const q = calidad.reduce((a, h) => a + h.min, 0);
    if (q > total * MAX_CALIDAD) for (const h of calidad) h.min *= (total * MAX_CALIDAD) / q;
    if (larga && larga.min > total * TOPE_TIRADA) larga.min = total * TOPE_TIRADA;
  }
  for (const h of calidad) {
    h.techo = true;
    if (h.min < MIN_SESION) {
      h.min = MIN_SESION;
      h.titulo = 'Rodaje suave';
      h.detalle = 'Ritmo de conversación.';
      h.zona = 'Z2';
      h.clave = false;
      h.techo = undefined;
    }
  }
}

/** La última semana antes de la carrera se fija contando atrás desde ella. */
function huecoAproximacion(ctx: Contexto, diasAntes: number, dia: number): Hueco {
  const descanso: Hueco = {
    dia,
    disciplina: 'descanso',
    titulo: 'Descanso',
    detalle: 'Descansa, bebe y duerme.',
    min: 0,
    zona: null,
    clave: false,
  };
  const { natacion, bici, carrera } = ctx.reparto;
  const principal: Disciplina = carrera > 0 ? 'carrera' : bici > 0 ? 'bici' : 'natacion';
  const suave = (disciplina: Disciplina, titulo: string, detalle: string, min: number): Hueco => ({
    dia,
    disciplina,
    titulo,
    detalle,
    min,
    zona: 'Z2',
    clave: false,
  });

  if (diasAntes === 1) {
    return suave(principal, 'Activación', 'Muy corto, con tres o cuatro aceleraciones. Prepara el material y la comida.', 20);
  }
  const esPie = natacion === 0 && bici === 0;
  if (diasAntes === 5) return suave(principal, 'Rodaje de piernas sueltas', 'Corto y cómodo.', 30);
  if (esPie) return diasAntes === 3 ? suave(principal, 'Rodaje corto', 'Corto, con la cabeza en la carrera.', 25) : descanso;
  if (diasAntes === 4 && bici > 0) return suave('bici', 'Bici corta', 'Comprueba la bici tal como vas a correr.', 45);
  if (diasAntes === 3 && natacion > 0) return suave('natacion', 'Natación corta', 'Suave, con unas salidas a ritmo de prueba.', 30);
  return descanso;
}

function numeroKm(metros: number): string {
  return String(Math.round(metros / 100) / 10).replace('.', ',');
}

function detalleCarrera(d: DistanciasPrueba): string {
  const partes: string[] = [];
  if (d.natacion_m > 0) partes.push(`${d.natacion_m} m de natación`);
  if (d.bici_m > 0) partes.push(`${numeroKm(d.bici_m)} km de bici`);
  if (d.carrera_m > 0) partes.push(`${numeroKm(d.carrera_m)} km de carrera`);
  if (partes.length === 0) return 'Sal a tu ritmo y come según lo ensayado.';
  const ultima = partes.pop()!;
  const lista = partes.length > 0 ? `${partes.join(', ')} y ${ultima}` : ultima;
  return `${lista}. Sal a tu ritmo y come según lo ensayado.`;
}

/** Una estimación de cuánto dura la prueba, para reservar el día. */
function minutosCarrera(d: DistanciasPrueba, nivel: Nivel): number {
  const ritmos = {
    principiante: { nat: 150, bici: 22, pie: 7 },
    intermedio: { nat: 125, bici: 27, pie: 5.75 },
    avanzado: { nat: 105, bici: 32, pie: 4.75 },
  }[nivel];
  const disciplinas = [d.natacion_m, d.bici_m, d.carrera_m].filter((m) => m > 0).length;
  const min =
    ((d.natacion_m / 100) * ritmos.nat) / 60 +
    (d.bici_m / 1000 / ritmos.bici) * 60 +
    (d.carrera_m / 1000) * ritmos.pie +
    (disciplinas > 1 ? (disciplinas - 1) * 4 : 0);
  return Math.max(5, Math.round(min / 5) * 5);
}

function distanciaValida(x: number | undefined): number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0;
}

function resolverDistancias(tipo: TipoPrueba, propias: DistanciasPrueba | undefined): DistanciasPrueba {
  const d = propias ?? (tipo === 'otra' ? { natacion_m: 0, bici_m: 0, carrera_m: 10000 } : DISTANCIAS[tipo]);
  return {
    natacion_m: distanciaValida(d.natacion_m),
    bici_m: distanciaValida(d.bici_m),
    carrera_m: distanciaValida(d.carrera_m),
  };
}

export function generarPlan(e: {
  tipo: TipoPrueba;
  fecha_prueba: string;
  hoy: string;
  horas_semana: number;
  distancias?: DistanciasPrueba;
  nivel: 'principiante' | 'intermedio' | 'avanzado';
}): PlanCarrera {
  const vacio = (aviso: string): PlanCarrera => ({ tipo: e.tipo, fecha: e.fecha_prueba, semanas: [], aviso });
  const carrera = aDia(e.fecha_prueba);
  const hoy = aDia(e.hoy);
  if (carrera === null || hoy === null) return vacio('Las fechas del plan no son válidas.');
  if (hoy > carrera) return vacio('La fecha de la prueba ya ha pasado.');

  const dist = resolverDistancias(e.tipo, e.distancias);
  const horas = Number.isFinite(e.horas_semana) ? Math.min(30, Math.max(2, e.horas_semana)) : 5;
  const ctx: Contexto = { nivel: e.nivel, horas, dist, reparto: repartoDe(e.tipo, dist) };
  const esPie = dist.natacion_m === 0 && dist.bici_m === 0;

  const lunesFinal = lunesDe(carrera);
  const total = Math.min(MAX_SEMANAS, (lunesFinal - lunesDe(hoy)) / 7 + 1);
  const primerLunes = lunesFinal - (total - 1) * 7;
  const afinado = semanasAfinado(e.tipo, dist);

  // Cuántas semanas de carga hay, para que la última llegue justo al tope.
  let semanasCarga = 0;
  for (let n = 1; n <= total; n++) {
    const f = faseConAfinado(n, total, afinado);
    if ((f === 'base' || f === 'construccion' || f === 'pico') && !esDescarga(n, f)) semanasCarga++;
  }
  const totalAfinado = Array.from({ length: total }, (_, i) => faseConAfinado(i + 1, total, afinado)).filter(
    (f) => f === 'afinado',
  ).length;

  const semanas: SemanaPlan[] = [];
  let cargaHecha = 0;
  let afinadoHecho = 0;
  for (let n = 1; n <= total; n++) {
    const lunes = primerLunes + (n - 1) * 7;
    const fase = faseConAfinado(n, total, afinado);
    const descarga = esDescarga(n, fase);

    let factor = 0;
    if (fase === 'afinado') {
      factor = totalAfinado === 1 ? 0.65 : 0.8 - (0.3 * afinadoHecho) / (totalAfinado - 1);
      afinadoHecho++;
    } else if (fase !== 'carrera') {
      if (!descarga) cargaHecha++;
      factor = Math.max(CARGA_INICIAL, Math.pow(SUBIDA_SEMANAL, cargaHecha - semanasCarga));
      if (descarga) factor *= DESCARGA;
    }
    const minutos = horas * 60 * factor;
    const tipica =
      fase === 'carrera' ? [] : esPie ? huecosPie(ctx, fase, descarga, minutos) : huecosTriatlon(ctx, fase, descarga, minutos);
    // Solo cuenta lo que llega a programarse: ni el pasado ni los días de aproximación.
    limitarCalidad(tipica.filter((h) => h.min > 0 && lunes + h.dia - 1 >= hoy && carrera - (lunes + h.dia - 1) > DIAS_APROXIMACION));

    const sesiones: SesionPlan[] = [];
    let minutosSemana = 0;
    // Se redondea el acumulado, no cada sesión: si todas subieran a la vez, el
    // redondeo solo ya rompería la subida máxima semanal.
    let acumulado = 0;
    let acumuladoRedondeado = 0;
    const anotar = (h: Hueco, fecha: number, duracion: number) => {
      sesiones.push({
        semana: n,
        dia: h.dia,
        fecha: aFecha(fecha),
        disciplina: h.disciplina,
        titulo: h.titulo,
        detalle: h.detalle,
        duracion_min: duracion,
        zona: h.zona,
        clave: h.clave,
      });
    };

    for (let dia = 1; dia <= 7; dia++) {
      const fecha = lunes + dia - 1;
      if (fecha < hoy || fecha > carrera) continue;
      const diasAntes = carrera - fecha;

      if (diasAntes === 0) {
        anotar(
          {
            dia,
            disciplina: 'carrera',
            titulo: 'Día de carrera',
            detalle: detalleCarrera(dist),
            min: 0,
            zona: null,
            clave: true,
          },
          fecha,
          minutosCarrera(dist, e.nivel),
        );
        continue;
      }
      if (diasAntes <= DIAS_APROXIMACION) {
        const h = huecoAproximacion(ctx, diasAntes, dia);
        minutosSemana += h.min;
        anotar(h, fecha, h.min);
        continue;
      }
      const delDia = tipica.filter((h) => h.dia === dia && h.min > 0);
      if (delDia.length === 0) {
        anotar(
          { dia, disciplina: 'descanso', titulo: 'Descanso', detalle: 'Descansa, bebe y duerme.', min: 0, zona: null, clave: false },
          fecha,
          0,
        );
        continue;
      }
      for (const h of delDia) {
        acumulado += h.min;
        const justa = Math.round(acumulado / 5) * 5 - acumuladoRedondeado;
        const duracion = Math.max(MIN_SESION, h.techo ? Math.min(justa, Math.floor(h.min / 5) * 5) : justa);
        acumuladoRedondeado += duracion;
        minutosSemana += duracion;
        anotar(h, fecha, duracion);
      }
    }

    semanas.push({
      n,
      lunes: aFecha(lunes),
      fase,
      descarga,
      horas: Math.round((minutosSemana / 60) * 10) / 10,
      sesiones,
    });
  }

  // Cuenta hoy y el día de la prueba: de lunes a domingo seis semanas son 42 días.
  const plazoCorto = carrera - hoy + 1 < SEMANAS_PLAZO_CORTO * 7;
  return {
    tipo: e.tipo,
    fecha: e.fecha_prueba,
    semanas,
    aviso: plazoCorto
      ? 'Quedan menos de seis semanas: plan comprimido. No da tiempo a construir base, así que el objetivo es llegar sano.'
      : null,
  };
}

/** La semana del plan que contiene `hoy`, o null si cae fuera. */
export function semanaActual(plan: PlanCarrera, hoy: string): SemanaPlan | null {
  const d = aDia(hoy);
  if (d === null) return null;
  for (const s of plan.semanas) {
    const lunes = aDia(s.lunes);
    if (lunes !== null && d >= lunes && d <= lunes + 6) return s;
  }
  return null;
}

export function sesionesDeHoy(plan: PlanCarrera, hoy: string): SesionPlan[] {
  return semanaActual(plan, hoy)?.sesiones.filter((s) => s.fecha === hoy) ?? [];
}
