// Prueba automática de Élite (0069): qué pantalla toca. Sin prueba no sale
// nada; con prueba, la bienvenida una vez y el aviso de 24 h una vez;
// vencida, la pantalla de fin (como mucho una vez cada 7 días tras «plan
// gratis»); una compra la quita; con el interruptor apagado, nada.
import {
  DIA_MS,
  estadoPrueba,
  diasRestantes,
  fechaHoraLocal,
  HORA_MS,
  marcasDe,
  MARCAS_VACIAS,
  pantallaPrueba,
  preciosFin,
  trasBienvenida,
  type MarcasPrueba,
  type SuscripcionPrueba,
} from '../pruebaAutomath';

const AHORA = Date.parse('2026-10-18T10:00:00Z');
const enHoras = (h: number) => new Date(AHORA + h * HORA_MS).toISOString();
const prueba = (finEnHoras: number, status = 'trialing'): SuscripcionPrueba => ({
  plan: 'prueba_auto',
  status,
  current_period_end: enHoras(finEnHoras),
});
const decide = (sub: SuscripcionPrueba | null, marcas: MarcasPrueba = MARCAS_VACIAS, ahora = AHORA, activa = true) =>
  pantallaPrueba({ activa, estado: estadoPrueba(sub, ahora), marcas, ahora });

describe('sin prueba no aparece nada', () => {
  it('sin fila, con otro plan o con basura', () => {
    expect(decide(null)).toBeNull();
    expect(decide({ plan: 'cortesia', status: 'trialing', current_period_end: enHoras(10) })).toBeNull();
    expect(decide({ plan: 'prueba_auto', status: 'trialing', current_period_end: null })).toBeNull();
    expect(decide({ plan: 'prueba_auto', status: 'trialing', current_period_end: 'x' })).toBeNull();
  });

  it('con el interruptor apagado, ni la bienvenida ni el fin', () => {
    expect(decide(prueba(40), MARCAS_VACIAS, AHORA, false)).toBeNull();
    expect(decide(prueba(-1), MARCAS_VACIAS, AHORA, false)).toBeNull();
  });
});

describe('prueba activa', () => {
  it('la bienvenida sale una vez', () => {
    const sub = prueba(40);
    expect(decide(sub)).toBe('bienvenida');
    const marcas = trasBienvenida(MARCAS_VACIAS, estadoPrueba(sub, AHORA), AHORA);
    expect(decide(sub, marcas)).toBeNull();
  });

  it('una prueba nueva (otro fin) vuelve a dar la bienvenida', () => {
    const marcas = { ...MARCAS_VACIAS, bienvenida: enHoras(5) };
    expect(decide(prueba(40), marcas)).toBe('bienvenida');
  });

  it('el aviso de 24 h sale una vez, con un día o menos', () => {
    const sub = prueba(40);
    const marcas = trasBienvenida(MARCAS_VACIAS, estadoPrueba(sub, AHORA), AHORA);
    expect(decide(sub, marcas, AHORA + 10 * HORA_MS)).toBeNull(); // quedan 30 h
    expect(decide(sub, marcas, AHORA + 17 * HORA_MS)).toBe('aviso'); // quedan 23 h
    expect(decide(sub, { ...marcas, aviso: sub.current_period_end }, AHORA + 17 * HORA_MS)).toBeNull();
  });

  it('si la bienvenida llega con menos de un día, no hay aviso aparte', () => {
    const sub = prueba(20);
    const marcas = trasBienvenida(MARCAS_VACIAS, estadoPrueba(sub, AHORA), AHORA);
    expect(decide(sub, marcas)).toBeNull();
  });
});

describe('prueba vencida', () => {
  it('sale la pantalla de fin', () => {
    expect(decide(prueba(-1))).toBe('fin');
    // Vencida aunque el servidor aún diga trialing o ya diga otra cosa.
    expect(decide(prueba(-1, 'canceled'))).toBe('fin');
  });

  it('«Quedarme en el plan gratis» no vuelve a insistir antes de 7 días', () => {
    const marcas = { ...MARCAS_VACIAS, gratisEn: AHORA };
    expect(decide(prueba(-1), marcas, AHORA + 6 * DIA_MS)).toBeNull();
    expect(decide(prueba(-1), marcas, AHORA + 7 * DIA_MS)).toBe('fin');
  });

  it('una compra la quita: el plan deja de ser prueba_auto', () => {
    for (const plan of ['elite_mensual', 'elite_anual', 'pro_mensual', 'pro_anual', 'elite_fundador']) {
      expect(decide({ plan, status: 'active', current_period_end: enHoras(720) })).toBeNull();
    }
  });
});

describe('detalles', () => {
  it('las marcas guardadas con basura cuentan como vacías', () => {
    expect(marcasDe(null)).toEqual(MARCAS_VACIAS);
    expect(marcasDe({ bienvenida: 3, gratisEn: 'x' })).toEqual(MARCAS_VACIAS);
  });

  it('fecha y hora en la zona del teléfono', () => {
    const d = new Date(2026, 9, 20, 9, 5);
    const { fecha, hora } = fechaHoraLocal(d.toISOString());
    expect(hora).toBe('09:05');
    expect(fecha).toContain('20');
    expect(fecha).toContain('octubre');
  });

  it('fecha en el idioma de la interfaz (QA F1, M1)', () => {
    const d = new Date(2026, 9, 20, 21, 30);
    const en = fechaHoraLocal(d.toISOString(), 'en');
    expect(en.fecha).toContain('October');
    expect(en.fecha).toContain('Tuesday');
    expect(en.hora).toBe('21:30');
    expect(fechaHoraLocal(d.toISOString(), 'de').fecha).toContain('Oktober');
    expect(fechaHoraLocal(d.toISOString(), 'es').fecha).toBe('martes, 20 de octubre');
  });

  it('días que quedan: del fin de la prueba, hacia arriba y con tope (QA F1)', () => {
    const ahora = Date.UTC(2026, 9, 18, 12);
    const en = (h: number) => new Date(ahora + h * HORA_MS).toISOString();
    expect(diasRestantes(en(48), ahora, 2)).toBe(2);
    expect(diasRestantes(en(40), ahora, 2)).toBe(2);
    expect(diasRestantes(en(20), ahora, 2)).toBe(1);
    expect(diasRestantes(en(0.5), ahora, 2)).toBe(1);
    expect(diasRestantes(en(-1), ahora, 2)).toBe(0);
    expect(diasRestantes(en(100), ahora, 2)).toBe(2);
    expect(diasRestantes(en(100), ahora, 0)).toBe(5);
    expect(diasRestantes('basura', ahora, 2)).toBe(0);
  });

  it('precios de reserva en el idioma de la interfaz, siempre en euros (QA F1, M2)', () => {
    const en = preciosFin(null, 'en');
    expect(en.eliteMes).toMatch(/€/);
    expect(en.eliteMes).toContain('29.99');
    expect(en.eliteAnio).toContain('299.00');
    expect(preciosFin(null, 'de').proMes).toMatch(/12,99\s€/);
    expect(preciosFin(null, 'es')).toEqual(preciosFin(null));
    // Con tienda, el precio llega ya localizado y no se toca.
    expect(preciosFin({ eliteMes: '$29.99', eliteAnio: null, proMes: null, introGratis: null, introCondicional: false }, 'en').eliteMes).toBe('$29.99');
  });

  it('precios: los de la tienda o los de la tabla; la oferta solo con precio de tienda', () => {
    expect(preciosFin(null)).toEqual({
      eliteMes: '29,99 €',
      eliteAnio: '299,00 €',
      proMes: '12,99 €',
      introGratis: null,
      introCondicional: false,
    });
    const tienda = { eliteMes: '29,99 €', eliteAnio: '299,99 €', proMes: '12,99 €', introGratis: '5 días', introCondicional: false };
    expect(preciosFin(tienda)).toEqual(tienda);
    expect(preciosFin({ ...tienda, eliteMes: null }).introGratis).toBeNull();
  });
});
