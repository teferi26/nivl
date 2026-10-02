import { accesoFotos, leerPuedeCompartirFotos, necesitaPermisoFotos } from '@/components/permisoFotos';
import { fetchMayorDeEdadConfirmada } from '@/lib/age';
import { fetchHealthConsent } from '@/lib/health';

jest.mock('@/lib/age', () => ({
  fetchMayorDeEdadConfirmada: jest.fn(),
  confirmarMayorDeEdad: jest.fn(),
}));
jest.mock('@/lib/health', () => ({
  fetchHealthConsent: jest.fn(),
}));
// El hook no se monta aquí: el proveedor de salud trae Supabase y avisos.
jest.mock('@/components/ConsentimientoSalud', () => ({ useHealthConsent: jest.fn() }));

const edad = fetchMayorDeEdadConfirmada as jest.MockedFunction<typeof fetchMayorDeEdadConfirmada>;
const salud = fetchHealthConsent as jest.MockedFunction<typeof fetchHealthConsent>;
const consentimiento = (accepted: boolean) => ({ accepted, revision: 1, erasurePending: false });

const FOTO = { uri: 'file:///cache/a.jpg', fecha: '2026-10-01' };

beforeEach(() => {
  edad.mockReset();
  salud.mockReset();
});

describe('necesitaPermisoFotos', () => {
  it('antes y después siempre', () => {
    expect(necesitaPermisoFotos({ tipo: 'antesDespues', antes: FOTO, despues: FOTO })).toBe(true);
  });
  it('recuerdo solo si lleva foto', () => {
    expect(necesitaPermisoFotos({ tipo: 'recuerdo', etiqueta: 'Evidencia', titulo: 'x', foto: FOTO })).toBe(true);
    expect(necesitaPermisoFotos({ tipo: 'recuerdo', etiqueta: 'Cierre', titulo: 'x', foto: null })).toBe(false);
    expect(necesitaPermisoFotos({ tipo: 'recuerdo', etiqueta: 'Cierre', titulo: 'x' })).toBe(false);
  });
  it('el resto no', () => {
    expect(necesitaPermisoFotos({ tipo: 'logro', titulo: 'x' })).toBe(false);
    expect(necesitaPermisoFotos({ tipo: 'racha', dias: 30 })).toBe(false);
    expect(necesitaPermisoFotos({ tipo: 'nivel', nivel: 4 })).toBe(false);
  });
});

describe('leerPuedeCompartirFotos', () => {
  it('true con 18+ y salud', async () => {
    edad.mockResolvedValue(true);
    salud.mockResolvedValue(consentimiento(true));
    await expect(leerPuedeCompartirFotos()).resolves.toBe(true);
    expect(edad).toHaveBeenCalledTimes(1);
    expect(salud).toHaveBeenCalledTimes(1);
  });
  it('false sin confirmación 18+', async () => {
    edad.mockResolvedValue(false);
    salud.mockResolvedValue(consentimiento(true));
    await expect(leerPuedeCompartirFotos()).resolves.toBe(false);
  });
  it('false sin salud', async () => {
    edad.mockResolvedValue(true);
    salud.mockResolvedValue(consentimiento(false));
    await expect(leerPuedeCompartirFotos()).resolves.toBe(false);
  });
  it('false si falla cualquiera de las dos lecturas', async () => {
    edad.mockRejectedValue(new Error('red'));
    salud.mockResolvedValue(consentimiento(true));
    await expect(leerPuedeCompartirFotos()).resolves.toBe(false);
    edad.mockResolvedValue(true);
    salud.mockRejectedValue(new Error('red'));
    await expect(leerPuedeCompartirFotos()).resolves.toBe(false);
  });
  it('lee las dos en paralelo', async () => {
    let soltar: (v: boolean) => void = () => {};
    edad.mockReturnValue(new Promise<boolean>((r) => { soltar = r; }));
    salud.mockResolvedValue(consentimiento(true));
    const p = leerPuedeCompartirFotos();
    await Promise.resolve();
    expect(salud).toHaveBeenCalledTimes(1);
    soltar(true);
    await expect(p).resolves.toBe(true);
  });
});

describe('accesoFotos', () => {
  it('cargando mientras no se sabe la salud', () => {
    expect(accesoFotos({ salud: null, mayor18: true })).toBe('cargando');
    expect(accesoFotos({ salud: null, mayor18: undefined })).toBe('cargando');
  });
  it('sin salud, nada más importa', () => {
    expect(accesoFotos({ salud: false, mayor18: true })).toBe('sin_salud');
    expect(accesoFotos({ salud: false, mayor18: undefined })).toBe('sin_salud');
  });
  it('con salud, espera a la edad', () => {
    expect(accesoFotos({ salud: true, mayor18: undefined })).toBe('cargando');
  });
  it('sin confirmación se pregunta; confirmada abre', () => {
    expect(accesoFotos({ salud: true, mayor18: null })).toBe('confirmar_edad');
    expect(accesoFotos({ salud: true, mayor18: false })).toBe('confirmar_edad');
    expect(accesoFotos({ salud: true, mayor18: true })).toBe('abierto');
  });
});
