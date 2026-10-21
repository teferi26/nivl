import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  __esperarAnalitica,
  aceptarAnalitica,
  alAbrirAnalitica,
  CLAVES_ANALITICA,
  estadoConsentimiento,
  K_CONSENTIMIENTO,
  marcarApertura,
  rechazarAnalitica,
  revocarAnalitica,
  olvidarAnalitica,
  registrar,
  registrarUnaVez,
  vaciarCola,
} from '../analitica';
import {
  aperturaDeHoy,
  destinoTrasEnvio,
  encolar,
  EVENTOS_EMBUDO,
  esInstallId,
  instalacionCaducada,
  sumarMeses,
  leerCola,
  limpiarProps,
  MAX_COLA,
  nuevoInstallId,
  PROPS_ADMITIDAS,
  type EventoEnCola,
} from '../analiticamath';
import { decisionVigente, nuevaDecision, VERSION_CONSENTIMIENTO } from '../consentimientoAnaliticamath';
import { __olvidarFlags } from '../flagsServidor';
import { supabase } from '../supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.10' } } }));
jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn(), auth: { getSession: jest.fn() } },
}));

const rpc = jest.mocked(supabase.rpc);
const getSession = jest.mocked(supabase.auth.getSession);

let flagEncendido = true;
let respuestaEvento: () => Promise<{ data: unknown; error: unknown }>;
const enviados = () => rpc.mock.calls.filter((c) => c[0] === 'registrar_evento').map((c) => c[1] as Record<string, unknown>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  __olvidarFlags();
  flagEncendido = true;
  respuestaEvento = async () => ({ data: true, error: null });
  getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
  rpc.mockImplementation(((nombre: string) => {
    if (nombre === 'app_flags') return Promise.resolve({ data: { analitica_1011: flagEncendido }, error: null });
    if (nombre === 'registrar_evento') return respuestaEvento();
    if (nombre === 'olvidar_instalacion') return respuestaOlvido();
    return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
  }) as never);
  respuestaOlvido = async () => ({ data: 3, error: null });
  // Salvo en «sin consentimiento», la persona ya ha aceptado.
  await AsyncStorage.setItem(K_CONSENTIMIENTO, JSON.stringify(nuevaDecision('acepta', Date.now())));
});

let respuestaOlvido: () => Promise<{ data: unknown; error: unknown }>;

afterEach(async () => {
  await __esperarAnalitica();
});

async function colaGuardada(): Promise<EventoEnCola[]> {
  await __esperarAnalitica();
  return leerCola(await AsyncStorage.getItem('nivl.analitica.cola.v1'));
}

describe('lista blanca (sin datos personales)', () => {
  test('solo salen las claves del evento y con su forma', () => {
    expect(limpiarProps('registro', { resultado: 'sesion', email: 'ana@correo.es', nombre: 'Ana' })).toEqual({ resultado: 'sesion' });
    expect(limpiarProps('registro', { resultado: 'ana@correo.es' })).toEqual({});
    expect(limpiarProps('onboarding_paso', { paso: 3, objetivo: 'Perder 5 kilos' })).toEqual({ paso: 3 });
    expect(limpiarProps('onboarding_paso', { paso: 2.5 })).toEqual({});
    expect(limpiarProps('apertura_dia', { dia: -1 })).toEqual({});
    expect(limpiarProps('paywall_visto', { motivo: 'Juan Pérez', compacto: 'si' })).toEqual({});
    expect(limpiarProps('paywall_visto', { motivo: 'primer_dia', compacto: true })).toEqual({ motivo: 'primer_dia', compacto: true });
    expect(limpiarProps('compra_ok', { plan: 'nivl_pro_mensual', resultado: 'activa', precio: '9,99 €' })).toEqual({
      plan: 'nivl_pro_mensual',
      resultado: 'activa',
    });
    expect(limpiarProps('primer_arranque', { previo: true, x: 1 })).toEqual({ previo: true });
  });

  test('la lista del móvil es la misma que la del servidor (última versión, 0073)', () => {
    const sql = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations', '0073_analitica_consentimiento.sql'), 'utf8');
    const servidor: Record<string, string[]> = {};
    for (const m of sql.matchAll(/when '([a-z_]+)' then array\[([^\]]*)\]/g)) {
      servidor[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    }
    const movil = Object.fromEntries(EVENTOS_EMBUDO.map((e) => [e, Object.keys(PROPS_ADMITIDAS[e]).sort()]));
    expect(servidor).toEqual(movil);
  });

  test('lo que viaja al servidor no lleva correo, nombre ni texto libre', async () => {
    registrar('registro', { resultado: 'confirmar_email', email: 'ana@correo.es', name: 'Ana Gómez', password: 'x' });
    registrar('onboarding_paso', { paso: 2, goal: 'Correr una maratón' });
    await marcarApertura('2026-10-18');
    await __esperarAnalitica();
    await vaciarCola();
    const llamadas = enviados();
    expect(llamadas.length).toBe(4);
    const todo = JSON.stringify(llamadas);
    expect(todo).not.toMatch(/@|Ana|maratón|password/);
    for (const c of llamadas) {
      expect(Object.keys(c).sort()).toEqual(['p_app_version', 'p_evento', 'p_install_id', 'p_ocurrido_en', 'p_plataforma', 'p_props']);
      expect(esInstallId(c.p_install_id)).toBe(true);
      expect(c.p_app_version).toBe('1.0.10');
    }
  });
});

describe('cola offline', () => {
  test('tope: se pierde lo más viejo', () => {
    let cola: EventoEnCola[] = [];
    for (let i = 0; i < MAX_COLA + 5; i++) cola = encolar(cola, { evento: 'apertura_dia', props: { dia: i }, ts: String(i) });
    expect(cola).toHaveLength(MAX_COLA);
    expect(cola[0].props.dia).toBe(5);
  });

  test('una cola corrupta o con eventos ajenos no rompe nada', () => {
    expect(leerCola('no es json')).toEqual([]);
    expect(leerCola('{"a":1}')).toEqual([]);
    expect(leerCola(JSON.stringify([{ evento: 'hackeo', props: {}, ts: 'x' }, { evento: 'registro', props: { email: 'a@b.es' }, ts: 't' }]))).toEqual([
      { evento: 'registro', props: {}, ts: 't' },
    ]);
  });

  test('registrar no bloquea ni lanza aunque AsyncStorage falle', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disco'));
    expect(() => registrar('registro', { resultado: 'sesion' })).not.toThrow();
    await __esperarAnalitica();
  });

  test('con el flag apagado nada sale del móvil y la cola espera', async () => {
    flagEncendido = false;
    await marcarApertura('2026-10-18');
    registrar('onboarding_fin', { salida: 'cerrada' });
    await vaciarCola();
    expect(enviados()).toHaveLength(0);
    expect((await colaGuardada()).map((e) => e.evento)).toEqual(['primer_arranque', 'apertura_dia', 'onboarding_fin']);
  });

  test('sin flag legible (fallo de red) también apagado', async () => {
    rpc.mockImplementation(((nombre: string) =>
      nombre === 'app_flags' ? Promise.reject(new Error('red')) : respuestaEvento()) as never);
    await marcarApertura('2026-10-18');
    await vaciarCola();
    expect(enviados()).toHaveLength(0);
  });

  test('sin red se queda en la cola, en orden, y sale al volver', async () => {
    await marcarApertura('2026-10-18');
    registrar('registro', { resultado: 'sesion' });
    respuestaEvento = () => Promise.reject(new TypeError('Network request failed'));
    await vaciarCola();
    expect((await colaGuardada()).map((e) => e.evento)).toEqual(['primer_arranque', 'apertura_dia', 'registro']);
    respuestaEvento = async () => ({ data: true, error: null });
    rpc.mockClear();
    await vaciarCola();
    expect(enviados().map((c) => c.p_evento)).toEqual(['primer_arranque', 'apertura_dia', 'registro']);
    expect(await colaGuardada()).toEqual([]);
  });

  test('sin la migración aplicada (PGRST202) se guarda sin insistir hasta la próxima apertura; un rechazo por forma (22023) se tira', async () => {
    await marcarApertura('2026-10-18');
    let llamadas = 0;
    respuestaEvento = async () => {
      llamadas++;
      return { data: null, error: { code: 'PGRST202' } };
    };
    await vaciarCola();
    expect(await colaGuardada()).toHaveLength(2);
    expect(llamadas).toBe(1);
    // QA F1 (menor 3): en los siguientes pasos no se reenvía el primero.
    await vaciarCola();
    await vaciarCola();
    expect(llamadas).toBe(1);
    expect(destinoTrasEnvio({ code: '42883' })).toBe('pausar');
    respuestaEvento = async () => ({ data: null, error: { code: '22023' } });
    // La próxima apertura vuelve a probar.
    await alAbrirAnalitica();
    expect(await colaGuardada()).toHaveLength(0);
    expect(destinoTrasEnvio({ code: '42501' })).toBe('reintentar');
    expect(destinoTrasEnvio(null)).toBe('hecho');
  });

  test('registrarUnaVez solo apunta la primera', async () => {
    registrarUnaVez('primera_mision_creada', { origen: 'habitos' });
    registrarUnaVez('primera_mision_creada', { origen: 'informe' });
    registrarUnaVez('primera_mision_completada', { con_foto: false });
    const cola = await colaGuardada();
    expect(cola.map((e) => [e.evento, e.props])).toEqual([
      ['primera_mision_creada', { origen: 'habitos' }],
      ['primera_mision_completada', { con_foto: false }],
    ]);
  });

  test('olvidarAnalitica borra instalación, cola y marcas', async () => {
    await marcarApertura('2026-10-18');
    registrarUnaVez('primera_mision_creada', { origen: 'habitos' });
    await __esperarAnalitica();
    await olvidarAnalitica();
    for (const k of CLAVES_ANALITICA) expect(await AsyncStorage.getItem(k)).toBeNull();
  });
});

describe('aperturas D1/D3/D7', () => {
  test('primer arranque, mismo día, días siguientes y reloj hacia atrás', () => {
    const a = aperturaDeHoy(null, '2026-10-18', () => 'id-de-prueba-123456');
    expect(a.eventos).toEqual([
      { evento: 'primer_arranque', props: {} },
      { evento: 'apertura_dia', props: { dia: 0 } },
    ]);
    expect(aperturaDeHoy(a.instalacion, '2026-10-18').eventos).toEqual([]);
    const d1 = aperturaDeHoy(a.instalacion, '2026-10-19');
    expect(d1.eventos).toEqual([{ evento: 'apertura_dia', props: { dia: 1 } }]);
    expect(aperturaDeHoy(d1.instalacion, '2026-10-25').eventos).toEqual([{ evento: 'apertura_dia', props: { dia: 7 } }]);
    // Cambio de hora (último domingo de octubre) no descuadra el día.
    expect(aperturaDeHoy(a.instalacion, '2026-10-26').eventos[0].props.dia).toBe(8);
    expect(aperturaDeHoy(a.instalacion, '2026-10-10').eventos).toEqual([]);
  });

  test('install_id aleatorio con forma de uuid v4', () => {
    const a = nuevoInstallId();
    const b = nuevoInstallId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(esInstallId(a)).toBe(true);
  });

  test('quien ya tenía sesión al estrenar la analítica va como previo', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } }, error: null } as never);
    await marcarApertura('2026-10-18');
    const cola = await colaGuardada();
    expect(cola[0]).toMatchObject({ evento: 'primer_arranque', props: { previo: true } });
    await marcarApertura('2026-10-18');
    expect(await colaGuardada()).toHaveLength(2);
    await marcarApertura('2026-10-21');
    expect((await colaGuardada()).at(-1)).toMatchObject({ evento: 'apertura_dia', props: { dia: 3 } });
  });
});

describe('consentimiento previo (dictamen LSSI)', () => {
  const setItem = () => jest.mocked(AsyncStorage.setItem);
  const getItem = () => jest.mocked(AsyncStorage.getItem);

  async function sinDecision() {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  }

  test('sin decisión no se escribe NADA en el móvil ni se envía nada', async () => {
    await sinDecision();
    registrar('registro', { resultado: 'sesion' });
    registrarUnaVez('primera_mision_creada', { origen: 'habitos' });
    await marcarApertura('2026-10-18');
    await vaciarCola();
    await alAbrirAnalitica();
    await __esperarAnalitica();
    expect(setItem()).not.toHaveBeenCalled();
    expect(enviados()).toHaveLength(0);
    // Solo se lee la propia decisión (y las revocaciones pendientes); nunca la cola ni la instalación.
    const leidas = new Set(getItem().mock.calls.map((c) => c[0]));
    for (const k of CLAVES_ANALITICA) expect(leidas.has(k)).toBe(false);
    // Al abrir sin consentimiento se borran los restos de versiones anteriores.
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(CLAVES_ANALITICA);
  });

  test('al arrancar sin consentimiento se borran los restos de una versión anterior', async () => {
    await sinDecision();
    await AsyncStorage.setItem('nivl.analitica.cola.v1', JSON.stringify([{ evento: 'registro', props: {}, ts: 't' }]));
    await AsyncStorage.setItem('nivl.analitica.instalacion.v1', JSON.stringify({ id: 'abcdef12-3456-4789-abcd-ef1234567890', primerDia: '2026-10-01', ultimoDia: '2026-10-01' }));
    await alAbrirAnalitica();
    for (const k of CLAVES_ANALITICA) expect(await AsyncStorage.getItem(k)).toBeNull();
    expect(enviados()).toHaveLength(0);
  });

  test('si rechaza, solo se guarda la decisión', async () => {
    await sinDecision();
    await rechazarAnalitica();
    registrar('registro', { resultado: 'sesion' });
    await marcarApertura('2026-10-18');
    await vaciarCola();
    await __esperarAnalitica();
    expect(setItem().mock.calls.map((c) => c[0])).toEqual([K_CONSENTIMIENTO]);
    expect(await estadoConsentimiento()).toBe('rechaza');
    expect(enviados()).toHaveLength(0);
  });

  test('si acepta: nace la instalación y lo primero es la prueba del consentimiento con su versión', async () => {
    await sinDecision();
    await aceptarAnalitica();
    // aceptarAnalitica lanza el envío sin esperarlo: se espera a que salga.
    for (let i = 0; i < 50 && enviados().length < 3; i++) await new Promise((r) => setTimeout(r, 0));
    const ev = enviados();
    expect(ev.map((c) => c.p_evento)).toEqual(['consentimiento_analitica', 'primer_arranque', 'apertura_dia']);
    expect(ev[0].p_props).toEqual({ version: VERSION_CONSENTIMIENTO });
  });

  test('el consentimiento caduca a los 24 meses (y con otra versión del texto)', async () => {
    const hace = Date.parse('2024-10-01T10:00:00Z');
    const d = nuevaDecision('acepta', hace);
    expect(decisionVigente(d, Date.parse('2026-09-30T10:00:00Z'))).toBe('acepta');
    expect(decisionVigente(d, Date.parse('2026-10-01T10:00:00Z'))).toBeNull();
    expect(decisionVigente({ ...d, version: 'a2020_01' }, hace)).toBeNull();
    await AsyncStorage.setItem(K_CONSENTIMIENTO, JSON.stringify(nuevaDecision('acepta', Date.now() - 800 * 86_400_000)));
    jest.clearAllMocks();
    registrar('registro', { resultado: 'sesion' });
    await __esperarAnalitica();
    expect(setItem()).not.toHaveBeenCalled();
  });

  test('el install_id caduca a los 13 meses y nace otro', () => {
    expect(sumarMeses('2025-09-30', 13)).toBe('2026-10-30');
    expect(sumarMeses('2025-01-31', 1)).toBe('2025-02-28');
    const vieja = { id: 'abcdef12-3456-4789-abcd-ef1234567890', creado: '2025-09-18', primerDia: '2025-09-18', ultimoDia: '2026-10-17' };
    expect(instalacionCaducada(vieja, '2026-10-17')).toBe(false);
    expect(instalacionCaducada(vieja, '2026-10-18')).toBe(true);
    const r = aperturaDeHoy(vieja, '2026-10-18', () => 'nuevo-id-de-prueba-1234');
    expect(r.instalacion).toEqual({ id: 'nuevo-id-de-prueba-1234', creado: '2026-10-18', primerDia: '2026-10-18', ultimoDia: '2026-10-18' });
    expect(r.eventos[0].evento).toBe('primer_arranque');
  });

  test('revocar: borra en el servidor y en el móvil y guarda el rechazo; sin red lo reintenta al abrir', async () => {
    await marcarApertura('2026-10-18');
    await __esperarAnalitica();
    const id = JSON.parse((await AsyncStorage.getItem('nivl.analitica.instalacion.v1'))!).id;
    respuestaOlvido = () => Promise.reject(new TypeError('Network request failed'));
    await revocarAnalitica();
    for (const k of CLAVES_ANALITICA) expect(await AsyncStorage.getItem(k)).toBeNull();
    expect(await estadoConsentimiento()).toBe('rechaza');
    expect(JSON.parse((await AsyncStorage.getItem('nivl.analitica.revocacion.v1'))!)).toEqual([id]);
    respuestaOlvido = async () => ({ data: 2, error: null });
    rpc.mockClear();
    await alAbrirAnalitica();
    expect(rpc).toHaveBeenCalledWith('olvidar_instalacion', { p_install_id: id });
    expect(await AsyncStorage.getItem('nivl.analitica.revocacion.v1')).toBeNull();
    expect(enviados()).toHaveLength(0);
  });
});
