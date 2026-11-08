// NIVL · Métricas del panel admin: lo puro (sin Supabase, con tests).
// Lee lo que devuelven las RPC de la 0072 sin fiarse de su forma.

export interface Resumen {
  usuarios: number;
  altasHoy: number;
  altas7: number;
  altas30: number;
  activosHoy: number;
  activos7: number;
  activos30: number;
  onboarding: number;
  instalaciones: number;
  suscripciones: number;
  opiniones: number;
}

export interface DiaAltas { dia: string; altas: number; instalaciones: number }
export interface PasoEmbudo { paso: string; instalaciones: number; porcentaje: number }
export interface CohorteRetencion { instalaciones: number; d1: number; d3: number; d7: number }
export interface Opinion { id: string; created_at: string; version: string | null; gusta: string | null; cambiaria: string | null }

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function leerResumen(datos: unknown): Resumen {
  const d = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
  return {
    usuarios: numero(d.usuarios),
    altasHoy: numero(d.altas_hoy),
    altas7: numero(d.altas_7d),
    altas30: numero(d.altas_30d),
    activosHoy: numero(d.activos_hoy),
    activos7: numero(d.activos_7d),
    activos30: numero(d.activos_30d),
    onboarding: numero(d.onboarding_hecho),
    instalaciones: numero(d.instalaciones),
    suscripciones: numero(d.suscripciones_vivas),
    opiniones: numero(d.opiniones),
  };
}

/** «ahora», «hace 12 min», «hace 3 h», «hace 2 d». */
export function hace(iso: string, ahora: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((ahora.getTime() - t) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.floor(min / 60)} h`;
  return `hace ${Math.floor(min / (60 * 24))} d`;
}

/** Alturas de 0 a 1 para las barras. Todo a cero si no hay datos. */
export function alturas(valores: number[]): number[] {
  const max = Math.max(0, ...valores);
  return valores.map((v) => (max > 0 ? Math.max(0, v) / max : 0));
}

/** Porcentaje entero. Con base cero, 0: nunca NaN en pantalla. */
export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** Retención del periodo: suma de cohortes, no media de porcentajes. */
export function retencion(cohortes: CohorteRetencion[]): { instalaciones: number; d1: number; d3: number; d7: number } {
  const s = cohortes.reduce(
    (a, c) => ({
      instalaciones: a.instalaciones + numero(c.instalaciones),
      d1: a.d1 + numero(c.d1),
      d3: a.d3 + numero(c.d3),
      d7: a.d7 + numero(c.d7),
    }),
    { instalaciones: 0, d1: 0, d3: 0, d7: 0 },
  );
  return {
    instalaciones: s.instalaciones,
    d1: porcentaje(s.d1, s.instalaciones),
    d3: porcentaje(s.d3, s.instalaciones),
    d7: porcentaje(s.d7, s.instalaciones),
  };
}

const PASOS: { paso: string; rotulo: string }[] = [
  { paso: 'primer_arranque', rotulo: 'Abren la app' },
  { paso: 'registro', rotulo: 'Se registran' },
  { paso: 'onboarding_fin', rotulo: 'Acaban el inicio' },
  { paso: 'primera_mision_completada', rotulo: 'Primera misión' },
  { paso: 'd7', rotulo: 'Vuelven el día 7' },
  { paso: 'compra_ok', rotulo: 'Compran' },
];

/** Los pasos que importan del embudo, en orden y con nombre legible. */
export function pasosClave(filas: PasoEmbudo[]): { paso: string; rotulo: string; instalaciones: number; porcentaje: number }[] {
  return PASOS.map(({ paso, rotulo }) => {
    const f = filas.find((x) => x.paso === paso);
    return { paso, rotulo, instalaciones: numero(f?.instalaciones), porcentaje: Math.min(100, numero(f?.porcentaje)) };
  });
}
