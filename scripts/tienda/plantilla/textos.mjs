// Titulares de la tienda por escena. Puro: lo leen el compositor y sus tests.
// Voz del sistema: frases cortas, dramatismo sobrio, sin precios, sin promesas
// de resultado y sin comparativas. Vocabulario de gladiador.
//
// `titular` son dos líneas (teléfono); en formatos anchos se unen en una.
// `sub` son dos trozos que en formatos anchos también se unen: cada uno debe
// leerse bien seguido del otro.

export const TEXTOS = {
  // Los cinco de la ficha 1.0.10.
  hoy: {
    titular: ['SUBE DE NIVEL', 'CADA DÍA'],
    sub: ['Misiones, racha y rango.', 'Tu vida, convertida en arena.'],
  },
  coach: {
    titular: ['UN COACH QUE', 'MANDA EN TU DÍA'],
    sub: ['Con NIVL Pro o Élite. Te escribe el plan', 'y ordena tus horas.'],
  },
  habitos: {
    titular: ['TUS REGLAS.', 'TU CONTRATO.'],
    sub: ['Firma tus normas y cúmplelas.', 'Cada fallo tiene consecuencia.'],
  },
  campanas: {
    titular: ['CONQUISTA', 'TUS METAS'],
    sub: ['Campañas con fecha, jefe final', 'y botín al despejarlas.'],
  },
  perfil: {
    titular: ['DE RANGO E', 'A RANGO S'],
    sub: ['Cada día cuenta. Cada nivel se gana.', 'Nadie te lo regala.'],
  },
  // Nuevos, en la misma voz.
  agenda: {
    titular: ['TU DÍA', 'EN ORDEN'],
    sub: ['Bloques, horas y misiones.', 'Cada hora tiene su batalla.'],
  },
  gym: {
    titular: ['CADA SERIE', 'QUEDA ESCRITA'],
    sub: ['Cargas, récords y progresión.', 'El hierro lleva la cuenta.'],
  },
  cardio: {
    titular: ['CADA ZANCADA', 'QUEDA ESCRITA'],
    sub: ['Ritmo, distancia y zonas.', 'El camino también es arena.'],
  },
  nutricion: {
    titular: ['LO QUE COMES', 'TAMBIÉN PELEA'],
    sub: ['Comidas, proteína y objetivo.', 'Sin excusas en el plato.'],
  },
  finanzas: {
    titular: ['TU DINERO', 'A LA VISTA'],
    sub: ['Gasto, cargos y meses de aire.', 'Mides tú. Decides tú.'],
  },
  diario: {
    titular: ['ESCRIBE', 'TU CRÓNICA'],
    sub: ['Cada noche, lo que hiciste.', 'La arena tiene memoria.'],
  },
  amigos: {
    titular: ['NO LUCHAS', 'SOLO'],
    sub: ['Amigos, clasificación y ludus.', 'Cada uno responde de lo suyo.'],
  },
  foco: {
    titular: ['UNA BATALLA', 'CADA VEZ'],
    sub: ['Bloques de foco sin ruido.', 'Cierra lo que empiezas.'],
  },
  avances: {
    titular: ['CADA MARCA', 'CUENTA'],
    sub: ['Peso, fotos y tendencias.', 'Tu historia, en cifras.'],
  },
  resumen: {
    titular: ['CADA SEMANA', 'RINDES CUENTAS'],
    sub: ['Lo hecho y lo pendiente.', 'El sistema no olvida.'],
  },
  pro: {
    titular: ['EL COACH', 'EN TU ARENA'],
    sub: ['NIVL Pro: el sistema te lee el día', 'y te dice qué toca.'],
  },
  onboarding: {
    titular: ['ENTRA EN', 'LA ARENA'],
    sub: ['Eliges tu perfil y tus reglas.', 'Firmas. Empieza el combate.'],
  },
};

/** Otros nombres con los que puede llegar una escena desde el arnés. */
export const ALIAS = {
  inicio: 'hoy',
  contrato: 'habitos',
  reglas: 'habitos',
  mazmorras: 'campanas',
  campañas: 'campanas',
  rangos: 'perfil',
  entreno: 'gym',
  dieta: 'nutricion',
  economia: 'finanzas',
  dinero: 'finanzas',
  arena: 'amigos',
  ranking: 'amigos',
  ludus: 'amigos',
  informe: 'resumen',
  avance: 'avances',
};

/** Acepta `hoy`, `01-hoy` o `01-hoy.png`. */
export function normalizarEscena(escena) {
  return String(escena)
    .trim()
    .toLowerCase()
    .replace(/\.(png|jpe?g)$/, '')
    .replace(/^\d+[-_]/, '');
}

export function textoDe(escena) {
  const limpia = normalizarEscena(escena);
  const clave = ALIAS[limpia] ?? limpia;
  const texto = TEXTOS[clave];
  if (!texto) {
    throw new Error(
      `No hay titular para la escena «${escena}». Añádelo en scripts/tienda/plantilla/textos.mjs. Hay: ${Object.keys(TEXTOS).join(', ')}`,
    );
  }
  return texto;
}
