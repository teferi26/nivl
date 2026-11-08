// Sustituye a src/lib/supabase.ts en la build del arnés. Ningún cliente real:
// lee de fixtures.ts y las escrituras no van a ninguna parte.
import type { SupabaseClient } from '@supabase/supabase-js';
import { rpcArnes, sesionArnes, tablasArnes, usuarioArnes, type Fila } from './fixtures';

const avisar = (m: string) => {
  const a = (globalThis as unknown as { __TIENDA__: { avisos: string[] } }).__TIENDA__.avisos;
  if (!a.includes(m)) a.push(m);
};

if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') {
  throw new Error('El adaptador local de NIVL exige EXPO_PUBLIC_SCREENSHOT_MODE=1.');
}

interface Error_ { message: string; code: string; details: string; hint: string }
export interface Resultado { data: unknown; error: Error_ | null; count: number | null; status: number; statusText: string }

const clonar = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const ok = (data: unknown, count: number | null = null): Resultado => ({ data: clonar(data), error: null, count, status: 200, statusText: 'OK' });
const fallo = (message: string, code = 'ARNES'): Resultado => ({
  data: null, error: { message, code, details: '', hint: '' }, count: null, status: 400, statusText: 'Arnes',
});

function leerCampo(f: Fila, columna: string): unknown {
  return columna.split('.').reduce<unknown>((v, p) => (v && typeof v === 'object' ? (v as Fila)[p] : undefined), f);
}
function comparar(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

class Consulta implements PromiseLike<Resultado> {
  private filtros: ((f: Fila) => boolean)[] = [];
  private orden: { columna: string; asc: boolean }[] = [];
  private max: number | null = null;
  private desde = 0;
  private una: 'single' | 'maybe' | null = null;
  private cabeza = false;
  private contar = false;
  private escrito: Fila[] | null = null;
  private borrado = false;

  constructor(private tabla: string) {}
  select(_columnas = '*', o?: { count?: string; head?: boolean }) {
    this.cabeza = o?.head === true;
    this.contar = !!o?.count;
    return this;
  }
  eq(c: string, v: unknown) { this.filtros.push((f) => leerCampo(f, c) === v); return this; }
  neq(c: string, v: unknown) { this.filtros.push((f) => leerCampo(f, c) !== v); return this; }
  gt(c: string, v: unknown) { this.filtros.push((f) => comparar(leerCampo(f, c), v) > 0); return this; }
  gte(c: string, v: unknown) { this.filtros.push((f) => comparar(leerCampo(f, c), v) >= 0); return this; }
  lt(c: string, v: unknown) { this.filtros.push((f) => comparar(leerCampo(f, c), v) < 0); return this; }
  lte(c: string, v: unknown) { this.filtros.push((f) => comparar(leerCampo(f, c), v) <= 0); return this; }
  in(c: string, vs: unknown[]) { this.filtros.push((f) => vs.includes(leerCampo(f, c))); return this; }
  is(c: string, v: unknown) { this.filtros.push((f) => (leerCampo(f, c) ?? null) === v); return this; }
  not(c: string, op: string, v: unknown) {
    if (op === 'is' || op === 'eq') this.filtros.push((f) => (leerCampo(f, c) ?? null) !== v);
    return this;
  }
  ilike(c: string, patron: string) {
    const p = patron.replaceAll('%', '').toLowerCase();
    this.filtros.push((f) => String(leerCampo(f, c) ?? '').toLowerCase().includes(p));
    return this;
  }
  filter(c: string, op: string, v: unknown) { return op === 'eq' ? this.eq(c, v) : op === 'is' ? this.is(c, v) : this; }
  or() { return this; }
  contains(c: string, v: unknown[]) {
    this.filtros.push((f) => { const a = leerCampo(f, c); return Array.isArray(a) && v.every((x) => a.includes(x)); });
    return this;
  }
  overlaps(c: string, v: unknown[]) {
    this.filtros.push((f) => { const a = leerCampo(f, c); return Array.isArray(a) && v.some((x) => a.includes(x)); });
    return this;
  }
  match(o: Fila) { for (const [c, v] of Object.entries(o)) this.eq(c, v); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.orden.push({ columna: c, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  range(a: number, b: number) { this.desde = a; this.max = b - a + 1; return this; }
  single() { this.una = 'single'; return this; }
  maybeSingle() { this.una = 'maybe'; return this; }
  abortSignal() { return this; }
  returns() { return this; }

  // Las escrituras devuelven lo enviado y no guardan nada: la captura es de lectura.
  private escribir(op: string, v?: unknown) {
    avisar(`escritura ignorada: ${this.tabla}.${op}`);
    this.escrito = (Array.isArray(v) ? v : v ? [v] : []) as Fila[];
    return this;
  }
  insert(v: unknown) { return this.escribir('insert', v); }
  upsert(v: unknown) { return this.escribir('upsert', v); }
  update(v: unknown) { return this.escribir('update', v); }
  delete() { this.borrado = true; return this.escribir('delete'); }

  private ejecutar(): Resultado {
    if (this.escrito) {
      const filas = this.borrado ? [] : this.escrito;
      return ok(this.una ? filas[0] ?? null : filas);
    }
    const tabla = tablasArnes[this.tabla];
    if (!tabla) avisar(`tabla sin fixture: ${this.tabla}`);
    let filas = clonar(tabla ?? []).filter((f) => this.filtros.every((p) => p(f)));
    const total = filas.length;
    filas.sort((a, b) => {
      for (const { columna, asc } of this.orden) {
        const n = comparar(leerCampo(a, columna), leerCampo(b, columna));
        if (n !== 0) return asc ? n : -n;
      }
      return 0;
    });
    filas = filas.slice(this.desde, this.max === null ? undefined : this.desde + this.max);
    if (this.una) {
      if (filas.length > 1) filas = filas.slice(0, 1);
      if (this.una === 'single' && filas.length !== 1) return fallo(`Sin fila en ${this.tabla}`, 'PGRST116');
      return ok(filas[0] ?? null, this.contar ? total : null);
    }
    return ok(this.cabeza ? null : filas, this.contar ? total : null);
  }
  then<A = Resultado, B = never>(
    bien?: ((v: Resultado) => A | PromiseLike<A>) | null,
    mal?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.ejecutar()).then(bien, mal);
  }
}

async function rpc(nombre: string, args: Fila = {}): Promise<Resultado> {
  const r = rpcArnes(nombre, args);
  if (r === undefined) {
    avisar(`rpc sin fixture: ${nombre}`);
    // El mismo error que da un servidor sin esa función: la app ya lo trata.
    return fallo(`Sin fixture: ${nombre}`, 'PGRST202');
  }
  return ok(r);
}

const oyentes = new Set<(ev: string, s: typeof sesionArnes | null) => void>();
const canal = () => {
  const c = { on: () => c, subscribe: () => c, unsubscribe: async () => 'ok' };
  return c;
};

const adaptador = {
  from: (t: string) => new Consulta(t),
  rpc,
  channel: canal,
  removeChannel: async () => 'ok' as const,
  auth: {
    getSession: async () => ({ data: { session: clonar(sesionArnes) }, error: null }),
    getUser: async () => ({ data: { user: clonar(usuarioArnes) }, error: null }),
    onAuthStateChange: (f: (ev: string, s: typeof sesionArnes | null) => void) => {
      oyentes.add(f);
      return { data: { subscription: { unsubscribe: () => { oyentes.delete(f); } } } };
    },
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: fallo('Sin acceso en el arnés').error }),
    setSession: async () => ({ data: { user: null, session: null }, error: fallo('Sin sesiones externas en el arnés').error }),
    startAutoRefresh: () => {},
    stopAutoRefresh: () => {},
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ok({ signedUrl: null }),
      createSignedUrls: async () => ok([]),
      upload: async () => fallo('Sin subidas en el arnés'),
      remove: async () => ok([]),
      list: async () => ok([]),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  functions: { invoke: async (n: string) => { avisar(`función sin fixture: ${n}`); return fallo(`Sin funciones en el arnés: ${n}`); } },
};

export const supabase = adaptador as unknown as SupabaseClient;
