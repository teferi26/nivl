// NIVL · FOCUS: el arranque guiado (puro, con tests): qué falta para tener plan
// y las plantillas por perfil. Cero prosa: las asignaturas de una plantilla son
// claves de focus:plantillas.*.

import type { DatosFocus, PerfilFocus } from './tipos';

export type PasoArranque = 'perfil' | 'asignaturas' | 'temario' | 'examen' | 'horario';

export interface Plantilla {
  /** Claves de focus:plantillas.* */
  asignaturas: readonly string[];
  minutosDia: number;
  /** Si el horario de clases tiene sentido en este perfil. */
  conHorario: boolean;
}

export const PLANTILLAS: Record<PerfilFocus, Plantilla> = {
  oposicion: { asignaturas: ['temario'], minutosDia: 300, conHorario: false },
  universidad: { asignaturas: [], minutosDia: 180, conHorario: true },
  instituto: {
    asignaturas: ['lengua', 'historia', 'ingles', 'matematicas', 'fisica', 'quimica', 'biologia', 'filosofia'],
    minutosDia: 120,
    conHorario: true,
  },
};

/** Los pasos que faltan, en el orden en que se piden. */
export function pasosQueFaltan(d: DatosFocus): PasoArranque[] {
  const out: PasoArranque[] = [];
  const perfil = d.prefs.perfil;
  if (perfil === null) out.push('perfil');
  if (d.asignaturas.length === 0) out.push('asignaturas');
  if (d.temas.length === 0) out.push('temario');
  if (!d.examenes.some((x) => x.tipo !== 'entrega')) out.push('examen');
  if (perfil !== null && PLANTILLAS[perfil].conHorario && d.clases.length === 0) out.push('horario');
  return out;
}

/** ¿Enseñar el arranque guiado en vez del reloj grande? */
export function hayQueArrancar(d: DatosFocus): boolean {
  return !d.prefs.arranqueHecho && d.asignaturas.length === 0;
}
