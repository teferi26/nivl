import {
  MAX_TROZO,
  fechaEnPalabras,
  horaEnPalabras,
  paraVoz,
  prepararVoz,
  trocear,
} from '../coachvoz/texto';

describe('paraVoz: markdown', () => {
  it('quita títulos y cierra con punto', () => {
    expect(paraVoz('## Plan de hoy\nEntrenas pierna.')).toBe('Plan de hoy. Entrenas pierna.');
  });
  it('quita negritas, cursivas y tachado', () => {
    expect(paraVoz('Esto es **clave**, _de verdad_ y *ya*. ~~No~~ sí.')).toBe('Esto es clave, de verdad y ya. No sí.');
  });
  it('quita el código en línea y las vallas', () => {
    expect(paraVoz('Usa `fijar_ficha`.\n```\nhola\n```')).toBe('Usa fijar ficha. hola.');
  });
  it('listas con guion, asterisco y números', () => {
    expect(paraVoz('- Sentadilla\n* Press\n1. Remo\n2) Dominadas')).toBe('Sentadilla. Press. Remo. Dominadas.');
  });
  it('enlaces → solo su texto', () => {
    expect(paraVoz('Lee [la guía](https://nivl.app/guia) hoy.')).toBe('Lee la guía hoy.');
  });
  it('URL sueltas fuera', () => {
    expect(paraVoz('Mira https://nivl.app/x?y=1 y sigue.')).toBe('Mira y sigue.');
  });
  it('citas y reglas horizontales', () => {
    expect(paraVoz('> El sistema constata.\n---\nSigue.')).toBe('El sistema constata. Sigue.');
  });
  it('tablas → una frase por fila', () => {
    const t = '| Ejercicio | Series |\n|---|:---:|\n| Sentadilla | 5×5 |\n| Press | 3×8 |';
    expect(paraVoz(t)).toBe('Ejercicio, Series. Sentadilla, 5 por 5. Press, 3 por 8.');
  });
  it('casillas de tarea', () => {
    expect(paraVoz('- [x] Agua\n- [ ] Diario')).toBe('Agua. Diario.');
  });
  it('quita la línea «Consultado: …» de las citas', () => {
    expect(paraVoz('Haz 3 series.\nConsultado: ACSM 2026, NSCA')).toBe('Haz 3 series.');
    expect(paraVoz('Haz 3 series.\n_Consultado: ACSM_')).toBe('Haz 3 series.');
    expect(paraVoz('Haz 3 series.\n**Consultado:** ACSM')).toBe('Haz 3 series.');
  });
  it('no quita «consultado» en mitad de una frase', () => {
    expect(paraVoz('Lo he consultado: vale.')).toBe('Lo he consultado: vale.');
  });
  it('cadena vacía y solo markdown', () => {
    expect(paraVoz('')).toBe('');
    expect(paraVoz('**  **\n---')).toBe('');
  });
});

describe('paraVoz: emojis', () => {
  it('quita emojis simples y compuestos', () => {
    expect(paraVoz('Bien hecho 💪🔥')).toBe('Bien hecho.');
    expect(paraVoz('Equipo 👨‍👩‍👧 listo ✅')).toBe('Equipo listo.');
  });
  it('quita banderas, variación y keycaps', () => {
    expect(paraVoz('🇪🇸 España ❤️ 1️⃣')).toBe('España 1.');
  });
  it('una línea que solo es emoji no deja puntos sueltos', () => {
    expect(paraVoz('Hecho.\n🏆\nSigue.')).toBe('Hecho. Sigue.');
  });
});

describe('paraVoz: cifras del juego', () => {
  it('«×» → «por»', () => {
    expect(paraVoz('4×10 a 60 kg')).toBe('4 por 10 a 60 kilos.');
    expect(paraVoz('Dobla ×2')).toBe('Dobla por 2.');
  });
  it('«3x8» → «3 por 8»', () => {
    expect(paraVoz('Haz 3x8')).toBe('Haz 3 por 8.');
  });
  it('kg y km, singular y plural', () => {
    expect(paraVoz('Sube 2,5 kg')).toBe('Sube 2,5 kilos.');
    expect(paraVoz('Pesas 1 kg más')).toBe('Pesas 1 kilo más.');
    expect(paraVoz('Corre 5km')).toBe('Corre 5 kilómetros.');
    expect(paraVoz('Solo 1 km')).toBe('Solo 1 kilómetro.');
    expect(paraVoz('A 12 km/h')).toBe('A 12 kilómetros por hora.');
  });
  it('XP con signo: menos y más', () => {
    expect(paraVoz('El sistema ha aplicado −38 XP.')).toBe('El sistema ha aplicado menos 38 XP.');
    expect(paraVoz('Penalización: -38 XP')).toBe('Penalización: menos 38 XP.');
    expect(paraVoz('+25 XP por la misión')).toBe('más 25 XP por la misión.');
    expect(paraVoz('Ganas +25xp')).toBe('Ganas más 25 XP.');
  });
  it('signo menos tipográfico sin XP', () => {
    expect(paraVoz('Tendencia −0,4 kg por semana')).toBe('Tendencia menos 0,4 kilos por semana.');
  });
  it('porcentaje', () => {
    expect(paraVoz('Adherencia del 85%')).toBe('Adherencia del 85 por ciento.');
    expect(paraVoz('Sube un 10 %')).toBe('Sube un 10 por ciento.');
  });
  it('rangos con guion', () => {
    expect(paraVoz('Haz 8-12 repeticiones')).toBe('Haz 8 a 12 repeticiones.');
  });
  it('rango junto a XP no se lee como negativo', () => {
    expect(paraVoz('Entre 10-20 XP')).toBe('Entre 10 a 20 XP.');
  });
  it('decimales con punto → coma; miles intactos', () => {
    expect(paraVoz('Pesas 72.5 kg')).toBe('Pesas 72,5 kilos.');
    expect(paraVoz('Llevas 1.000 XP')).toBe('Llevas 1.000 XP.');
  });
  it('euros, minutos, kcal, horas', () => {
    expect(paraVoz('Gastas 12€ en 30 min')).toBe('Gastas 12 euros en 30 minutos.');
    expect(paraVoz('Toma 2500 kcal y duerme 8 h')).toBe('Toma 2500 kilocalorías y duerme 8 horas.');
  });
  it('1RM y e1RM', () => {
    expect(paraVoz('Tu e1RM sube')).toBe('Tu una repetición máxima estimada sube.');
  });
});

describe('paraVoz: fechas y horas', () => {
  it('fecha ISO → «3 de octubre»', () => {
    expect(paraVoz('Cierre el 2026-10-03')).toBe('Cierre el 3 de octubre.');
  });
  it('fecha ISO con hora UTC pegada', () => {
    expect(paraVoz('Desde 2026-01-15T08:00:00Z')).toBe('Desde 15 de enero.');
  });
  it('fecha de otro año con anioActual', () => {
    expect(paraVoz('Meta: 2027-03-01', { anioActual: 2026 })).toBe('Meta: 1 de marzo de 2027.');
    expect(paraVoz('Meta: 2026-03-01', { anioActual: 2026 })).toBe('Meta: 1 de marzo.');
  });
  it('fecha imposible se queda como está (sin romperla en rango)', () => {
    expect(fechaEnPalabras('2026-13-01')).toBeNull();
  });
  it('horas en palabras', () => {
    expect(paraVoz('Entrena a las 07:30')).toBe('Entrena a las siete y media de la mañana.');
    expect(paraVoz('Cierre a las 00:00')).toBe('Cierre a las doce de la noche.');
    expect(paraVoz('Cena a las 21:15')).toBe('Cena a las nueve y cuarto de la noche.');
  });
  it('horaEnPalabras: casos borde', () => {
    expect(horaEnPalabras(7, 45)).toBe('ocho menos cuarto de la mañana');
    expect(horaEnPalabras(13, 0)).toBe('una del mediodía');
    expect(horaEnPalabras(18, 5)).toBe('seis y 5 de la tarde');
    expect(horaEnPalabras(3, 0)).toBe('tres de la madrugada');
    expect(horaEnPalabras(23, 45)).toBe('doce menos cuarto de la noche');
  });
});

describe('paraVoz: abreviaturas y símbolos', () => {
  it('p. ej., aprox., etc.', () => {
    expect(paraVoz('Proteína, p. ej. huevos, aprox. 30 g, etc.')).toBe(
      'Proteína, por ejemplo huevos, aproximadamente 30 g, etcétera.',
    );
    expect(paraVoz('Algo p.ej. así')).toBe('Algo por ejemplo así.');
  });
  it('el punto de la abreviatura no cierra frase salvo que la cierre', () => {
    expect(paraVoz('Haz 30 min. de cardio')).toBe('Haz 30 minutos de cardio.');
    expect(paraVoz('Fuerza, cardio, etc. Mañana más.')).toBe('Fuerza, cardio, etcétera. Mañana más.');
  });
  it('máx., mín., nº', () => {
    expect(paraVoz('máx. 3 y mín. 1, nº 4')).toBe('máximo 3 y mínimo 1, número 4.');
  });
  it('flechas e incisos con raya son pausas', () => {
    expect(paraVoz('Pierna → empuje')).toBe('Pierna, empuje.');
    expect(paraVoz('Hoy — sin excusas — entrenas')).toBe('Hoy, sin excusas, entrenas.');
  });
  it('& → y', () => {
    expect(paraVoz('Fuerza & cardio')).toBe('Fuerza y cardio.');
  });
});

describe('paraVoz: respuesta completa del coach', () => {
  it('limpia una respuesta real', () => {
    const r = [
      '### Veredicto',
      '**Hoy has fallado.** El sistema ha aplicado −38 XP. 😤',
      '',
      '- Mañana: 5×5 sentadilla a 80 kg (07:30)',
      '- Cardio: 5 km en zona 2',
      '',
      'Consultado: NSCA 2026',
    ].join('\n');
    expect(paraVoz(r)).toBe(
      'Veredicto. Hoy has fallado. El sistema ha aplicado menos 38 XP. ' +
        'Mañana: 5 por 5 sentadilla a 80 kilos (siete y media de la mañana). ' +
        'Cardio: 5 kilómetros en zona 2.',
    );
  });
});

describe('trocear', () => {
  it('texto vacío → nada', () => {
    expect(trocear('')).toEqual([]);
    expect(trocear('   ')).toEqual([]);
  });
  it('junta frases cortas en un trozo', () => {
    expect(trocear('Uno. Dos. Tres.')).toEqual(['Uno. Dos. Tres.']);
  });
  it('ningún trozo pasa del tope', () => {
    const frase = 'El sistema constata que has cumplido la misión del día. ';
    const largo = frase.repeat(20);
    const t = trocear(largo);
    expect(t.length).toBeGreaterThan(1);
    for (const x of t) expect(x.length).toBeLessThanOrEqual(MAX_TROZO);
    expect(t.join(' ')).toBe(largo.trim());
  });
  it('parte una frase larga por comas antes que por espacios', () => {
    const f = `${'a'.repeat(120)}, ${'b'.repeat(120)}.`;
    const t = trocear(f);
    expect(t).toEqual([`${'a'.repeat(120)},`, `${'b'.repeat(120)}.`]);
  });
  it('parte por espacio si no hay comas, sin cortar palabras', () => {
    const f = `${'palabra '.repeat(60).trim()}.`;
    const t = trocear(f, 50);
    for (const x of t) {
      expect(x.length).toBeLessThanOrEqual(50);
      expect(x.startsWith('alabra')).toBe(false);
    }
    expect(t.join(' ')).toBe(f);
  });
  it('una palabra más larga que el tope se corta en seco', () => {
    const t = trocear('x'.repeat(450));
    expect(t.map((x) => x.length)).toEqual([200, 200, 50]);
  });
  it('no parte los miles con punto', () => {
    expect(trocear('Llevas 1.000 XP. Sigue.')).toEqual(['Llevas 1.000 XP. Sigue.']);
  });
  it('respeta signos de cierre tras el punto', () => {
    const t = trocear(`«${'a'.repeat(150)}.» ${'b'.repeat(100)}.`);
    expect(t[0].endsWith('.»')).toBe(true);
  });
  it('tope mínimo de seguridad', () => {
    for (const x of trocear('hola que tal estas hoy gladiador', 5)) expect(x.length).toBeLessThanOrEqual(20);
  });
});

describe('prepararVoz', () => {
  it('limpia y trocea a la vez', () => {
    const t = prepararVoz(`## Hoy\n${'- Haz 3×10 a 60 kg con calma y técnica.\n'.repeat(10)}`);
    expect(t.length).toBeGreaterThan(1);
    for (const x of t) {
      expect(x.length).toBeLessThanOrEqual(MAX_TROZO);
      expect(x).not.toMatch(/[#*×]|kg/);
    }
  });
});
