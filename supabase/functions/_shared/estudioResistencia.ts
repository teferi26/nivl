// NIVL · El estudio de resistencia: lo que el coach lee de los entrenos medidos.
//
// Los números salen de los módulos puros (`cargamath`, `entrenomath`); la IA
// decide qué hacer con ellos. Compacto a propósito y sin la ruta GPS: la ruta no
// se lee ni para sacar récords de tramo, que pesaría cientos de KB en cada turno.

import type { Db } from './db.ts';
import { cargaSesion, estadoForma, serieCarga, volumenSemanal, type PerfilCarga } from './cargamath.ts';
import {
  formatoRitmo,
  limitesZonas,
  recordsPersonales,
  ritmoSeg100m,
  ritmoSegKm,
  velocidadKmh,
  zonaDe,
  type EntrenoRecord,
  type Record_,
} from './entrenomath.ts';

export interface FilaEntreno {
  id: string;
  deporte: string;
  fecha: string;
  duracion_s: number;
  distancia_m: number | null;
  desnivel_m: number | null;
  fc_media: number | null;
  rpe: number | null;
  parciales: { tipo: string; distancia_m: number; duracion_s: number }[] | null;
}

export interface FilaPerfil {
  fc_max: number | null;
  fc_reposo: number | null;
  fc_umbral: number | null;
  ftp_w?: number | null;
  css_seg_100m?: number | null;
}

export interface FilaObjetivo {
  id: string;
  tipo: string;
  nombre: string | null;
  fecha: string;
  horas_semana: number;
  nivel: string;
}

export interface FilaSesionPlan {
  id: string;
  semana: number;
  fecha: string;
  disciplina: string;
  titulo: string;
  duracion_min: number;
  zona: string | null;
  clave: boolean;
  fase: string | null;
  hecha_entreno_id: string | null;
  nota_coach: string | null;
}

export interface FilaBienestar {
  fecha: string;
  sueno_h: number | null;
  calidad: number | null;
  fatiga: number | null;
  dolor: boolean;
  dolor_zona: string | null;
}

export interface DatosResistencia {
  entrenos: FilaEntreno[];
  perfil: FilaPerfil | null;
  objetivo: FilaObjetivo | null;
  sesiones: FilaSesionPlan[];
  bienestar: FilaBienestar[];
}

const DIA_MS = 86400000;
const VENTANA_DOLOR = 3;

export function sumarDias(fecha: string, n: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

function perfilCarga(p: FilaPerfil | null): PerfilCarga {
  return { fc_max: p?.fc_max ?? null, fc_reposo: p?.fc_reposo ?? null, umbral: p?.fc_umbral ?? null };
}

/** El estado de forma a partir de los entrenos. Va también en `cuando_salir`. */
export function formaDe(
  entrenos: Pick<FilaEntreno, 'fecha' | 'deporte' | 'duracion_s' | 'fc_media' | 'rpe'>[],
  perfil: FilaPerfil | null,
  hoy: string,
) {
  const p = perfilCarga(perfil);
  return estadoForma(serieCarga(entrenos.map((e) => ({ fecha: e.fecha, carga: cargaSesion(e, p) })), hoy));
}

function ventanaDolor(bienestar: FilaBienestar[], hoy: string): FilaBienestar[] {
  const desde = sumarDias(hoy, 1 - VENTANA_DOLOR);
  return bienestar.filter((b) => b.fecha >= desde && b.fecha <= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** El último dolor indicado en los tres últimos días, si lo hay. */
export function dolorReciente(bienestar: FilaBienestar[], hoy: string): FilaBienestar | null {
  return ventanaDolor(bienestar, hoy).find((b) => b.dolor) ?? null;
}

export { dolorVigente } from './mejorHora.ts';

/** Un texto de usuario en una línea, sin etiquetas de datos, acotado. */
function enLinea(v: unknown, tope: number): string {
  return String(v ?? '')
    .replace(/<\/?\s*datos_del_gladiador\s*>/gi, '')
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, tope);
}

function horasMin(seg: number): string {
  const min = Math.round(seg / 60);
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

function reloj(seg: number): string {
  const s = Math.round(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

function km(metros: number): string {
  return (metros / 1000).toFixed(1);
}

function signo(n: number): string {
  return `${n > 0 ? '+' : ''}${n}`;
}

function esNado(deporte: string): boolean {
  return deporte === 'piscina' || deporte === 'aguas_abiertas';
}

function ritmoDe(deporte: string, distancia: number, duracion: number): string | null {
  if (esNado(deporte)) {
    const r = formatoRitmo(ritmoSeg100m(distancia, duracion));
    return r ? `${r} /100 m` : null;
  }
  if (deporte === 'bici') {
    const v = velocidadKmh(distancia, duracion);
    return v === null ? null : `${v.toFixed(1)} km/h`;
  }
  const r = formatoRitmo(ritmoSegKm(distancia, duracion));
  return r ? `${r} /km` : null;
}

/**
 * El ritmo solo se compara dentro de la misma zona: un Z2 y unos intervalos no
 * son la misma prueba. Sale de tiempo total entre distancia total.
 */
export function ritmosPorZona(entrenos: FilaEntreno[], perfil: FilaPerfil | null, hoy: string): string[] | null {
  const limites = limitesZonas(perfilCarga(perfil));
  if (!limites) return null;
  const desde = sumarDias(hoy, -56);
  const grupos = new Map<string, { deporte: string; zona: string; duracion: number; distancia: number; n: number }>();
  for (const e of entrenos) {
    if (e.fecha < desde || e.deporte === 'fuerza' || !e.distancia_m || e.fc_media === null) continue;
    const zona = zonaDe(e.fc_media, limites);
    if (!zona) continue;
    const clave = `${e.deporte}|${zona}`;
    const g = grupos.get(clave) ?? { deporte: e.deporte, zona, duracion: 0, distancia: 0, n: 0 };
    g.duracion += e.duracion_s;
    g.distancia += e.distancia_m;
    g.n += 1;
    grupos.set(clave, g);
  }
  return [...grupos.values()]
    .sort((a, b) => a.deporte.localeCompare(b.deporte) || a.zona.localeCompare(b.zona))
    .flatMap((g) => {
      const r = ritmoDe(g.deporte, g.distancia, g.duracion);
      return r ? [`- ${g.deporte} ${g.zona}: ${r} (${g.n} ${g.n === 1 ? 'sesión' : 'sesiones'})`] : [];
    });
}

function lineaRecord(r: Record_): string {
  if (r.clave === 'distancia_max') {
    return `${r.deporte}, distancia más larga: ${r.deporte === 'natacion' ? `${Math.round(r.valor_s)} m` : `${km(r.valor_s)} km`} (${r.fecha})`;
  }
  if (r.clave === 'desnivel_max') return `${r.deporte}, mayor desnivel: ${Math.round(r.valor_s)} m (${r.fecha})`;
  return `${r.deporte}, ${r.etiqueta}: ${reloj(r.valor_s)} (${r.fecha})`;
}

function lineaSesion(s: FilaSesionPlan): string {
  return (
    `[${s.id}] ${s.fecha} ${s.disciplina}: ${enLinea(s.titulo, 100)}, ${Math.round(Number(s.duracion_min))} min` +
    (s.zona ? ` ${s.zona}` : '') +
    (s.clave ? ', clave' : '') +
    (s.hecha_entreno_id ? ', hecha' : '') +
    (s.nota_coach ? ` (nota: ${enLinea(s.nota_coach, 120)})` : '')
  );
}

function media(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null && Number.isFinite(Number(x))).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** El bloque de texto. Cadena vacía si la persona no usa nada de esto. */
export function informeResistencia(d: DatosResistencia, hoy: string): string {
  const hay = d.entrenos.length > 0 || d.objetivo !== null || d.bienestar.length > 0;
  if (!hay) return '';

  const L: string[] = ['## Resistencia (entrenos medidos)'];

  const dolor = dolorReciente(d.bienestar, hoy);
  if (dolor) {
    L.push(
      `ATENCIÓN: indicó dolor el ${dolor.fecha}${dolor.dolor_zona ? ` (${enLinea(dolor.dolor_zona, 80)})` : ''}. ` +
        'No lo evalúes ni le prescribas intensidad sobre esa zona: dile que pare y que lo consulte con un profesional sanitario; urgencias si es grave.',
    );
  }

  if (d.entrenos.length) {
    const f = formaDe(d.entrenos, d.perfil, hoy);
    L.push(
      `Forma: ${f.estado} · CTL ${f.ctl} · ATL ${f.atl} · TSB ${f.tsb}` +
        ` · ACWR ${f.acwr ?? 'sin dato'} · rampa ${f.rampa === null ? 'sin dato' : `${signo(f.rampa)}/semana`} (umbrales orientativos).`,
    );

    L.push('Volumen, últimas 4 semanas:');
    for (const s of volumenSemanal(d.entrenos, hoy, 4)) {
      const partes = Object.entries(s.porDeporte).map(
        ([dep, v]) => `${dep} ${horasMin(v.duracion_s)}${v.distancia_m > 0 ? ` (${km(v.distancia_m)} km)` : ''}`,
      );
      L.push(`- semana del ${s.semana}: ${partes.length ? partes.join(', ') : 'nada'}`);
    }

    const ritmos = ritmosPorZona(d.entrenos, d.perfil, hoy);
    if (ritmos === null) L.push('Ritmos por zona: sin FC máxima ni umbral en su perfil de entreno, no hay zonas.');
    else if (ritmos.length) L.push('Ritmos por zona, 56 días:', ...ritmos);

    const records = recordsPersonales(d.entrenos as unknown as EntrenoRecord[]);
    if (records.length) {
      L.push('Récords (distancia, desnivel y natación; los tramos GPS de carrera y bici se ven en Progreso):');
      for (const r of records.slice(0, 12)) L.push(`- ${lineaRecord(r)}`);
    }
  }

  if (d.objetivo) {
    const o = d.objetivo;
    const dias = Math.round((Date.parse(`${o.fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / DIA_MS);
    L.push(
      `Carrera objetivo: ${o.tipo}${o.nombre ? ` «${enLinea(o.nombre, 80)}»` : ''} el ${o.fecha}, faltan ${dias} días · ` +
        `${o.horas_semana} h/semana · nivel ${o.nivel}.`,
    );
    const esta = d.sesiones.find((s) => s.fecha === hoy);
    if (esta) L.push(`Semana ${esta.semana} del plan${esta.fase ? `, fase ${esta.fase}` : ''}.`);

    const pasadas = d.sesiones.filter((s) => s.fecha < hoy && s.disciplina !== 'descanso');
    if (pasadas.length) {
      const hechas = pasadas.filter((s) => s.hecha_entreno_id).length;
      L.push(`Adherencia, 28 días: ${hechas} de ${pasadas.length} sesiones (${Math.round((hechas / pasadas.length) * 100)} %).`);
    }
    const proximas = d.sesiones.filter((s) => s.fecha >= hoy && s.fecha <= sumarDias(hoy, 7) && s.disciplina !== 'descanso');
    if (proximas.length) {
      L.push('Próximos 7 días (para cambiar una, ajustar_sesion_plan con su id):');
      for (const s of proximas) L.push(`- ${lineaSesion(s)}`);
    }
  }

  const recientes = d.bienestar.filter((b) => b.fecha >= sumarDias(hoy, -6));
  if (recientes.length) {
    const sueno = media(recientes.map((b) => b.sueno_h));
    const fatiga = media(recientes.map((b) => b.fatiga));
    L.push(
      `Sueño y fatiga, 7 días: ${sueno === null ? 'sueño sin dato' : `sueño medio ${sueno.toFixed(1)} h`}` +
        ` · ${fatiga === null ? 'fatiga sin dato' : `fatiga media ${fatiga.toFixed(1)} de 5`}.`,
    );
  }
  return L.join('\n');
}

/**
 * Lee y redacta el estudio. Lo llama `construirEstudio`, que ya ha comprobado el
 * permiso de salud. Si las tablas aún no existen o algo falla, cadena vacía: el
 * resto del estudio no puede caerse por esto.
 */
export async function construirEstudioResistencia(sb: Db, userId: string, hoy: string): Promise<string> {
  try {
    const [entrenos, perfil, objetivo, bienestar] = await Promise.all([
      sb.from('entrenos_medidos')
        .select('id, deporte, fecha, duracion_s, distancia_m, desnivel_m, fc_media, rpe, parciales')
        .eq('user_id', userId).gte('fecha', sumarDias(hoy, -180)).lte('fecha', hoy).order('fecha').limit(500),
      sb.from('entreno_perfil').select('fc_max, fc_reposo, fc_umbral, ftp_w, css_seg_100m').eq('user_id', userId).maybeSingle(),
      sb.from('objetivos_carrera').select('id, tipo, nombre, fecha, horas_semana, nivel').eq('user_id', userId).eq('activo', true).maybeSingle(),
      sb.from('entreno_bienestar').select('fecha, sueno_h, calidad, fatiga, dolor, dolor_zona').eq('user_id', userId).gte('fecha', sumarDias(hoy, -6)).lte('fecha', hoy),
    ]);
    const obj = (objetivo.error ? null : objetivo.data) as FilaObjetivo | null;
    let sesiones: FilaSesionPlan[] = [];
    if (obj) {
      const { data, error } = await sb
        .from('plan_sesiones')
        .select('id, semana, fecha, disciplina, titulo, duracion_min, zona, clave, fase, hecha_entreno_id, nota_coach')
        .eq('user_id', userId).eq('objetivo_id', obj.id).gte('fecha', sumarDias(hoy, -28)).lte('fecha', sumarDias(hoy, 7)).order('fecha');
      if (!error) sesiones = (data ?? []) as FilaSesionPlan[];
    }
    return informeResistencia({
      entrenos: (entrenos.error ? [] : entrenos.data ?? []) as FilaEntreno[],
      perfil: (perfil.error ? null : perfil.data) as FilaPerfil | null,
      objetivo: obj,
      sesiones,
      bienestar: (bienestar.error ? [] : bienestar.data ?? []) as FilaBienestar[],
    }, hoy);
  } catch {
    return '';
  }
}
