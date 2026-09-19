import {
  HORIZONTES,
  HORIZONTE_POR_DEFECTO,
  firmaValida,
  limpiarFrase,
  lineaObjetivo,
  textoCompromiso,
} from '../compromiso';

describe('el compromiso del onboarding', () => {
  test('tres horizontes y el de 3 años recomendado y por defecto', () => {
    expect(HORIZONTES.map((h) => h.years)).toEqual([1, 3, 5]);
    expect(HORIZONTES.filter((h) => h.recomendado).map((h) => h.years)).toEqual([3]);
    expect(HORIZONTE_POR_DEFECTO.years).toBe(3);
    // Mismo cálculo que las cartas de Contrato.
    expect(HORIZONTE_POR_DEFECTO.days).toBe(365 * 3);
  });

  test('el objetivo se incrusta limpio, con cifra y fecha solo si existen', () => {
    expect(limpiarFrase('  Bajar a   78 kg.  ')).toBe('Bajar a 78 kg');
    expect(lineaObjetivo({ goal: 'Aprobar junio.' })).toBe('Aprobar junio.');
    expect(lineaObjetivo({ goal: 'Bajar de peso', target: '78 kg', deadline: 'junio de 2027' })).toBe(
      'Bajar de peso. Cifra: 78 kg. Fecha: junio de 2027.',
    );
    expect(lineaObjetivo({ goal: 'Bajar de peso', target: '  ', deadline: '' })).toBe('Bajar de peso.');
  });

  test('el texto lleva nombre, objetivo, horizonte, el 1 % y las dos fechas', () => {
    const t = textoCompromiso({
      name: ' Marta ',
      goal: 'Conseguir el ascenso a responsable de equipo',
      horizonte: HORIZONTE_POR_DEFECTO,
      firmadoEl: 'sábado, 19 de septiembre de 2026',
      seAbreEl: 'miércoles, 18 de septiembre de 2029',
    });
    expect(t.startsWith('COMPROMISO A 3 AÑOS')).toBe(true);
    expect(t).toContain('Yo, Marta, firmo');
    expect(t).toContain('Estoy aquí para esto: Conseguir el ascenso a responsable de equipo.');
    expect(t).toContain('1 % mejor cada día');
    expect(t).toContain('19 de septiembre de 2026');
    expect(t).toContain('18 de septiembre de 2029');
    expect(t.endsWith('Firmado: Marta')).toBe(true);
    // Texto plano: Contrato lo pinta en un <Text> sin formato.
    expect(t).not.toMatch(/[*_#]/);
  });

  test('la firma ignora mayúsculas, acentos y espacios, pero no otro nombre', () => {
    expect(firmaValida('  josé  luis ', 'José Luis')).toBe(true);
    expect(firmaValida('JOSE LUIS', 'José Luis')).toBe(true);
    expect(firmaValida('Jose', 'José Luis')).toBe(false);
    expect(firmaValida('', '')).toBe(false);
  });
});
