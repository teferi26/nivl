// NIVL · Resistencia: el texto de una sesión del plan, en el idioma de la interfaz.
//
// `plan_sesiones` guarda lo que escribe `generarPlan`, en español y compartido con
// el coach. Aquí se resuelve por clave al pintar; lo que no se reconoce (lo que
// ha reescrito el coach) sale tal cual.

import { t } from '@/i18n';

const TITULOS = {
  Series: 'series',
  'Rodaje con progresiones': 'progresiones',
  'Rodaje suave': 'rodajeSuave',
  'Fuerza para correr': 'fuerza',
  'Rodaje de recuperación': 'recuperacion',
  'Tirada larga': 'tirada',
  'Técnica de natación': 'tecnicaNatacion',
  'Natación aeróbica': 'natacionAerobica',
  'Series de carrera': 'seriesCarrera',
  'Rodaje aeróbico': 'rodajeAerobico',
  'Bloques de bici': 'bloquesBici',
  'Bici aeróbica': 'biciAerobica',
  'Brick: bici y carrera': 'brick',
  'Salida larga de bici': 'salidaBici',
  'Práctica de transiciones': 'transiciones',
  Descanso: 'descanso',
  Activación: 'activacion',
  'Rodaje de piernas sueltas': 'piernasSueltas',
  'Rodaje corto': 'rodajeCorto',
  'Bici corta': 'biciCorta',
  'Natación corta': 'natacionCorta',
  'Día de carrera': 'diaPrueba',
} as const;

const DETALLES = {
  'Calienta bien y haz series con recuperación completa. Vuelta a la calma suave.': 'seriesCalma',
  'Ritmo cómodo y unas progresiones cortas al final.': 'progresiones',
  'Ritmo de conversación. Hoy no se demuestra nada.': 'conversacionHoy',
  'Sentadilla, peso muerto rumano, gemelo y core. Sin llegar al fallo.': 'fuerza',
  'Corto y muy suave.': 'cortoSuave',
  'Ritmo cómodo de principio a fin. Ensaya la bebida y la comida de la carrera.': 'tiradaEnsayo',
  'Series cortas con descanso. Cuida la posición y la respiración.': 'tecnicaNatacion',
  'Bloques largos a ritmo continuo, mirando al frente cada pocas brazadas.': 'natacionAerobica',
  'Calienta bien y haz series con recuperación completa.': 'series',
  'Ritmo de conversación.': 'conversacion',
  'Ritmo cómodo de principio a fin.': 'comodo',
  'Bloques a ritmo de prueba con recuperación suave entre ellos.': 'bloquesBici',
  'Cadencia alta y pedaleo redondo.': 'biciAerobica',
  'Ritmo cómodo. Ensaya la bebida y la comida de la carrera.': 'salidaBici',
  'Repite el paso de neopreno a bici y de bici a zapatillas hasta que salga sin pensar.': 'transiciones',
  'Descansa, bebe y duerme.': 'descanso',
  'Muy corto, con tres o cuatro aceleraciones. Prepara el material y la comida.': 'activacion',
  'Corto y cómodo.': 'cortoComodo',
  'Corto, con la cabeza en la carrera.': 'rodajeCorto',
  'Comprueba la bici tal como vas a correr.': 'biciCorta',
  'Suave, con unas salidas a ritmo de prueba.': 'natacionCorta',
  'Sal a tu ritmo y come según lo ensayado.': 'prueba',
} as const;

type ClaveTitulo = (typeof TITULOS)[keyof typeof TITULOS];
type ClaveDetalle = (typeof DETALLES)[keyof typeof DETALLES];

const BRICK = /^(\d+) min de bici y, sin pausa, (\d+) min de carrera\./;
// i18n-ok
const FIN_PRUEBA = 'Sal a tu ritmo y come según lo ensayado.';

/** La clave de un título que escribe `generarPlan`, o null si es de otra mano. */
export const claveTitulo = (titulo: string): ClaveTitulo | null => (TITULOS as Record<string, ClaveTitulo>)[titulo] ?? null;

export function tituloSesion(titulo: string): string {
  const clave = claveTitulo(titulo);
  return clave ? t(`resistenciaPlan:sesion.titulo.${clave}`) : titulo;
}

/** ¿Es un detalle que escribe `generarPlan`? La partes de la prueba llevan cifras. */
export function esDetalleDelPlan(detalle: string): boolean {
  return detalle in DETALLES || BRICK.test(detalle) || detalle.endsWith(FIN_PRUEBA);
}

export function detalleSesion(detalle: string): string {
  const fija = (DETALLES as Record<string, ClaveDetalle>)[detalle];
  if (fija) return t(`resistenciaPlan:sesion.detalle.${fija}`);
  const brick = BRICK.exec(detalle);
  if (brick) return t('resistenciaPlan:sesion.detalle.brick', { bici: brick[1], pie: brick[2] });
  if (detalle.endsWith(FIN_PRUEBA)) {
    const partes = [
      [/(\d+) m de natación/, 'natacion'],
      [/([\d,]+) km de bici/, 'bici'],
      [/([\d,]+) km de carrera/, 'pie'],
    ] as const;
    const lista = partes.flatMap(([re, k]) => {
      const m = re.exec(detalle);
      return m ? [t(`resistenciaPlan:sesion.parte.${k}`, { valor: m[1] })] : [];
    });
    return [lista.join(' · '), t('resistenciaPlan:sesion.detalle.prueba')].filter(Boolean).join('. ');
  }
  return detalle;
}
