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
    titular: ['Sube de nivel', 'cada día'],
    sub: ['Misiones, racha y rango.', 'Tu vida, convertida en arena.'],
  },
  coach: {
    titular: ['Un coach que', 'manda en tu día'],
    sub: ['Con suscripción. Te escribe el plan', 'y ordena tus horas.'],
  },
  habitos: {
    titular: ['Tus reglas.', 'Tu contrato.'],
    sub: ['Firma tus normas y cúmplelas.', 'Cada fallo tiene consecuencia.'],
  },
  campanas: {
    titular: ['Conquista', 'tus metas'],
    sub: ['Campañas con fecha, jefe final', 'y botín al despejarlas.'],
  },
  perfil: {
    titular: ['De rango E', 'a rango S'],
    sub: ['Cada día cuenta. Cada nivel se gana.', 'Nadie te lo regala.'],
  },
  // Nuevos, en la misma voz.
  agenda: {
    titular: ['Tu día', 'en orden'],
    sub: ['Bloques, horas y misiones.', 'Cada hora tiene su batalla.'],
  },
  gym: {
    titular: ['Cada serie', 'queda escrita'],
    sub: ['Cargas, récords y progresión.', 'El hierro lleva la cuenta.'],
  },
  cardio: {
    titular: ['Cada zancada', 'queda escrita'],
    sub: ['Ritmo, distancia y zonas.', 'El camino también es arena.'],
  },
  nutricion: {
    titular: ['Lo que comes', 'también pelea'],
    sub: ['Comidas, proteína y objetivo.', 'Sin excusas en el plato.'],
  },
  finanzas: {
    titular: ['Tu dinero', 'a la vista'],
    sub: ['Gasto, cargos y meses de aire.', 'Mides tú. Decides tú.'],
  },
  diario: {
    titular: ['Escribe', 'tu crónica'],
    sub: ['Cada noche, lo que hiciste.', 'La arena tiene memoria.'],
  },
  amigos: {
    titular: ['No luchas', 'solo'],
    sub: ['Amigos, clasificación y duelos.', 'Cada uno responde de lo suyo.'],
  },
  foco: {
    titular: ['Una batalla', 'cada vez'],
    sub: ['Bloques de foco sin ruido.', 'Cierra lo que empiezas.'],
  },
  rueda: {
    titular: ['Un modo', 'para cada batalla'],
    sub: ['IRON, FOCUS, WORK y FOUNDER.', 'Cada uno con su mundo.'],
  },
  'iron-hoy': {
    titular: ['Tu cuerpo,', 'por escrito'],
    sub: ['Sesiones, cargas y progresión.', 'Con su coach, por suscripción.'],
  },
  'focus-hoy': {
    titular: ['Una batalla', 'cada vez'],
    sub: ['Bloques, temario y exámenes.', 'Con su coach, por suscripción.'],
  },
  'work-hoy': {
    titular: ['Tu jornada,', 'bajo control'],
    sub: ['Bloques, proyectos y entregas.', 'Con su coach, por suscripción.'],
  },
  'founder-hoy': {
    titular: ['Tu negocio,', 'a la vista'],
    sub: ['Agenda, decisiones y números.', 'Con su coach, por suscripción.'],
  },
  avances: {
    titular: ['Cada marca', 'cuenta'],
    sub: ['XP, cumplimiento y racha.', 'Tu historia, en cifras.'],
  },
  resumen: {
    titular: ['Cada semana', 'rindes cuentas'],
    sub: ['Lo hecho y lo pendiente.', 'El sistema no olvida.'],
  },
  pro: {
    titular: ['El coach', 'en tu arena'],
    sub: ['NIVL Pro: el sistema te lee el día', 'y te dice qué toca.'],
  },
  onboarding: {
    titular: ['Entra en', 'la arena'],
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
