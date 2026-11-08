// NIVL · Paleta «Ónix».
//
// Fuente única: src/design/tokens.ts (docs/design-v2/SISTEMA.md). Aquí solo se
// mapean los nombres antiguos a la escala para que toda la app cambie de golpe.
//
// El significado va así:
//   · hueso (botón claro con texto oscuro) → lo activo, lo hecho, la acción;
//   · oro → un hilo en cifras, rótulos y marcos de logro; nunca un relleno;
//   · trama (rayado a 45°) → alerta, penalización, bloqueado.
// `red` y `steel` siguen existiendo como NOMBRES, pero valen un tono de la
// escala: quien quiera decir «alerta» usa <Trama/> o Card alerta.
import { ink, oro } from '@/design/tokens';

export const colors = {
  bg: ink.ink0,
  panel: ink.ink1,
  panelDeep: ink.ink0,
  tabBar: ink.ink0,
  line: ink.ink3,
  // El idioma de la interfaz: nivel, XP, CTAs, activo.
  accent: ink.ink10,
  accentDim: ink.ink4,
  accentFaint: ink.ink3,
  accentText: ink.ink8,
  // Campañas: ya sin acero propio, la misma escala.
  steel: ink.ink8,
  steelDim: ink.ink4,
  steelPanel: ink.ink1,
  steelText: ink.ink8,
  // Alertas: el significado lo pone la trama, no este valor.
  red: ink.ink10,
  redDim: ink.ink6,
  redPanel: ink.ink2,
  redText: ink.ink9,
  // Logros: el hilo de oro.
  gold: oro.hilo,
  goldDim: oro.borde,
  text: ink.ink9,
  textDim: ink.ink8,
  textFaint: ink.ink6,
  // Pista de barras y primer escalón del Heatmap: [track, accentFaint, accentDim, accent] crece.
  track: ink.ink2,
} as const;

export const fonts = {
  // Playfair Display: la marca, los títulos y las cifras.
  brand: 'PlayfairDisplay_700Bold',
  number: 'PlayfairDisplay_700Bold',
  // Outfit: la voz.
  heading: 'Outfit_700Bold',
  semibold: 'Outfit_600SemiBold',
  body: 'Outfit_500Medium',
} as const;
