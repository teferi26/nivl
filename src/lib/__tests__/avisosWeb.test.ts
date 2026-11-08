import {
  _reiniciarAvisos,
  avisarEnPantalla,
  avisarWeb,
  avisosActuales,
  cerrarAviso,
  MAX_AVISOS,
  pedirPermisoNavegador,
  permisoNavegador,
  suscribirAvisos,
} from '../web/avisos';

type G = { Notification?: unknown; document?: unknown };
const g = globalThis as G;

function notificacionFalsa(permiso: 'granted' | 'denied' | 'default') {
  const creadas: { titulo: string; opciones: unknown }[] = [];
  const N = function (this: unknown, titulo: string, opciones: unknown) {
    creadas.push({ titulo, opciones });
  } as unknown as { permission: string; requestPermission: () => Promise<string> };
  N.permission = permiso;
  N.requestPermission = jest.fn(async () => 'granted');
  return { N, creadas };
}

describe('avisos web', () => {
  const docAntes = g.document;
  const notAntes = g.Notification;
  beforeEach(() => _reiniciarAvisos());
  afterEach(() => {
    g.document = docAntes;
    g.Notification = notAntes;
  });

  it('pone, sustituye por etiqueta y cierra', () => {
    const vistos: number[] = [];
    const quitar = suscribirAvisos((l) => vistos.push(l.length));
    const a = avisarEnPantalla('Fin', 'Descansa', 'focus');
    avisarEnPantalla('Fin otra vez', 'Descansa', 'focus');
    expect(avisosActuales()).toHaveLength(1);
    expect(avisosActuales()[0]!.titulo).toBe('Fin otra vez');
    cerrarAviso(a.id); // ya no existe: no cambia nada
    expect(avisosActuales()).toHaveLength(1);
    cerrarAviso(avisosActuales()[0]!.id);
    expect(avisosActuales()).toHaveLength(0);
    quitar();
    expect(vistos).toEqual([0, 1, 1, 0]);
  });

  it('guarda como mucho los últimos', () => {
    for (let i = 0; i < MAX_AVISOS + 2; i++) avisarEnPantalla(`t${i}`, '', `e${i}`);
    expect(avisosActuales()).toHaveLength(MAX_AVISOS);
    expect(avisosActuales()[0]!.titulo).toBe('t2');
  });

  it('sin API de notificaciones: solo en pantalla', async () => {
    delete g.Notification;
    expect(permisoNavegador()).toBe('sin_soporte');
    expect(await pedirPermisoNavegador()).toBe(false);
    expect(avisarWeb('Fin', 'x', 'focus')).toBe(false);
    expect(avisosActuales()).toHaveLength(1);
  });

  it('con permiso y la pestaña oculta, además notificación del navegador', () => {
    const { N, creadas } = notificacionFalsa('granted');
    g.Notification = N;
    g.document = { visibilityState: 'hidden' };
    expect(avisarWeb('Fin del bloque', 'Descansa cinco minutos.', 'focus')).toBe(true);
    expect(creadas).toHaveLength(1);
    expect(avisosActuales()).toHaveLength(1);
  });

  it('con la pestaña delante, solo en pantalla', () => {
    const { N, creadas } = notificacionFalsa('granted');
    g.Notification = N;
    g.document = { visibilityState: 'visible' };
    expect(avisarWeb('Fin', 'x', 'focus')).toBe(false);
    expect(creadas).toHaveLength(0);
  });

  it('solo pide permiso si no está decidido', async () => {
    const denegado = notificacionFalsa('denied');
    g.Notification = denegado.N;
    expect(await pedirPermisoNavegador()).toBe(false);
    expect(denegado.N.requestPermission).not.toHaveBeenCalled();
    const pendiente = notificacionFalsa('default');
    g.Notification = pendiente.N;
    expect(await pedirPermisoNavegador()).toBe(true);
    expect(pendiente.N.requestPermission).toHaveBeenCalledTimes(1);
  });
});
