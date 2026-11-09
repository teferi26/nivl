// NIVL · El freno de edad para calorías y déficit. Módulo puro: lo usan las herramientas y el contexto.
//
// La ficha solo guarda el año de nacimiento: quien nació hace 18 años naturales aún puede tener 17, así
// que se cuenta la edad más baja posible. Sin año no se puede confirmar la edad y el freno también aplica.

export type FrenoEdad = 'libre' | 'menor' | 'sin_edad';

export function frenoEdad(anioNacimiento: unknown, anioActual: number): FrenoEdad {
  const n = Number(anioNacimiento);
  if (anioNacimiento === null || anioNacimiento === undefined || !Number.isInteger(n) || n < 1900 || n > anioActual) return 'sin_edad';
  return anioActual - n - 1 < 18 ? 'menor' : 'libre';
}

export const LINEA_FRENO: Record<Exclude<FrenoEdad, 'libre'>, string> = {
  menor:
    'FRENO DE EDAD: puede ser menor de 18. Sin déficit, sin objetivo de bajar peso, sin cifras de calorías y sin fijar_nutricion. Habla de hábitos, comida suficiente, sueño y técnica, y de hacerlo con su familia y un profesional.',
  sin_edad:
    'FRENO DE EDAD: no consta su año de nacimiento. Hasta que lo diga y lo guardes con fijar_ficha, sin déficit, sin objetivo de bajar peso y sin cifras de calorías.',
};
