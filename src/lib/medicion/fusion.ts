// NIVL · ¿Son el mismo entreno? (puro, con tests).
//
// El mismo rodaje puede llegar del reloj y de otra app a través de Salud, cada
// uno con su `externo_id`. La llave no basta: aquí se mira si se solapan.

import { esResistencia, type EntrenoMedido, type OrigenEntreno } from '../entrenoMedido';

const SOLAPE_MINIMO = 0.5;
/** Lo mínimo para que un entreno cobre (regla 2 de la economía). */
const SEGUNDOS_MINIMOS_PAGO = 300;
const DEPORTES_QUE_PAGAN: readonly EntrenoMedido['deporte'][] = [
  'carrera',
  'bici',
  'piscina',
  'aguas_abiertas',
];
const PRIORIDAD: Record<OrigenEntreno, number> = { watch: 3, iphone_gps: 2, salud: 1, manual: 0 };

/** Mismo `externo_id`, o solape de al menos media sesión de la más corta y misma familia. */
export function mismoEntreno(a: EntrenoMedido, b: EntrenoMedido): boolean {
  if (a.externo_id === b.externo_id) return true;
  if (esResistencia(a.deporte) !== esResistencia(b.deporte)) return false;
  const inicioA = Date.parse(a.inicio);
  const finA = Date.parse(a.fin);
  const inicioB = Date.parse(b.inicio);
  const finB = Date.parse(b.fin);
  const corta = Math.min(finA - inicioA, finB - inicioB);
  // Con una fecha rota `corta` es NaN y esto da false.
  if (!(corta > 0)) return false;
  const solape = Math.min(finA, finB) - Math.max(inicioA, inicioB);
  return solape >= corta * SOLAPE_MINIMO;
}

function camposMedidos(e: EntrenoMedido): number {
  const opcionales = [
    e.distancia_m,
    e.kcal,
    e.fc_media,
    e.fc_max,
    e.desnivel_m,
    e.ruta,
    e.largo_piscina_m,
    e.fc_serie,
  ];
  return opcionales.filter((v) => v !== null && v !== undefined).length + (e.parciales.length > 0 ? 1 : 0);
}

/** El mejor de dos duplicados. En empate total se queda `a`, el que ya estaba. */
export function elegirEntre(a: EntrenoMedido, b: EntrenoMedido): EntrenoMedido {
  if (PRIORIDAD[a.origen] !== PRIORIDAD[b.origen]) {
    return PRIORIDAD[a.origen] > PRIORIDAD[b.origen] ? a : b;
  }
  const rutaA = a.ruta !== null;
  if (rutaA !== (b.ruta !== null)) return rutaA ? a : b;
  return camposMedidos(b) > camposMedidos(a) ? b : a;
}

function pudoPagar(e: EntrenoMedido): boolean {
  return DEPORTES_QUE_PAGAN.includes(e.deporte) && e.duracion_s >= SEGUNDOS_MINIMOS_PAGO;
}

/** ¿El ya conocido `k` hace innecesario guardar el candidato `c`? */
function loCubre(k: EntrenoMedido, c: EntrenoMedido): boolean {
  if (!mismoEntreno(k, c)) return false;
  if (k.externo_id === c.externo_id) return true;
  // Lo apuntado a mano no tapa lo medido: es justo lo que luego se contrasta.
  if (k.origen === 'manual' && c.origen !== 'manual') return false;
  // Un duplicado que no pudo cobrar (`otro`, menos de 5 min) no deja al bueno sin evaluar.
  return pudoPagar(k) || !pudoPagar(c);
}

/**
 * Los candidatos que hay que guardar: fuera lo que ya se conoce y, dentro del
 * lote, un solo representante por entreno. Un conocido nunca se sustituye desde
 * aquí: un duplicado de lo ya guardado se descarta aunque tenga mejor origen,
 * porque guardarlo como fila nueva lo haría pasar por el pago otra vez.
 */
export function filtrarNuevos(
  candidatos: readonly EntrenoMedido[],
  conocidos: readonly EntrenoMedido[],
): EntrenoMedido[] {
  const lote: EntrenoMedido[] = [];
  for (const c of candidatos) {
    if (conocidos.some((k) => loCubre(k, c))) continue;
    const i = lote.findIndex((v) => mismoEntreno(v, c));
    if (i < 0) {
      lote.push(c);
      continue;
    }
    const previo = lote[i]!;
    if (pudoPagar(previo) !== pudoPagar(c)) lote[i] = pudoPagar(previo) ? previo : c;
    else lote[i] = elegirEntre(previo, c);
  }
  return lote;
}
