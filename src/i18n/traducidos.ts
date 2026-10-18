// NIVL · Idiomas (Modos F1): los catálogos traducidos, src/i18n/<lng>/<ns>.json.
//
// GENERADO por scripts/i18n/registrar-traducidos.mjs: no se edita a mano.
// Mismos namespaces y claves que src/i18n/es (el español sigue siendo la fuente
// de verdad y el tipo de las claves); __tests__/traducidos.test.ts lo comprueba.
// Van dentro del paquete: el init de i18next es síncrono.

import type { RecursosEs } from './recursos';
import enComun from './en/comun.json';
import enRaiz from './en/raiz.json';
import enUi from './en/ui.json';
import enArena from './en/arena.json';
import enAcceso from './en/acceso.json';
import enAgenda from './en/agenda.json';
import enAmigos from './en/amigos.json';
import enAvances from './en/avances.json';
import enCampanas from './en/campanas.json';
import enCardio from './en/cardio.json';
import enCelebracion from './en/celebracion.json';
import enCoach from './en/coach.json';
import enCompra from './en/compra.json';
import enContrato from './en/contrato.json';
import enCreador from './en/creador.json';
import enDiario from './en/diario.json';
import enDieta from './en/dieta.json';
import enEconomia from './en/economia.json';
import enFotos from './en/fotos.json';
import enGym from './en/gym.json';
import enHabitos from './en/habitos.json';
import enHoy from './en/hoy.json';
import enInforme from './en/informe.json';
import enMemoria from './en/memoria.json';
import enNutricion from './en/nutricion.json';
import enOnboarding from './en/onboarding.json';
import enOraculo from './en/oraculo.json';
import enPerfil from './en/perfil.json';
import enPuertas from './en/puertas.json';
import enResumen from './en/resumen.json';
import enShare from './en/share.json';
import enVoz from './en/voz.json';
import enAvisos from './en/avisos.json';

/** Los idiomas con interfaz traducida (el español no está: es la base). */
export const IDIOMAS_TRADUCIDOS = ['en'] as const;
export type IdiomaTraducido = (typeof IDIOMAS_TRADUCIDOS)[number];

type Catalogo = { [K in keyof RecursosEs]: unknown };

export const RECURSOS_LOCALES: Record<IdiomaTraducido, Catalogo> = {
  en: {
    comun: enComun,
    raiz: enRaiz,
    ui: enUi,
    arena: enArena,
    acceso: enAcceso,
    agenda: enAgenda,
    amigos: enAmigos,
    avances: enAvances,
    campanas: enCampanas,
    cardio: enCardio,
    celebracion: enCelebracion,
    coach: enCoach,
    compra: enCompra,
    contrato: enContrato,
    creador: enCreador,
    diario: enDiario,
    dieta: enDieta,
    economia: enEconomia,
    fotos: enFotos,
    gym: enGym,
    habitos: enHabitos,
    hoy: enHoy,
    informe: enInforme,
    memoria: enMemoria,
    nutricion: enNutricion,
    onboarding: enOnboarding,
    oraculo: enOraculo,
    perfil: enPerfil,
    puertas: enPuertas,
    resumen: enResumen,
    share: enShare,
    voz: enVoz,
    avisos: enAvisos,
  },
};
