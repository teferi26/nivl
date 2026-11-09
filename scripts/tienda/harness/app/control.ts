// Dirige la app desde fuera sin Maestro, con simctl openurl:
//   nivl://__tienda/escena?id=perfil&token=7
//   nivl://__tienda/ir?ruta=%2F(tabs)%2Fperfil&y=300
//   nivl://__tienda/desplazar?y=600&ms=2000
//   nivl://__tienda/pulsar?etiqueta=...  o  ?texto=...
//   nivl://__tienda/gira?nombre=corta&retraso=1000
// Cada orden deja el resultado en Documents/tienda-estado.json. Navega con el
// router real y toca el ScrollView y los botones reales de la pantalla.
import * as FS from 'expo-file-system/legacy';
import { router } from 'expo-router';
import guion from './escenas.json';

type Paso = { oferta?: { periodo: string; pack: string; modo?: string }; accion?: Objetivo; modo?: string; ir?: string; espera?: number; desplazar?: number | 'fin'; ms?: number; pulsar?: Objetivo };
type Objetivo = { etiqueta?: string; texto?: string };
type Escena = { id: string; titulo: string; ruta: string; plan?: string; catalogo?: boolean; pasos?: Paso[]; alSalir?: Paso[]; asentar?: number };
type Fibra = {
  tag: number; type: unknown; stateNode: any; memoizedProps: any;
  child: Fibra | null; sibling: Fibra | null;
};

const estadoTienda = (globalThis as any).__TIENDA__ as { raiz: { current: Fibra } | null; plan: string | null; catalogo?: boolean; avisos: string[] };
const ASENTAR_MS = 2600;
const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
const siguienteCuadro = () => new Promise<void>((ok) => requestAnimationFrame(() => ok()));

let escenaActual: Escena | null = null;
// Las órdenes se atienden de una en una, en el orden en que llegan.
let cola: Promise<unknown> = Promise.resolve();

async function escribirEstado(e: Record<string, unknown>): Promise<void> {
  try {
    await FS.writeAsStringAsync(`${FS.documentDirectory}tienda-estado.json`, JSON.stringify({ ...e, avisos: estadoTienda.avisos }));
  } catch (err) {
    estadoTienda.avisos.push(`estado sin escribir: ${String(err)}`);
  }
}

// ── El árbol ────────────────────────────────────────────────────────

const estiloOculto = (estilo: unknown): boolean => {
  if (!estilo) return false;
  if (Array.isArray(estilo)) return estilo.some(estiloOculto);
  return (estilo as { display?: string }).display === 'none';
};

function oculta(f: Fibra): boolean {
  if (f.type === 'RNSScreen' && f.memoizedProps?.activityState === 0) return true;
  return typeof f.type === 'string' && estiloOculto(f.memoizedProps?.style);
}

/** Las pantallas directas de una pila nativa (sin entrar en pilas anidadas). */
function pantallasDe(f: Fibra | null, fuera: Fibra[] = []): Fibra[] {
  for (let n = f; n; n = n.sibling) {
    if (n.type === 'RNSScreen') fuera.push(n);
    else pantallasDe(n.child, fuera);
  }
  return fuera;
}

const esScrollView = (f: Fibra) =>
  f.tag === 1 && typeof f.stateNode?.scrollTo === 'function' && typeof f.stateNode?.getNativeScrollRef === 'function';

/** Los ScrollView verticales de lo que se ve; en una pila, solo la pantalla de arriba. */
function buscarScrolls(f: Fibra | null, hallados: Fibra[] = []): Fibra[] {
  for (let n = f; n; n = n.sibling) {
    if (oculta(n)) continue;
    if (esScrollView(n) && !n.memoizedProps?.horizontal) {
      hallados.push(n);
      continue;
    }
    if (n.type === 'RNSScreenStack') {
      const arriba = pantallasDe(n.child).pop();
      if (arriba) buscarScrolls(arriba.child, hallados);
      continue;
    }
    buscarScrolls(n.child, hallados);
  }
  return hallados;
}

function textoDe(f: Fibra | null, partes: string[] = []): string[] {
  for (let n = f; n; n = n.sibling) {
    if (oculta(n)) continue;
    if (n.tag === 6 && typeof n.memoizedProps === 'string') partes.push(n.memoizedProps);
    textoDe(n.child, partes);
  }
  return partes;
}

/** El último control pulsable que casa, en el orden del árbol (lo de encima gana). */
function buscarPulsable(f: Fibra | null, o: Objetivo, hallado: { f: Fibra | null }): void {
  for (let n = f; n; n = n.sibling) {
    if (oculta(n)) continue;
    const p = n.memoizedProps;
    if (n.tag !== 5 && n.tag !== 6 && typeof p?.onPress === 'function') {
      const etiqueta = typeof p.accessibilityLabel === 'string' ? p.accessibilityLabel : null;
      const texto = textoDe(n.child).join('').trim();
      if ((o.etiqueta && etiqueta === o.etiqueta) || (o.texto && texto.toLowerCase() === o.texto.toLowerCase())) {
        hallado.f = n;
      }
    }
    buscarPulsable(n.child, o, hallado);
  }
}

function raiz(): Fibra {
  const r = estadoTienda.raiz?.current;
  if (!r) throw new Error('La app aún no ha pintado');
  return r;
}

// ── Las acciones ────────────────────────────────────────────────────

function medir(ref: any): Promise<number> {
  return new Promise((ok) => ref.measure((_x: number, _y: number, _w: number, alto: number) => ok(alto)));
}

async function desplazar(y: number | 'fin', ms = 0): Promise<void> {
  // El de más recorrido: en iPad el primero es la barra lateral, que apenas se mueve.
  const candidatos = await Promise.all(buscarScrolls(raiz()).map(async (f) => {
    const [contenido, ventana] = await Promise.all([medir(f.stateNode.getInnerViewRef()), medir(f.stateNode.getNativeScrollRef())]);
    return { s: f.stateNode, tope: Math.max(0, contenido - ventana) };
  }));
  if (!candidatos.length) throw new Error('No hay ScrollView en esta pantalla');
  const { s, tope } = candidatos.reduce((mejor, c) => (c.tope > mejor.tope ? c : mejor));
  const destino = y === 'fin' ? tope : Math.min(tope, y);
  const pendiente = s._arnesY ?? 0;
  if (ms <= 0) {
    s.scrollTo({ x: 0, y: destino, animated: false });
    s._arnesY = destino;
    return;
  }
  const curva = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const inicio = globalThis.performance.now();
  for (;;) {
    await siguienteCuadro();
    const t = Math.min(1, (globalThis.performance.now() - inicio) / ms);
    s.scrollTo({ x: 0, y: pendiente + (destino - pendiente) * curva(t), animated: false });
    if (t >= 1) break;
  }
  s._arnesY = destino;
}

function pulsar(o: Objetivo): void {
  const hallado: { f: Fibra | null } = { f: null };
  buscarPulsable(raiz(), o, hallado);
  if (!hallado.f) throw new Error(`Nada que pulsar: ${JSON.stringify(o)}`);
  hallado.f.memoizedProps.onPress({ nativeEvent: {} });
}

async function ir(ruta: string): Promise<void> {
  if (router.canDismiss()) router.dismissAll();
  // Al cerrar la pila, un cuadro para que el navegador la dé por cerrada.
  await siguienteCuadro();
  router.navigate(ruta as never);
}

/** Lanza la acción de accesibilidad «activate» de la vista con esa etiqueta (la rueda es un gesto). */
async function activar(o: Objetivo): Promise<void> {
  const visitar = (f: Fibra | null): Fibra | null => {
    for (let n = f; n; n = n.sibling) {
      const pr = n.memoizedProps;
      if (pr?.onAccessibilityAction && pr.accessibilityLabel === o.etiqueta) return n;
      const h = visitar(n.child);
      if (h) return h;
    }
    return null;
  };
  const f = visitar(raiz());
  if (!f) throw new Error(`Nada que activar: ${JSON.stringify(o)}`);
  f.memoizedProps.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
  await dormir(700);
}

/** Elige producto en la oferta real con sus propios manejadores. */
async function elegirOferta(o: { periodo: string; pack: string; modo?: string }): Promise<void> {
  const visitar = (f: Fibra | null): any => {
    for (let n = f; n; n = n.sibling) {
      const v = n.memoizedProps?.oferta;
      if (v && typeof v.onPeriodo === 'function') return n;
      const h = visitar(n.child);
      if (h) return h;
    }
    return null;
  };
  const leer = () => visitar(raiz())?.memoizedProps.oferta;
  if (!leer()) throw new Error('No encuentro la oferta');
  leer().onPeriodo(o.periodo);
  await dormir(150);
  leer().onPack(o.pack);
  await dormir(150);
  if (o.modo) leer().onModo(o.modo);
  await dormir(500);
  const final = leer();
  // Sin esto saldría la lista de solo lectura y la captura no valdría.
  if (!final.disponible || !final.precio || !final.puedeComprar) throw new Error(`Oferta sin catálogo: ${final.disponible} ${final.catalogo} ${final.precio}`);
}

/** Cambia el modo con el `cambiar` real de ModoProvider (se busca en el árbol). */
async function cambiarModo(modo: string): Promise<void> {
  const visitar = (f: Fibra | null): ((m: string) => void) | null => {
    for (let n = f; n; n = n.sibling) {
      const v = n.memoizedProps?.value;
      if (v && typeof v.cambiar === 'function' && typeof v.guardarActivados === 'function') return v.cambiar;
      const hallado = visitar(n.child);
      if (hallado) return hallado;
    }
    return null;
  };
  const cambiar = visitar(raiz());
  if (!cambiar) throw new Error('No encuentro ModoProvider');
  cambiar(modo);
  await dormir(400);
}

async function correrPasos(pasos: Paso[]): Promise<void> {
  for (const p of pasos) {
    if (p.modo) await cambiarModo(p.modo);
    if (p.accion) await activar(p.accion);
    if (p.oferta) await elegirOferta(p.oferta);
    if (p.ir) {
      await ir(p.ir);
      await dormir(120);
      await desplazar(0).catch(() => {});
    } else if (p.desplazar !== undefined) {
      await desplazar(p.desplazar, p.ms ?? 0);
    } else if (p.pulsar) {
      pulsar(p.pulsar);
      await dormir(700);
    }
    if (p.espera) await dormir(p.espera);
  }
}

async function salirDeEscena(): Promise<void> {
  const e = escenaActual;
  escenaActual = null;
  if (e?.alSalir) {
    await correrPasos(e.alSalir).catch((err) => estadoTienda.avisos.push(`alSalir: ${String(err)}`));
    await dormir(500);
  }
}

async function abrirEscena(id: string): Promise<void> {
  const e = (guion.escenas as Escena[]).find((x) => x.id === id);
  if (!e) throw new Error(`Escena desconocida: ${id}`);
  await salirDeEscena();
  estadoTienda.plan = e.plan ?? null;
  estadoTienda.catalogo = e.catalogo === true;
  await ir(e.ruta);
  await dormir(500);
  await desplazar(0).catch(() => {});
  if (e.pasos) await correrPasos(e.pasos);
  escenaActual = e;
  await dormir(e.asentar ?? ASENTAR_MS);
}

async function gira(nombre: string, retraso: number): Promise<number> {
  const pasos = (guion.giras as Record<string, Paso[]>)[nombre];
  if (!pasos) throw new Error(`Gira desconocida: ${nombre}`);
  await salirDeEscena();
  estadoTienda.plan = null;
  if (retraso > 0) await dormir(retraso);
  const inicio = Date.now();
  await correrPasos(pasos);
  return Date.now() - inicio;
}

function leer(url: string): { accion: string; q: Record<string, string> } {
  const m = /:\/\/__tienda\/([a-z]+)\??(.*)$/.exec(url);
  if (!m) throw new Error(`URL de control mal formada: ${url}`);
  const q: Record<string, string> = {};
  for (const par of m[2]!.split('&')) {
    if (!par) continue;
    const [k, v = ''] = par.split('=');
    q[decodeURIComponent(k!)] = decodeURIComponent(v);
  }
  return { accion: m[1]!, q };
}

/** En un arranque en frío la orden llega antes de que la app haya pintado. */
async function esperarApp(): Promise<void> {
  if (estadoTienda.raiz) return;
  for (let i = 0; i < 200 && !estadoTienda.raiz; i += 1) await dormir(100);
  await dormir(3000);
}

async function atender(url: string): Promise<void> {
  const { accion, q } = leer(url);
  const token = q.token ?? null;
  await esperarApp();
  await escribirEstado({ token, accion, listo: false });
  try {
    const extra: Record<string, unknown> = {};
    if (accion === 'escena') await abrirEscena(q.id!);
    else if (accion === 'ir') {
      await salirDeEscena();
      await ir(q.ruta!);
      await dormir(500);
      if (q.y) await desplazar(Number(q.y));
    } else if (accion === 'desplazar') await desplazar(q.y === 'fin' ? 'fin' : Number(q.y), Number(q.ms ?? 0));
    else if (accion === 'pulsar') pulsar({ etiqueta: q.etiqueta, texto: q.texto });
    else if (accion === 'gira') extra.duracionRealMs = await gira(q.nombre!, Number(q.retraso ?? 0));
    else throw new Error(`Orden desconocida: ${accion}`);
    await escribirEstado({ token, accion, listo: true, ...extra });
  } catch (err) {
    await escribirEstado({ token, accion, listo: true, error: String(err) });
  }
}

export function ejecutar(url: string): void {
  cola = cola.then(() => atender(url));
}
