import { describe, expect, test } from '@jest/globals';
import { parsear, trocear } from '../markdown';

describe('trocear', () => {
  test('separa la negrita del resto', () => {
    expect(trocear('Sube a **65 kg** el miércoles')).toEqual([
      { texto: 'Sube a ', negrita: false },
      { texto: '65 kg', negrita: true },
      { texto: ' el miércoles', negrita: false },
    ]);
  });

  test('admite varias negritas en la misma línea', () => {
    const r = trocear('**Banca** 70 kg y **prensa** 130');
    expect(r.filter((t) => t.negrita).map((t) => t.texto)).toEqual(['Banca', 'prensa']);
  });

  test('un asterisco doble sin cerrar se deja tal cual', () => {
    // Ocultarlo cambiaría lo que el sistema dijo, y eso es peor que verlo.
    expect(trocear('Esto **no cierra')).toEqual([{ texto: 'Esto **no cierra', negrita: false }]);
  });

  test('el asterisco suelto no es formato', () => {
    // Aparece en cifras constantemente: 3*10, ×1,5. Tratarlo como cursiva
    // dejaba frases mutiladas.
    expect(trocear('Haz 3*10 repeticiones')).toEqual([
      { texto: 'Haz 3*10 repeticiones', negrita: false },
    ]);
  });

  test('no produce trozos vacíos', () => {
    expect(trocear('**Solo negrita**')).toEqual([{ texto: 'Solo negrita', negrita: true }]);
    expect(trocear('')).toEqual([]);
  });
});

describe('parsear', () => {
  test('reconoce encabezados y les quita las almohadillas', () => {
    const [l] = parsear('## El veredicto');
    expect(l).toEqual({ tipo: 'titulo', trozos: [{ texto: 'El veredicto', negrita: false }] });
  });

  test('una línea entera en negrita también es un título', () => {
    const [l] = parsear('**Miércoles 19, LEGS:**');
    expect(l!.tipo).toBe('titulo');
    expect(l!.trozos[0]!.texto).toBe('Miércoles 19, LEGS');
  });

  test('viñetas y numeradas se separan del párrafo', () => {
    const r = parsear('- Sentadilla 65 kg\n1. Prensa 130 kg\nTexto normal');
    expect(r.map((l) => l.tipo)).toEqual(['vineta', 'numerada', 'parrafo']);
    expect(r[1]!.marca).toBe('1');
  });

  test('las líneas en blanco no generan huecos', () => {
    expect(parsear('Uno\n\n\nDos')).toHaveLength(2);
  });

  test('conserva la negrita dentro de una viñeta', () => {
    const [l] = parsear('- Sentadilla **60 → 65 kg**, 5×5');
    expect(l!.tipo).toBe('vineta');
    expect(l!.trozos.some((t) => t.negrita && t.texto === '60 → 65 kg')).toBe(true);
  });

  test('un texto real del coach no pierde nada por el camino', () => {
    const real = `**El veredicto: tu gasto no es el problema.**

- sin clasificar 89 € (+257 % sobre tu media)
- restaurante 72 € + Glovo 25 €

Proyección de cierre: **715 €**.`;
    const r = parsear(real);
    expect(r.map((l) => l.tipo)).toEqual(['titulo', 'vineta', 'vineta', 'parrafo']);
    // Ni un asterisco sobreviviente en lo que se va a pintar.
    const pintado = r.flatMap((l) => l.trozos).map((t) => t.texto).join(' ');
    expect(pintado).not.toContain('**');
  });
});
