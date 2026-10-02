// NIVL · Paleta v2 «Mármol y tinta»: solo blanco y negro.
//
// Fuente única: `ink` de src/design/tokens.ts (docs/design-v2/SISTEMA.md). Aquí
// solo se mapean los nombres antiguos a la escala nueva para que toda la app
// cambie de golpe sin tocar cincuenta pantallas.
//
// No hay rojo, oro, acero ni violeta. El significado ya no va en el color:
//   · inversión (blanco con texto negro) → lo activo, lo hecho, la acción;
//   · peso del trazo → jerarquía y rango;
//   · trama (rayado a 45°) → alerta, penalización, bloqueado (antes, el rojo);
//   · grano (puntos finos) → logro, racha, Élite (antes, el oro).
// Por eso `red`, `gold` o `steel` siguen existiendo como NOMBRES, pero valen un
// gris de la escala: quien quiera decir «alerta» usa <Trama/> o Card alerta, y
// quien quiera decir «logro», <Grano/> o Card logro (src/components/ui).
import { ink } from '@/design/tokens';

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
  // Logros: el significado lo pone el grano, no este valor.
  gold: ink.ink10,
  goldDim: ink.ink6,
  text: ink.ink9,
  textDim: ink.ink8,
  textFaint: ink.ink6,
  // Pista de barras y primer escalón del Heatmap: [track, accentFaint, accentDim, accent] crece.
  track: ink.ink2,
  // Antes el violeta de Franky; ahora blanco (la marca va en la forma, no en el color).
  franky: ink.ink10,
} as const;

export const fonts = {
  // Cinzel: la piedra tallada. SOLO marca, números de nivel y momentos épicos.
  brand: 'Cinzel_700Bold',
  number: 'Cinzel_600SemiBold',
  // Outfit: la voz.
  heading: 'Outfit_700Bold',
  semibold: 'Outfit_600SemiBold',
  body: 'Outfit_500Medium',
} as const;
