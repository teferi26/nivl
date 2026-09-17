// NIVL · Paleta "arena": negro, hueso, hierro y una sola gota de sangre.
//
// Antes esto era el azul gladiador de Solo Leveling. Con NIVL abierta a la gente
// de Franky (emprendedores, deportistas, estudiantes) la interfaz pasa a un
// monocromo de gladiador: el blanco es el idioma, el gris hierro estructura,
// el rojo solo avisa y el oro de laurel solo corona (rachas, hitos). El
// violeta Franky aparece únicamente en la marca "by Franky" y en el botón de
// cuenta Franky: es un sello, no un color de interfaz.
//
// Los NOMBRES de los tokens son semánticos a propósito (accent, steel, gold):
// se puede cambiar un valor sin tocar cincuenta pantallas.
export const colors = {
  bg: '#050505',
  panel: '#0D0D0D',
  panelDeep: '#090909',
  tabBar: '#050505',
  line: '#262626',
  // El idioma de la interfaz: nivel, XP, CTAs, activo.
  accent: '#FFFFFF',
  accentDim: '#5A5A5A',
  accentFaint: '#191919',
  accentText: '#CFCBC2',
  // SOLO campañas (proyectos): acero, un escalón por debajo del blanco.
  steel: '#B9B9B9',
  steelDim: '#454545',
  steelPanel: '#0B0B0B',
  steelText: '#D8D8D8',
  // SOLO alertas y penalización.
  red: '#D8414F',
  redDim: '#6B242B',
  redPanel: '#140A0B',
  redText: '#E8C9CD',
  // SOLO rachas y hitos: el laurel.
  gold: '#D6B76A',
  goldDim: '#4A3E1E',
  text: '#ECE9E2',
  textDim: '#A5A29A',
  textFaint: '#7A776F',
  track: '#1C1C1C',
  // El sello de Franky. No se usa como color de interfaz.
  franky: '#8B5CF6',
} as const;

export const fonts = {
  // Cinzel: la piedra tallada. SOLO marca, números de nivel y momentos épicos.
  brand: 'Cinzel_700Bold',
  number: 'Cinzel_600SemiBold',
  // Outfit: la misma familia que usa Franky en web y app.
  heading: 'Outfit_700Bold',
  semibold: 'Outfit_600SemiBold',
  body: 'Outfit_500Medium',
} as const;
