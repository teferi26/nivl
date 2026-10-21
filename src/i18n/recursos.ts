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
//   QA F1: juego (src/lib/game.ts y kinds.ts) y oferta (src/lib/proplans.ts)

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
// Modos: cada modo es un mundo (src/app/(iron), (focus), (work), (founder)).
import mundos from './es/mundos.json';
import prueba from './es/prueba.json';
// Modos F1 (motor de IRON): solo la galería de desarrollo /kit/iron por ahora.
import iron from './es/iron.json';
// QA F1 (M4): los textos de src/lib que se ven (game, kinds y la oferta de proplans).
import juego from './es/juego.json';
import oferta from './es/oferta.json';
// IRON fase 2: un catálogo de ejercicios por grupo.
// brazos
import ironBrazos from './es/iron-brazos.json';
// IRON fase 2: un namespace por grupo de ejercicios.
import ironEspalda from './es/iron-espalda.json';
// IRON fase 2: un catálogo de ejercicios por grupo.
import ironPierna from './es/iron-pierna.json';
// IRON fase 2, grupo core y cardio.
import ironCore from './es/iron-core.json';
// IRON fase 2: catálogo de hombro.
import ironHombro from './es/iron-hombro.json';
// IRON fase 2: un namespace por grupo de ejercicios.
import ironPecho from './es/iron-pecho.json';
// Modos v2: el mundo FOCUS (src/components/focus).
import focus from './es/focus.json';

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
  mundos,
  // Prueba automática de Élite (0069, src/components/prueba).
  prueba,
  iron,
  // QA F1: tablas de juego y perfiles de uso (game.ts, kinds.ts) y la oferta (proplans.ts).
  juego,
  oferta,
  // brazos
  'iron-brazos': ironBrazos,
  'iron-espalda': ironEspalda,
  'iron-pierna': ironPierna,
  'iron-core': ironCore,
  'iron-hombro': ironHombro,
  'iron-pecho': ironPecho,
  focus,
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
