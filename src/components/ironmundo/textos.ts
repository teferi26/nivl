// NIVL · Mundo IRON: textos que salen de los datos (sin efectos). Los usan
// los hooks y la galería.

import { kgTexto } from '@/components/iron/HistorialIron';
import { t } from '@/i18n';
import { fechaCorta, nombreDia } from '@/i18n/formato';
import { weekdayOfKey } from '@/lib/dates';
import { entrenoDeHoy } from './calculos';
import type { EntradaEntrenoHoy } from './InicioIronVista';

/** «mar 20 oct». */
export function fechaIron(key: string): string {
  return t('ironmundo:fechaCorta', { dia: nombreDia(weekdayOfKey(key) - 1).slice(0, 3), fecha: fechaCorta(key) });
}

/** La palabra del coach en la tarjeta: lo que toca hoy, dicho por el sistema. */
export function palabraCoach(e: EntradaEntrenoHoy): string {
  if (!e.cargado) return t('ironmundo:coach.cargando');
  if (e.xpHecho !== null) return t('ironmundo:coach.hecho');
  const hoy = entrenoDeHoy({ dias: e.dias, ejercicios: e.ejercicios, prescrito: e.prescrito, hoyDia: e.hoyDia });
  const primera = hoy.filas.find((f) => f.kg !== null && f.kg > 0) ?? hoy.filas[0];
  if (!primera) return e.dias.length === 0 ? t('ironmundo:coach.sinRutina') : t('ironmundo:coach.descanso');
  return primera.kg !== null && primera.kg > 0
    ? t('ironmundo:coach.carga', { kg: kgTexto(primera.kg), nombre: primera.nombre.toLowerCase(), series: primera.series, reps: primera.reps })
    : t('ironmundo:coach.sinCarga', { nombre: primera.nombre.toLowerCase(), series: primera.series, reps: primera.reps });
}
