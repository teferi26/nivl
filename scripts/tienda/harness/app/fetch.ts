// expo/fetch va por otro camino nativo: también queda cortado.
export async function fetch(): Promise<never> {
  throw new Error('ARNES_SIN_RED: esta build solo usa datos ficticios locales.');
}
