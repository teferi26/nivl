import { xpCostForLevel } from '../game';
import { celebracionInsignia } from '../progression';
import { estadoInicial, hayAlgo, MAX_VISTAS, reducir, textoToast, type EstadoCola, type EventoCola } from '../celebracionCola';

jest.mock('../supabase', () => ({ supabase: {} }));

const xpDeNivel = (n: number) => { let c = 0; for (let l = 1; l < n; l++) c += xpCostForLevel(l); return c; };
const perfil = (nivel: number, extra = {}) => ({ xp_total: xpDeNivel(nivel), streak_days: 0, protection_stones: 0, ...extra });
const fecha = '2026-10-02';

const correr = (eventos: EventoCola[], s: EstadoCola = estadoInicial()) => eventos.reduce(reducir, s);
const cargado = (vistas: string[] = []) => correr([{ tipo: 'cargar', vistas }]);

describe('cola de celebraciones', () => {
  test('XP solo → un toast', () => {
    const s = correr([{ tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(3), perfilDespues: { ...perfil(3), xp_total: perfil(3).xp_total + 50 }, logrosAntes: [], fecha, resumen: ['+50 XP · FUE'], final: true } }], cargado());
    expect(s.mostrando?.forma).toBe('toast');
    expect(s.mostrando?.principal).toBeNull();
    expect(textoToast(s.mostrando!)).toBe('+50 XP · FUE');
  });

  test('nivel + XP → ceremonia corta con el XP en el resumen', () => {
    const s = correr([{ tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(3), perfilDespues: perfil(4), logrosAntes: [], fecha, resumen: ['+80 XP · FUE'], final: true } }], cargado());
    expect(s.mostrando).toMatchObject({ forma: 'ceremonia-corta', principal: { tipo: 'nivel', nivel: 4 } });
    expect(s.mostrando!.resumen).toContain('+80 XP · FUE');
    expect(s.vistas.has('nivel:4')).toBe(true);
  });

  test('XP y luego el rango en la misma acción → épica que se come el toast', () => {
    const logrosAntes = ['rango_D', 'rango_C'];
    let s = correr([{ tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(16), perfilDespues: { ...perfil(16), xp_total: perfil(16).xp_total + 50 }, logrosAntes, fecha, resumen: ['+50 XP · FUE'], final: true } }], cargado());
    expect(s.mostrando?.forma).toBe('toast');
    s = reducir(s, { tipo: 'llega', a: { accion: 'a', logrosNuevos: [{ codigo: 'rango_B', nombre: 'Campeón', desc: '' }], final: true } });
    expect(s.mostrando).toMatchObject({ forma: 'ceremonia-epica', principal: { tipo: 'rango', rango: 'B' } });
    expect(s.mostrando!.resumen).toEqual(['+50 XP · FUE']);
    // Nada esperando detrás: el toast no vuelve.
    expect(s.listas).toEqual([]);
    expect(s.mostrando!.estado?.siguienteRango?.rango).toBe('A');
  });

  test('rango + nivel + grado → solo la ceremonia del rango', () => {
    const s = correr([{ tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(14), perfilDespues: perfil(15), logrosAntes: ['rango_D', 'rango_C'], logrosNuevos: [{ codigo: 'rango_B', nombre: 'Campeón', desc: '' }], fecha, final: true } }], cargado());
    expect(s.mostrando?.forma).toBe('ceremonia-epica');
    expect(s.mostrando?.clavesResto).toEqual([]);
    expect(s.mostrando?.resumen.some((x) => /Nivel|Campeón I/.test(x))).toBe(false);
  });

  test('una clave ya vista no se repite', () => {
    const s = correr([{ tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(14), perfilDespues: perfil(15), logrosAntes: ['rango_D', 'rango_C'], logrosNuevos: [{ codigo: 'rango_B', nombre: 'Campeón', desc: '' }], fecha, final: true } }], cargado(['rango:B']));
    expect(s.mostrando).toBeNull();
    expect(hayAlgo(s)).toBe(false);
  });

  test('sin cargar no se enseña nada; al cargar, sí (y con las vistas guardadas)', () => {
    let s = correr([{ tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(3), perfilDespues: perfil(4), logrosAntes: [], fecha, final: true } }]);
    expect(s.cargado).toBe(false);
    expect(s.mostrando).toBeNull();
    expect(hayAlgo(s)).toBe(true);
    expect(s.vistas.size).toBe(0);
    s = reducir(s, { tipo: 'cargar', vistas: ['nivel:4'] });
    expect(s.mostrando).toBeNull();
    s = correr([{ tipo: 'llega', a: { accion: 'b', perfilAntes: perfil(4), perfilDespues: perfil(5), logrosAntes: [], fecha, final: true } }]);
    expect(s.mostrando).toBeNull();
    s = reducir(s, { tipo: 'cargar', vistas: [] });
    expect(s.mostrando?.principal?.clave).toBe('nivel:5');
  });

  test('el resto se marca como visto al mostrar', () => {
    const s = correr([{ tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(3, { streak_days: 6 }), perfilDespues: perfil(4, { streak_days: 7 }), logrosAntes: [], logrosNuevos: [{ codigo: 'streak_7', nombre: 'Siete días', desc: '' }], fecha, final: true } }], cargado());
    expect(s.mostrando?.principal?.clave).toBe('nivel:4');
    expect(s.mostrando?.clavesResto).toEqual([`racha:7:${fecha}`, 'logro:streak_7']);
    for (const k of ['nivel:4', `racha:7:${fecha}`, 'logro:streak_7']) expect(s.vistas.has(k)).toBe(true);
    expect(s.mostrando?.resumen).toEqual(['Racha de 7 días', 'Logro · Siete días']);
  });

  test('las claves se marcan al MOSTRAR, no al calcular', () => {
    let s = correr([
      { tipo: 'avisar', id: 'aviso:1', texto: 'Hola' },
      { tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(3), perfilDespues: perfil(4), logrosAntes: [], fecha, final: true } },
    ], cargado());
    expect(s.mostrando?.resumen).toEqual(['Hola']);
    expect(s.vistas.has('nivel:4')).toBe(false);
    s = reducir(s, { tipo: 'ocultar' });
    expect(s.mostrando?.principal?.clave).toBe('nivel:4');
    expect(s.vistas.has('nivel:4')).toBe(true);
  });

  test('una insignia en extra se celebra', () => {
    const insignia = celebracionInsignia('reclutador', 0, 1)!;
    const s = correr([{ tipo: 'llega', a: { accion: 'a', extra: [insignia], final: true } }], cargado());
    expect(s.mostrando).toMatchObject({ forma: 'toast', principal: { tipo: 'insignia' } });
    expect(textoToast(s.mostrando!)).toBe('Insignia · Reclutador');
    expect(s.vistas.has('insignia:reclutador:1')).toBe(true);
  });

  test('la ventana fusiona llegadas hasta cerrarse', () => {
    let s = correr([
      { tipo: 'llega', a: { accion: 'a', perfilAntes: perfil(3), perfilDespues: perfil(3), logrosAntes: [], fecha, resumen: ['+20 XP'] } },
      { tipo: 'llega', a: { accion: 'a', perfilDespues: perfil(4), resumen: ['+1 PB'] } },
    ], cargado());
    expect(s.mostrando).toBeNull();
    s = reducir(s, { tipo: 'cerrar', accion: 'a' });
    expect(s.mostrando).toMatchObject({ forma: 'ceremonia-corta', resumen: ['+20 XP', '+1 PB'] });
  });

  test('las vistas se recortan a las 300 más recientes', () => {
    const muchas = Array.from({ length: MAX_VISTAS + 50 }, (_, i) => `k:${i}`);
    const s = correr([{ tipo: 'avisar', id: 'aviso:1', texto: 'x' }], cargado(muchas));
    expect(s.vistas.size).toBe(MAX_VISTAS);
    expect(s.vistas.has('k:0')).toBe(false);
    expect(s.vistas.has(`k:${MAX_VISTAS + 49}`)).toBe(true);
  });

  test('vaciar (cierre de sesión) borra la memoria', () => {
    const s = correr([{ tipo: 'avisar', id: 'aviso:1', texto: 'x' }, { tipo: 'vaciar' }], cargado(['rango:B']));
    expect(s).toMatchObject({ cargado: false, mostrando: null });
    expect(s.vistas.size).toBe(0);
  });
});
