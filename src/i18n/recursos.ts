// NIVL · Idiomas: el registro de todos los namespaces (un JSON por carpeta).
//
// Están TODOS desde la tanda 0, vacíos ({}) hasta que su tanda los rellena:
// así las tandas que van en paralelo solo tocan su propio es/<ns>.json y nunca
// este archivo. Un namespace nuevo se añade aquí (y en NAMESPACES) y en el
// mapa de carpetas de scripts/i18n/inventario.mjs.
//
//   tanda 1: raiz, ui, arena (y comun, que se congela al terminarla)
//   tanda 2: hoy, habitos, agenda, campanas
//   tanda 3: perfil, acceso, puertas, onboarding
//   tanda 4: coach, oraculo, memoria, resumen, informe
//   tanda 5: gym, cardio, dieta, nutricion, fotos
//   tanda 6: diario, contrato, economia
//   tanda 7: amigos, avances, creador, compra, share, celebracion
//   tanda 8: voz (src/lib/voice.ts), avisos (src/lib/notifications.ts)
//   Modos F1: modos (src/components/modos)

import comun from './es/comun.json';
import raiz from './es/raiz.json';
import ui from './es/ui.json';
import arena from './es/arena.json';
import acceso from './es/acceso.json';
import agenda from './es/agenda.json';
import amigos from './es/amigos.json';
import avances from './es/avances.json';
import campanas from './es/campanas.json';
import cardio from './es/cardio.json';
import celebracion from './es/celebracion.json';
import coach from './es/coach.json';
import compra from './es/compra.json';
import contrato from './es/contrato.json';
import creador from './es/creador.json';
import diario from './es/diario.json';
import dieta from './es/dieta.json';
import economia from './es/economia.json';
import fotos from './es/fotos.json';
import gym from './es/gym.json';
import habitos from './es/habitos.json';
import hoy from './es/hoy.json';
import informe from './es/informe.json';
import memoria from './es/memoria.json';
import nutricion from './es/nutricion.json';
import onboarding from './es/onboarding.json';
import oraculo from './es/oraculo.json';
import perfil from './es/perfil.json';
import puertas from './es/puertas.json';
import resumen from './es/resumen.json';
import share from './es/share.json';
import voz from './es/voz.json';
import avisos from './es/avisos.json';
import modos from './es/modos.json';
import prueba from './es/prueba.json';

/** Los catálogos en español: la fuente de verdad de todas las claves. */
export const RECURSOS_ES = {
  comun,
  raiz,
  ui,
  arena,
  acceso,
  agenda,
  amigos,
  avances,
  campanas,
  cardio,
  celebracion,
  coach,
  compra,
  contrato,
  creador,
  diario,
  dieta,
  economia,
  fotos,
  gym,
  habitos,
  hoy,
  informe,
  memoria,
  nutricion,
  onboarding,
  oraculo,
  perfil,
  puertas,
  resumen,
  share,
  voz,
  avisos,
  // Modos F1 (src/components/modos): fuera de las tandas de 1.0.10.
  modos,
  // Prueba automática de Élite (0069, src/components/prueba).
  prueba,
};

export type RecursosEs = typeof RECURSOS_ES;
export type Namespace = keyof RecursosEs;

export const NAMESPACES = Object.keys(RECURSOS_ES) as Namespace[];

type Arbol = { [clave: string]: string | string[] | Arbol };

/**
 * i18next no cae de `_many` a `_other`: en es, fr, it y pt «many» existe
 * (1.000.000 en es) y sin esta copia saldría la clave en crudo. Se rellena
 * `_many` con `_other` donde falte, sin tocar el catálogo.
 */
export function completarPlurales<T extends Arbol>(arbol: T): T {
  const out: Arbol = {};
  for (const [clave, valor] of Object.entries(arbol)) {
    // Los arrays (bancos de frases de `voz`, con returnObjects) se quedan como arrays.
    out[clave] = typeof valor === 'string' || Array.isArray(valor) ? valor : completarPlurales(valor);
  }
  for (const [clave, valor] of Object.entries(arbol)) {
    if (typeof valor !== 'string' || !clave.endsWith('_other')) continue;
    const many = `${clave.slice(0, -'_other'.length)}_many`;
    if (!(many in out)) out[many] = valor;
  }
  return out as T;
}

/** Un idioma entero con los plurales completados. */
export function completarIdioma(recursos: Record<string, Arbol>): Record<string, Arbol> {
  const out: Record<string, Arbol> = {};
  for (const [ns, arbol] of Object.entries(recursos)) out[ns] = completarPlurales(arbol);
  return out;
}
