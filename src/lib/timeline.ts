// NIVL · Colocar el día sobre un eje de horas.
//
// Lo que faltaba para que la agenda se sintiera un calendario y no una lista:
// una hora ocupa un alto fijo, cada cosa se dibuja donde empieza y con lo que
// dura, y dos cosas a la vez se ven a la vez. Sin esto, un bloque de 20 minutos
// y otro de tres horas ocupaban lo mismo en pantalla y el día no se leía.
//
// Módulo puro, sin React ni Supabase: la colocación es aritmética y la
// aritmética se prueba.

/** Alto de una hora, en píxeles. 64 deja leer el título de un bloque de 30'. */
export const ALTO_HORA = 64;

export interface ItemTiempo {
  id: string;
  /** Minutos desde medianoche. */
  inicio: number;
  /** Minutos desde medianoche. Puede ser igual al inicio (evento sin duración). */
  fin: number;
}

export interface Colocado<T extends ItemTiempo> {
  item: T;
  top: number;
  alto: number;
  /** Columna que ocupa cuando hay solapes (0..columnas-1). */
  columna: number;
  columnas: number;
}

/** Alto mínimo para que un evento puntual siga siendo tocable y legible. */
const ALTO_MINIMO = 26;

/**
 * Rango de horas a pintar.
 *
 * Nunca las 24: un día que empieza a las 5:00 y acaba a las 22:00 no necesita
 * seis horas de vacío arriba y otras dos abajo, y en un móvil ese vacío es
 * justo lo que obliga a hacer scroll para encontrar lo que importa.
 *
 * Se toma lo que haya (bloques, eventos) y se le da una hora de margen por
 * arriba y por abajo, sin salirse del día.
 */
export function rangoHoras(
  items: ItemTiempo[],
  defecto: { desde: number; hasta: number } = { desde: 7, hasta: 23 },
): { desde: number; hasta: number } {
  if (!items.length) return defecto;
  const min = Math.min(...items.map((i) => i.inicio));
  const max = Math.max(...items.map((i) => Math.max(i.fin, i.inicio)));
  return {
    desde: Math.max(0, Math.floor(min / 60) - 1),
    hasta: Math.min(24, Math.ceil(max / 60) + 1),
  };
}

/**
 * Coloca los items en el eje, repartiendo en columnas los que se solapan.
 *
 * El reparto es el de un calendario de verdad: se recorre en orden de inicio y
 * cada item busca la primera columna libre; el ancho lo deciden cuántos hay a
 * la vez en ESE tramo, no cuántos hay en todo el día. Si no fuera así, dos
 * citas solapadas a las 9:00 dejarían el resto del día en media pantalla.
 */
export function disponer<T extends ItemTiempo>(
  items: T[],
  desdeHora: number,
): Colocado<T>[] {
  const ordenados = [...items].sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);
  const origen = desdeHora * 60;

  // Grupos de items conectados por solape: dentro de cada grupo se reparte el
  // ancho, y cada grupo empieza de cero.
  const grupos: T[][] = [];
  let grupo: T[] = [];
  let finGrupo = -1;

  for (const it of ordenados) {
    const fin = Math.max(it.fin, it.inicio + 1);
    if (grupo.length && it.inicio >= finGrupo) {
      grupos.push(grupo);
      grupo = [];
      finGrupo = -1;
    }
    grupo.push(it);
    finGrupo = Math.max(finGrupo, fin);
  }
  if (grupo.length) grupos.push(grupo);

  const salida: Colocado<T>[] = [];
  for (const g of grupos) {
    // Columnas del grupo: cada una guarda el minuto en el que queda libre.
    const libres: number[] = [];
    const asignada = new Map<string, number>();
    for (const it of g) {
      const fin = Math.max(it.fin, it.inicio + 1);
      let col = libres.findIndex((libreEn) => libreEn <= it.inicio);
      if (col === -1) {
        col = libres.length;
        libres.push(fin);
      } else {
        libres[col] = fin;
      }
      asignada.set(it.id, col);
    }
    for (const it of g) {
      const fin = Math.max(it.fin, it.inicio + 1);
      salida.push({
        item: it,
        top: ((it.inicio - origen) / 60) * ALTO_HORA,
        alto: Math.max(ALTO_MINIMO, ((fin - it.inicio) / 60) * ALTO_HORA),
        columna: asignada.get(it.id) ?? 0,
        columnas: libres.length,
      });
    }
  }

  return salida;
}

/** Posición vertical de una hora concreta dentro del eje. */
export function yDeMinuto(minuto: number, desdeHora: number): number {
  return ((minuto - desdeHora * 60) / 60) * ALTO_HORA;
}

/**
 * Carga de un día en 0..1, para pintar la densidad en la rejilla del mes.
 *
 * Se satura a las 8 horas ocupadas: por encima de eso la barra ya está llena y
 * distinguir 9 de 11 horas no aporta nada a un vistazo de un centímetro.
 */
export function cargaDelDia(items: ItemTiempo[], topeMinutos = 8 * 60): number {
  const ocupado = items.reduce((a, i) => a + Math.max(0, i.fin - i.inicio), 0);
  return Math.min(1, ocupado / topeMinutos);
}
