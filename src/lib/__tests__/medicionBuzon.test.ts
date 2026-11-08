// El buzón: qué se confirma, qué se retiene y cuándo avanza el ancla de Salud.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fijarAlmacenEntrenos } from '../medicion/almacen';
import { borrarCopiasLocales, entregarEntreno, importarDeSalud, procesarEntreno } from '../medicion/buzon';
import { filtrarNuevos } from '../medicion/fusion';
import { confirmarAncla, entrenosNuevos, reiniciarAncla } from '../medicion/saludNativa';
import { vaciarEntrenosReloj } from '@/watch/puente';
import { fetchHealthConsent } from '../health';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() }, Platform: { OS: 'ios' } }));
jest.mock('@/lib/dates', () => ({ dateKey: (d: Date) => d.toISOString().slice(0, 10) }));
jest.mock('../health', () => ({ fetchHealthConsent: jest.fn() }));
jest.mock('@/watch/puente', () => ({ alRecibirEntrenoReloj: jest.fn(() => () => {}), vaciarEntrenosReloj: jest.fn() }));
jest.mock('@/watch/contrato', () => ({ duenoEntreno: jest.fn(() => null) }));
jest.mock('../medicion/saludDiaria', () => ({ subirResumenesSalud: jest.fn() }));
jest.mock('../medicion/fusion', () => ({ filtrarNuevos: jest.fn() }), { virtual: true });
jest.mock('../medicion/saludNativa', () => ({
  confirmarAncla: jest.fn(),
  disponible: jest.fn(() => true),
  entrenosNuevos: jest.fn(),
  hayQuePreguntar: jest.fn(async () => false),
  reiniciarAncla: jest.fn(),
}));

const consentimiento = fetchHealthConsent as jest.Mock;
const filtrar = filtrarNuevos as unknown as jest.Mock;
const pagina = entrenosNuevos as jest.Mock;
const ancla = confirmarAncla as jest.Mock;

const entreno = (externo_id: string) =>
  JSON.stringify({
    origen: 'watch',
    externo_id,
    deporte: 'carrera',
    inicio: '2026-11-08T08:00:00.000Z',
    fin: '2026-11-08T08:30:00.000Z',
    duracion_s: 1800,
  });

const guardar = jest.fn();
const listarRecientes = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  consentimiento.mockResolvedValue({ accepted: true });
  filtrar.mockImplementation((candidatos: unknown[]) => candidatos);
  guardar.mockResolvedValue({ ok: true, nuevo: true });
  listarRecientes.mockResolvedValue([]);
  fijarAlmacenEntrenos({ guardar, listarRecientes });
});

describe('procesarEntreno', () => {
  it('sin permiso de salud retiene y no guarda', async () => {
    consentimiento.mockResolvedValue({ accepted: false });
    await expect(procesarEntreno('u', entreno('a'))).resolves.toBe(false);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('si no se puede comprobar el permiso, retiene', async () => {
    consentimiento.mockRejectedValue(new Error('red'));
    await expect(procesarEntreno('u', entreno('a'))).resolves.toBe(false);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('un JSON ilegible se confirma: reintentarlo no lo arregla', async () => {
    await expect(procesarEntreno('u', 'no es json')).resolves.toBe(true);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('un duplicado de otro origen se confirma sin guardar', async () => {
    filtrar.mockReturnValue([]);
    await expect(procesarEntreno('u', entreno('a'))).resolves.toBe(true);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('sin poder leer los conocidos retiene: cobraría dos veces', async () => {
    listarRecientes.mockRejectedValue(new Error('red'));
    await expect(procesarEntreno('u', entreno('a'))).resolves.toBe(false);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('guardar con ok:false o con error no se confirma', async () => {
    guardar.mockResolvedValueOnce({ ok: false, motivo: 'red' });
    await expect(procesarEntreno('u', entreno('a'))).resolves.toBe(false);
    guardar.mockRejectedValueOnce(new Error('red'));
    await expect(procesarEntreno('u', entreno('a'))).resolves.toBe(false);
  });

  it('guardado se confirma', async () => {
    await expect(procesarEntreno('u', entreno('a'))).resolves.toBe(true);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('un fallo no bloquea la cola en serie', async () => {
    guardar.mockRejectedValueOnce(new Error('red'));
    const resultados = await Promise.all([procesarEntreno('u', entreno('a')), procesarEntreno('u', entreno('b'))]);
    expect(resultados).toEqual([false, true]);
  });
});

describe('entregarEntreno', () => {
  it('dice qué ha pasado con esa sesión', async () => {
    await expect(entregarEntreno('u', entreno('a'))).resolves.toBe('guardado');
    filtrar.mockReturnValue([]);
    await expect(entregarEntreno('u', entreno('b'))).resolves.toBe('duplicado');
    filtrar.mockImplementation((c: unknown[]) => c);
    guardar.mockResolvedValueOnce({ ok: false, motivo: 'red' });
    await expect(entregarEntreno('u', entreno('c'))).resolves.toBe('retenido');
  });

  it('lo que ya existía cuenta como duplicado', async () => {
    guardar.mockResolvedValueOnce({ ok: true, nuevo: false });
    await expect(entregarEntreno('u', entreno('a'))).resolves.toBe('duplicado');
  });
});

describe('borrarCopiasLocales', () => {
  it('quita pendientes, almacén local y buzón del reloj', async () => {
    await borrarCopiasLocales('u');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('nivl:medicion:pendientes:u');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('nivl:medicion:entrenos:u');
    expect(vaciarEntrenosReloj).toHaveBeenCalledWith('u');
  });
});

describe('importarDeSalud', () => {
  it('con otra cuenta en el teléfono reinicia el ancla', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('otra');
    pagina.mockResolvedValueOnce({ entrenos: [], ancla: null });
    await importarDeSalud('u');
    expect(reiniciarAncla).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('nivl:medicion:duenoAncla', 'u');
  });

  it('con la misma cuenta no reinicia', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('u');
    pagina.mockResolvedValueOnce({ entrenos: [], ancla: null });
    await importarDeSalud('u');
    expect(reiniciarAncla).not.toHaveBeenCalled();
  });

  it('un fallo de Salud no parece «nada nuevo»', async () => {
    pagina.mockResolvedValueOnce({ entrenos: [], ancla: null, fallo: true });
    await expect(importarDeSalud('u')).resolves.toEqual({ procesados: 0, completa: false, fallo: true });
  });

  it('avanza el ancla con la página guardada', async () => {
    pagina.mockResolvedValueOnce({ entrenos: [entreno('a'), entreno('b')], ancla: 'A1' });
    await expect(importarDeSalud('u')).resolves.toEqual({ procesados: 2, completa: true });
    expect(ancla).toHaveBeenCalledWith('A1');
  });

  it('con un fallo no avanza el ancla', async () => {
    pagina.mockResolvedValueOnce({ entrenos: [entreno('a'), entreno('b')], ancla: 'A1' });
    guardar.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, motivo: 'red' });
    await expect(importarDeSalud('u')).resolves.toEqual({ procesados: 1, completa: false });
    expect(ancla).not.toHaveBeenCalled();
  });

  it('sin permiso no avanza el ancla', async () => {
    consentimiento.mockResolvedValue({ accepted: false });
    pagina.mockResolvedValueOnce({ entrenos: [entreno('a')], ancla: 'A1' });
    await expect(importarDeSalud('u')).resolves.toEqual({ procesados: 0, completa: false });
    expect(ancla).not.toHaveBeenCalled();
  });
});
