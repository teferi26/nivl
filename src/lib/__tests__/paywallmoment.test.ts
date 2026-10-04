import {
  DIA,
  HORA,
  MAX_ENTRADAS,
  MOMENTOS,
  anotarEn,
  bloqueoDeHoja,
  decidirOferta,
  diaNatural,
  esMomento,
  parsearHistorial,
  recortarHistorial,
  rutaOferta,
  type ContextoOferta,
  type EntradaOferta,
  type Momento,
} from '../paywallmoment';
import { COPY_UPSELL, ELITE_BENEFITS, PRO_BENEFITS, beneficiosPorMotivo, copyUpsell } from '../proplans';

// Jueves 1 de octubre de 2026, 18:00 hora local.
const AHORA = new Date(2026, 9, 1, 18, 0, 0).getTime();

const libre = (extra: Partial<ContextoOferta> = {}): ContextoOferta => ({
  tier: 'free',
  entitled: false,
  trial: false,
  trialAvailable: true,
  tiendaAbierta: true,
  celebrando: false,
  ahora: AHORA,
  historial: [],
  ...extra,
});
const pro = (extra: Partial<ContextoOferta> = {}) => libre({ tier: 'pro', entitled: true, trialAvailable: false, ...extra });
const hoja = (momento: Momento, at: number, respuesta: EntradaOferta['respuesta'] = 'vista'): EntradaOferta => ({ momento, at, respuesta, forma: 'hoja' });

describe('celebración y niveles', () => {
  test('nunca durante una celebración, en ningún momento ni nivel', () => {
    for (const m of MOMENTOS) {
      expect(decidirOferta(m, libre({ celebrando: true })).mostrar).toBe(false);
      expect(decidirOferta(m, pro({ celebrando: true })).mostrar).toBe(false);
      expect(decidirOferta(m, libre({ celebrando: true, trial: true, tier: 'pro', entitled: true })).mostrar).toBe(false);
    }
  });

  test('a Élite y al dueño, nada', () => {
    for (const m of MOMENTOS) {
      expect(decidirOferta(m, libre({ tier: 'elite', entitled: true })).mostrar).toBe(false);
      expect(decidirOferta(m, libre({ tier: 'owner', entitled: true })).mostrar).toBe(false);
    }
  });

  test('un Élite caducado cuenta como gratis', () => {
    const d = decidirOferta('firma', libre({ tier: 'elite', entitled: false }));
    expect(d).toMatchObject({ mostrar: true, forma: 'hoja', tier: 'pro' });
  });

  test('a un Pro: solo Élite, en línea, y solo en momentos de función o energía agotada', () => {
    for (const m of ['coach_profundo', 'analisis_foto', 'energia_agotada'] as const) {
      expect(decidirOferta(m, pro())).toMatchObject({ mostrar: true, forma: 'linea', tier: 'elite', prueba: false });
    }
    // La voz va con el coach: a un Pro no se le vende nada por ella.
    expect(decidirOferta('voz_premium', pro()).mostrar).toBe(false);
    expect(decidirOferta('coach_cerrado', pro()).mostrar).toBe(false);
    expect(decidirOferta('firma', pro()).mostrar).toBe(false);
    expect(decidirOferta('primer_dia', pro()).mostrar).toBe(false);
  });

  test('un Pro que paga fuera de la tienda (no mejorable) no recibe nada', () => {
    expect(decidirOferta('coach_profundo', pro({ mejorable: false })).mostrar).toBe(false);
  });

  test('energía agotada: a un gratis no aplica; en prueba, línea a Pro', () => {
    expect(decidirOferta('energia_agotada', libre()).mostrar).toBe(false);
    const enPrueba = libre({ tier: 'pro', entitled: true, trial: true, trialAvailable: false });
    expect(decidirOferta('energia_agotada', enPrueba)).toMatchObject({ mostrar: true, forma: 'linea', tier: 'pro' });
  });
});

describe('formas', () => {
  test('los momentos de función son línea, nunca hoja, aunque no haya ninguna hoja hoy', () => {
    for (const m of ['coach_profundo', 'voz_premium', 'analisis_foto'] as const) {
      expect(decidirOferta(m, libre()).forma).toBe('linea');
      expect(decidirOferta(m, libre()).mostrar).toBe(true);
    }
    expect(decidirOferta('coach_profundo', libre()).tier).toBe('elite');
    // Las fotos al coach solo las ve Élite (Pro y la prueba van sin visión).
    expect(decidirOferta('analisis_foto', libre()).tier).toBe('elite');
  });

  test('en prueba: solo línea, y nunca por lo que la prueba ya incluye', () => {
    const enPrueba = libre({ tier: 'pro', entitled: true, trial: true, trialAvailable: false });
    for (const m of MOMENTOS) {
      const d = decidirOferta(m, enPrueba);
      if (d.mostrar) expect(d.forma).toBe('linea');
      expect(d.prueba).toBe(false);
    }
    // Ya tiene el coach: ni la firma, ni el primer día, ni voz.
    for (const m of ['firma', 'primer_dia', 'voz_premium', 'fin_prueba'] as const) {
      expect(decidirOferta(m, enPrueba)).toMatchObject({ mostrar: false, razon: 'en_prueba' });
    }
    // Lo que la prueba no tiene sí se dice: modo profundo y fotos (Élite) y la energía agotada.
    expect(decidirOferta('coach_profundo', enPrueba)).toMatchObject({ mostrar: true, forma: 'linea', tier: 'elite' });
    expect(decidirOferta('analisis_foto', enPrueba)).toMatchObject({ mostrar: true, forma: 'linea', tier: 'elite' });
    expect(decidirOferta('energia_agotada', enPrueba)).toMatchObject({ mostrar: true, forma: 'linea', tier: 'pro' });
  });

  test('con la tienda cerrada: línea, salvo que se pueda empezar la prueba (es del servidor)', () => {
    const sinPrueba = { tiendaAbierta: false, trialAvailable: false };
    expect(decidirOferta('firma', libre(sinPrueba))).toMatchObject({ mostrar: true, forma: 'linea', prueba: false });
    expect(decidirOferta('primer_dia', libre(sinPrueba))).toMatchObject({ mostrar: true, forma: 'linea', prueba: false });
    expect(decidirOferta('firma', libre({ tiendaAbierta: false }))).toMatchObject({ mostrar: true, forma: 'hoja', prueba: true });
    expect(decidirOferta('primer_dia', libre({ tiendaAbierta: false }))).toMatchObject({ mostrar: true, forma: 'linea', prueba: true });
    // Con prueba y tienda cerrada, la hoja respeta igual los topes.
    const historial = [hoja('firma', AHORA - HORA, 'cerrada')];
    expect(decidirOferta('primer_dia', libre({ tiendaAbierta: false, historial })).mostrar).toBe(false);
  });

  test('la firma, la primera vez, es hoja aunque ya hubiera otra hoja hoy', () => {
    const historial = [hoja('primer_dia', AHORA - HORA, 'cerrada')];
    expect(decidirOferta('firma', libre({ historial }))).toMatchObject({ mostrar: true, forma: 'hoja', razon: 'primera_firma' });
  });

  test('una firma repetida respeta los topes y baja a línea', () => {
    const historial = [hoja('firma', AHORA - 2 * HORA, 'vista')];
    expect(decidirOferta('firma', libre({ historial }))).toMatchObject({ mostrar: true, forma: 'linea', razon: 'tope_dia' });
  });
});

describe('prueba', () => {
  test('solo si la cuenta puede empezarla', () => {
    expect(decidirOferta('firma', libre({ trialAvailable: true })).prueba).toBe(true);
    expect(decidirOferta('firma', libre({ trialAvailable: false })).prueba).toBe(false);
  });

  test('nunca se ofrece la prueba (que es de Pro) para vender Élite', () => {
    expect(decidirOferta('coach_profundo', libre({ trialAvailable: true })).prueba).toBe(false);
  });
});

describe('topes', () => {
  test('≤1 hoja por día natural', () => {
    const historial = [hoja('firma', AHORA - 3 * HORA, 'compra')];
    expect(decidirOferta('firma', libre({ historial }))).toMatchObject({ mostrar: true, forma: 'linea', razon: 'tope_dia' });
  });

  test('el día natural es local: una hoja a las 23:30 de ayer no gasta el tope de hoy', () => {
    const anoche = new Date(2026, 8, 30, 23, 30).getTime();
    const manana = new Date(2026, 9, 1, 0, 30).getTime();
    expect(diaNatural(anoche)).not.toBe(diaNatural(manana));
    expect(bloqueoDeHoja([hoja('firma', anoche, 'compra')], manana)).toBeNull();
  });

  test('≤2 hojas en 7 días (ventana móvil)', () => {
    const historial = [hoja('firma', AHORA - 6 * DIA, 'compra'), hoja('primer_dia', AHORA - 4 * DIA, 'compra')];
    expect(bloqueoDeHoja(historial, AHORA)).toBe('tope_semana');
    expect(bloqueoDeHoja(historial, AHORA + DIA + HORA)).toBeNull();
  });

  test('72 h sin hoja tras «Ahora no»', () => {
    const historial = [hoja('firma', AHORA - 71 * HORA, 'cerrada')];
    expect(bloqueoDeHoja(historial, AHORA)).toBe('espera_72h');
    expect(bloqueoDeHoja(historial, AHORA + 2 * HORA)).toBeNull();
  });

  test('un «Ahora no» en una línea también da 72 h de calma, aunque no gaste el tope de hojas', () => {
    const historial: EntradaOferta[] = [{ momento: 'coach_profundo', at: AHORA - HORA, respuesta: 'cerrada', forma: 'linea' }];
    expect(bloqueoDeHoja(historial, AHORA)).toBe('espera_72h');
    const soloVista: EntradaOferta[] = [{ momento: 'coach_profundo', at: AHORA - HORA, respuesta: 'vista', forma: 'linea' }];
    expect(bloqueoDeHoja(soloVista, AHORA)).toBeNull();
  });

  test('una entrada sin forma cuenta como hoja (lo prudente)', () => {
    expect(bloqueoDeHoja([{ momento: 'firma', at: AHORA - HORA, respuesta: 'compra' }], AHORA)).toBe('tope_dia');
  });

  test('las líneas siguen saliendo con los topes de hojas agotados', () => {
    const historial = [hoja('firma', AHORA - HORA, 'cerrada')];
    expect(decidirOferta('coach_profundo', libre({ historial }))).toMatchObject({ mostrar: true, forma: 'linea' });
  });
});

describe('primer día', () => {
  test('línea (nunca hoja: decisión del coordinador) y una sola vez en la vida', () => {
    expect(decidirOferta('primer_dia', libre())).toMatchObject({ mostrar: true, forma: 'linea' });
    const vista = [{ momento: 'primer_dia' as const, at: AHORA - 10 * DIA, respuesta: 'vista' as const, forma: 'linea' as const }];
    expect(decidirOferta('primer_dia', libre({ historial: vista }))).toMatchObject({ mostrar: false, razon: 'primer_dia_ya_visto' });
  });

  test('tras la firma de ayer (hoja), el primer día de hoy sí sale como línea; tras un «no» reciente, no', () => {
    expect(decidirOferta('primer_dia', libre({ historial: [hoja('firma', AHORA - DIA, 'vista')] }))).toMatchObject({ mostrar: true, forma: 'linea' });
    expect(decidirOferta('primer_dia', libre({ historial: [hoja('firma', AHORA - HORA, 'cerrada')] }))).toMatchObject({ mostrar: false, razon: 'espera_72h' });
  });
});

describe('lo gratuito nunca se bloquea', () => {
  test('la decisión solo dice qué se enseña: no hay campo de bloqueo', () => {
    for (const m of MOMENTOS) {
      for (const ctx of [libre(), pro(), libre({ celebrando: true })]) {
        expect(Object.keys(decidirOferta(m, ctx)).sort()).toEqual(['copyKey', 'forma', 'mostrar', 'prueba', 'razon', 'tier']);
      }
    }
  });
});

describe('historial', () => {
  test('recorta a 30 días, descarta basura y ordena', () => {
    const raw = [
      { momento: 'firma', at: AHORA - 31 * DIA, respuesta: 'vista' },
      { momento: 'nada', at: AHORA, respuesta: 'vista' },
      { momento: 'firma', at: 'ayer', respuesta: 'vista' },
      { momento: 'primer_dia', at: AHORA - DIA, respuesta: 'otra' },
      null,
      { momento: 'primer_dia', at: AHORA - HORA, respuesta: 'cerrada', forma: 'raro' },
      { momento: 'firma', at: AHORA - 2 * DIA, respuesta: 'compra', forma: 'hoja' },
    ];
    expect(recortarHistorial(raw, AHORA)).toEqual([
      { momento: 'firma', at: AHORA - 2 * DIA, respuesta: 'compra', forma: 'hoja' },
      { momento: 'primer_dia', at: AHORA - HORA, respuesta: 'cerrada' },
    ]);
  });

  test('tope de entradas', () => {
    const muchas = Array.from({ length: MAX_ENTRADAS + 20 }, (_, i) => hoja('coach_profundo', AHORA - i * 1000));
    expect(recortarHistorial(muchas, AHORA)).toHaveLength(MAX_ENTRADAS);
  });

  test('JSON roto o con otra forma: vacío, sin lanzar', () => {
    expect(parsearHistorial('{no es json', AHORA)).toEqual([]);
    expect(parsearHistorial('{"a":1}', AHORA)).toEqual([]);
    expect(parsearHistorial('null', AHORA)).toEqual([]);
    expect(parsearHistorial(null, AHORA)).toEqual([]);
  });

  test('la respuesta sustituye a la «vista» reciente de la misma hoja (cuenta una sola vez)', () => {
    const vista = anotarEn([], { momento: 'primer_dia', respuesta: 'vista', forma: 'hoja' }, AHORA);
    const cerrada = anotarEn(vista, { momento: 'primer_dia', respuesta: 'cerrada', forma: 'linea' }, AHORA + 5 * 60 * 1000);
    expect(cerrada).toEqual([{ momento: 'primer_dia', at: AHORA, respuesta: 'cerrada', forma: 'hoja' }]);
  });

  test('sin «vista» previa (llegó desde una línea), se apunta con su forma', () => {
    const h = anotarEn([], { momento: 'coach_profundo', respuesta: 'cerrada', forma: 'linea' }, AHORA);
    expect(h).toEqual([{ momento: 'coach_profundo', at: AHORA, respuesta: 'cerrada', forma: 'linea' }]);
  });

  test('una «vista» vieja no se funde: es otra entrada', () => {
    const vista = anotarEn([], { momento: 'firma', respuesta: 'vista' }, AHORA - 2 * HORA);
    expect(anotarEn(vista, { momento: 'firma', respuesta: 'cerrada' }, AHORA)).toHaveLength(2);
  });
});

describe('copy y ruta', () => {
  test('hay copy para cada momento y nivel, sin urgencias ni cuentas atrás', () => {
    for (const m of MOMENTOS) {
      for (const t of ['pro', 'elite'] as const) {
        const c = copyUpsell(m, t);
        for (const texto of [c.linea, c.enlace, c.contexto]) {
          expect(texto.length).toBeGreaterThan(0);
          expect(texto).not.toMatch(/últim[ao]s? (horas|plazas)|solo hoy|ahora o nunca|date prisa|quedan \d|expira|\d+:\d\d|!/i);
          expect(texto).not.toMatch(/cazador|mazmorra/i);
        }
      }
    }
    expect(Object.keys(COPY_UPSELL)).toHaveLength(MOMENTOS.length * 2);
  });

  test('la voz va con el coach: a un gratis se le ofrece Pro, sin prometer nada más', () => {
    expect(decidirOferta('voz_premium', libre())).toMatchObject({ mostrar: true, forma: 'linea', tier: 'pro' });
    expect(copyUpsell('voz_premium', 'pro').linea).toMatch(/Va con NIVL Pro/);
    for (const t of ['pro', 'elite'] as const) expect(copyUpsell('voz_premium', t).beneficio).toBeNull();
  });

  test('coach cerrado: línea fija a Pro para quien no tiene coach, sin topes ni espera', () => {
    const cerrada = { momento: 'firma' as const, at: AHORA - HORA, respuesta: 'cerrada' as const };
    for (const h of [[], [cerrada, cerrada, cerrada]]) {
      expect(decidirOferta('coach_cerrado', libre({ historial: h }))).toMatchObject({ mostrar: true, forma: 'linea', tier: 'pro' });
    }
    expect(decidirOferta('coach_cerrado', libre({ trialAvailable: true })).prueba).toBe(true);
    expect(decidirOferta('coach_cerrado', libre({ trialAvailable: false })).prueba).toBe(false);
    expect(decidirOferta('coach_cerrado', libre({ celebrando: true })).mostrar).toBe(false);
    const enPrueba = libre({ tier: 'pro', entitled: true, trial: true, trialAvailable: false });
    expect(decidirOferta('coach_cerrado', enPrueba).mostrar).toBe(false);
    expect(copyUpsell('coach_cerrado', 'pro').linea).toMatch(/gratis/);
  });

  test('cada beneficio citado existe de verdad', () => {
    const titulos = new Set([...PRO_BENEFITS, ...ELITE_BENEFITS].map((b) => b.title));
    for (const c of Object.values(COPY_UPSELL)) if (c.beneficio) expect(titulos.has(c.beneficio)).toBe(true);
  });

  test('el motivo pone su beneficio primero sin quitar ni añadir', () => {
    const base = [...ELITE_BENEFITS, ...PRO_BENEFITS];
    const orden = beneficiosPorMotivo(base, 'primer_dia', 'pro');
    expect(orden[0]!.title).toBe('Plan del día, bloque a bloque');
    expect([...orden].sort((a, b) => a.title.localeCompare(b.title))).toEqual([...base].sort((a, b) => a.title.localeCompare(b.title)));
    expect(beneficiosPorMotivo(base, null, 'pro')).toBe(base);
    expect(beneficiosPorMotivo(base, 'voz_premium', 'elite')).toBe(base);
  });

  test('ruta y validación de momento', () => {
    expect(rutaOferta('coach_profundo', 'elite')).toBe('/pro?motivo=coach_profundo&tier=elite');
    expect(esMomento('firma')).toBe(true);
    expect(esMomento('otro')).toBe(false);
    expect(esMomento(undefined)).toBe(false);
  });
});

describe('fin de la prueba (fase 3)', () => {
  const vuelta = (extra: Partial<ContextoOferta> = {}) => libre({ trialAvailable: false, ...extra });
  const empezo = { momento: 'firma' as const, at: AHORA - 8 * DIA, respuesta: 'prueba' as const, forma: 'hoja' as const };

  test('hoja una vez cuando la cuenta vuelve a gratis tras su prueba; sin prueba no se ofrece', () => {
    expect(decidirOferta('fin_prueba', vuelta({ historial: [empezo] }))).toMatchObject({ mostrar: true, forma: 'hoja', tier: 'pro', prueba: false });
    expect(decidirOferta('fin_prueba', vuelta())).toMatchObject({ mostrar: false, razon: 'sin_prueba' });
    // Aún puede empezarla: no hay «fin».
    expect(decidirOferta('fin_prueba', libre({ historial: [empezo] })).mostrar).toBe(false);
    // Lo dice el servidor aunque el historial del dispositivo esté vacío.
    expect(decidirOferta('fin_prueba', vuelta({ pruebaTerminada: true })).forma).toBe('hoja');
    expect(decidirOferta('fin_prueba', vuelta({ historial: [empezo], pruebaTerminada: false })).mostrar).toBe(false);
  });

  test('una sola vez en la vida, con topes, sin celebración y con la tienda cerrada en línea', () => {
    const visto = hoja('fin_prueba', AHORA - 3 * DIA, 'cerrada');
    expect(decidirOferta('fin_prueba', vuelta({ historial: [empezo, visto] }))).toMatchObject({ mostrar: false, razon: 'fin_prueba_ya_visto' });
    const hoyYa = hoja('primer_dia', AHORA - HORA, 'compra');
    expect(decidirOferta('fin_prueba', vuelta({ historial: [empezo, hoyYa] }))).toMatchObject({ mostrar: true, forma: 'linea', razon: 'tope_dia' });
    expect(decidirOferta('fin_prueba', vuelta({ historial: [empezo], celebrando: true })).mostrar).toBe(false);
    expect(decidirOferta('fin_prueba', vuelta({ historial: [empezo], tiendaAbierta: false }))).toMatchObject({ mostrar: true, forma: 'linea' });
  });

  test('a quien paga, nada', () => {
    expect(decidirOferta('fin_prueba', pro({ historial: [empezo] })).mostrar).toBe(false);
    expect(decidirOferta('fin_prueba', libre({ tier: 'elite', entitled: true, historial: [empezo] })).mostrar).toBe(false);
  });

  test('copy de la cabecera para cada momento y nivel, y el fin de la prueba dice que no se cobró', () => {
    for (const m of MOMENTOS) {
      for (const t of ['pro', 'elite'] as const) {
        const c = copyUpsell(m, t);
        expect(c.eyebrow.length).toBeGreaterThan(0);
        expect(c.eyebrow.length).toBeLessThanOrEqual(24);
        expect(c.titulo).toMatch(/\.$/);
        expect(`${c.eyebrow} ${c.titulo}`).not.toMatch(/!|últim|quedan|expira|solo hoy/i);
      }
    }
    expect(copyUpsell('fin_prueba', 'pro').contexto).toMatch(/no se ha cobrado nada/);
    expect(copyUpsell('fin_prueba', 'pro').linea).toMatch(/sin cobro/);
  });

  test('energía agotada a Élite: no promete más energía ni turnos', () => {
    const c = copyUpsell('energia_agotada', 'elite');
    expect(`${c.linea} ${c.contexto}`).not.toMatch(/más energía|más turnos|presupuesto propio|su propio presupuesto/i);
    expect(c.contexto).toMatch(/límite mensual/);
  });
});
