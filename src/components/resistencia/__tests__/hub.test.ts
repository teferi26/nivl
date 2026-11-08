// NIVL · Resistencia: lo que decide el hub y la hoja manual.
import { construirSalida, diasHasta, duracionTexto, type EntradaSalida } from '../HubVista';
import { FORM_ENTRENO_VACIO, prefillEntreno, validarEntreno } from '../HojaEntreno';
import { formDeObjetivo } from '../HojaObjetivo';
import { claveTitulo, detalleSesion, esDetalleDelPlan } from '../textosPlan';
import { generarPlan } from '@/lib/planCarrera';
import type { ObjetivoCarrera } from '@/lib/resistencia';
import { leerCiudades } from '../HojaUbicacion';
import { marcasKm, pasoMarcas, proyectarRuta } from '../RutaMapa';
import type { HoraClima } from '@/lib/mejorHora';

// El kit de IRON arrastra `ui`, y `ui` a Supabase: aquí solo se prueba lo puro.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const hora = (h: string): HoraClima => ({
  hora: `2026-11-08T${h}:00`,
  temp: 15,
  sensacion: 15,
  lluvia_prob: 0,
  lluvia_mm: 0,
  viento_kmh: 5,
  racha_kmh: 10,
  uv: 1,
  codigo: 1,
  es_de_dia: true,
});
const horas = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'].map(hora);

const base: EntradaSalida = {
  hoy: '2026-11-08',
  ahora: '09:30',
  bienestar: null,
  ciudad: 'Madrid',
  sesiones: [],
  horas,
  estadoForma: 'optimo',
  ocupadas: [],
};

describe('construirSalida', () => {
  it('con dolor deriva, aunque no haya ciudad ni previsión', () => {
    const s = construirSalida({
      ...base,
      ciudad: null,
      horas: null,
      bienestar: { dolor: true, dolor_zona: 'rodilla', sueno_h: 8, fatiga: 1 },
    });
    expect(s).toEqual({ estado: 'derivar', zona: 'rodilla' });
  });

  it('dolor ayer y sin parte hoy: sigue derivando, como el coach', () => {
    const s = construirSalida({ ...base, partes: [{ fecha: '2026-11-07', dolor: true, dolor_zona: 'rodilla' }] });
    expect(s).toEqual({ estado: 'derivar', zona: 'rodilla' });
  });

  it('un parte de hoy sin dolor levanta el de ayer', () => {
    const s = construirSalida({
      ...base,
      partes: [
        { fecha: '2026-11-07', dolor: true, dolor_zona: 'rodilla' },
        { fecha: '2026-11-08', dolor: false, dolor_zona: null },
      ],
    });
    expect(s.estado).toBe('veredicto');
  });

  it('un dolor de hace más de tres días ya no deriva', () => {
    expect(construirSalida({ ...base, partes: [{ fecha: '2026-11-05', dolor: true, dolor_zona: null }] }).estado).toBe('veredicto');
  });

  it('sin ciudad la pide y no calcula', () => {
    expect(construirSalida({ ...base, ciudad: null }).estado).toBe('sin_ubicacion');
  });

  it('distingue previsión pedida de previsión fallida', () => {
    expect(construirSalida({ ...base, horas: undefined }).estado).toBe('cargando');
    expect(construirSalida({ ...base, horas: null }).estado).toBe('sin_prevision');
  });

  it('una previsión de otro día no vale para hoy', () => {
    expect(construirSalida({ ...base, hoy: '2026-11-09' }).estado).toBe('sin_prevision');
  });

  it('la piscina, la fuerza y el descanso no dependen del tiempo', () => {
    for (const disciplina of ['natacion', 'fuerza', 'descanso'] as const) {
      const s = construirSalida({ ...base, sesiones: [{ disciplina, duracion_min: 45, hecha_entreno_id: null }] });
      expect(s.estado).toBe('no_aplica');
    }
  });

  it('con todo hecho no propone salir otra vez', () => {
    const s = construirSalida({ ...base, sesiones: [{ disciplina: 'carrera', duracion_min: 45, hecha_entreno_id: 'x' }] });
    expect(s.estado).toBe('hecho');
  });

  it('no recomienda una hora que ya ha pasado', () => {
    const s = construirSalida({ ...base, sesiones: [{ disciplina: 'carrera', duracion_min: 45, hecha_entreno_id: null }] });
    if (s.estado !== 'veredicto' || s.veredicto.tipo !== 'salir') throw new Error(`inesperado: ${JSON.stringify(s)}`);
    expect(s.veredicto.ventana.inicio >= '2026-11-08T10:00').toBe(true);
  });
});

describe('textos de cifras', () => {
  it('duración', () => {
    expect(duracionTexto(3130)).toBe('52:10');
    expect(duracionTexto(3753)).toBe('1:02:33');
  });
  it('días hasta la carrera, también cruzando el cambio de hora', () => {
    expect(diasHasta('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('validarEntreno', () => {
  const ahora = new Date(2026, 10, 8, 18, 0);
  const form = { ...FORM_ENTRENO_VACIO, duracion: '40', distancia: '8,5' };

  it('hoy sin hora: acabado ahora', () => {
    const v = validarEntreno(form, ahora, 'abc');
    if (!v.ok) throw new Error('debería validar');
    expect(v.entrada.externo_id).toBe('manual:abc');
    expect(v.entrada.origen).toBe('manual');
    expect(v.entrada.distancia_m).toBe(8500);
    expect(v.entrada.duracion_s).toBe(2400);
    expect(new Date(v.entrada.fin).getTime()).toBe(ahora.getTime());
  });

  it('en piscina la distancia va en metros y guarda el largo', () => {
    const v = validarEntreno({ ...form, deporte: 'piscina', distancia: '1500', largo: '25' }, ahora, 'a');
    if (!v.ok) throw new Error('debería validar');
    expect(v.entrada.distancia_m).toBe(1500);
    expect(v.entrada.largo_piscina_m).toBe(25);
  });

  it('lo que el deporte no pide no se guarda aunque quedara escrito', () => {
    const v = validarEntreno({ ...form, deporte: 'fuerza', desnivel: '300', largo: '25' }, ahora, 'a');
    if (!v.ok) throw new Error('debería validar');
    expect(v.entrada.distancia_m).toBeNull();
    expect(v.entrada.desnivel_m).toBeNull();
    expect(v.entrada.largo_piscina_m).toBeNull();
  });

  it('sin duración o con cifras imposibles, falla en su campo', () => {
    const v = validarEntreno({ ...form, duracion: '', fc: '300', rpe: '11' }, ahora, 'a');
    if (v.ok) throw new Error('no debería validar');
    expect(v.errores.duracion).toBeTruthy();
    expect(v.errores.fc).toBeTruthy();
    expect(v.errores.rpe).toBeTruthy();
    expect(v.errores.distancia).toBeNull();
  });

  it('rechaza el futuro y las fechas que no existen', () => {
    expect(validarEntreno({ ...form, hora: '23:00' }, ahora, 'a').ok).toBe(false);
    expect(validarEntreno({ ...form, dia: 'otro', fecha: '2026-12-01' }, ahora, 'a').ok).toBe(false);
    expect(validarEntreno({ ...form, dia: 'otro', fecha: '2026-02-31' }, ahora, 'a').ok).toBe(false);
  });

  it('la fecha se escribe como día, mes y año', () => {
    const v = validarEntreno({ ...form, dia: 'otro', fecha: '01/11/2026' }, ahora, 'a');
    if (!v.ok) throw new Error('debería validar');
    expect(new Date(v.entrada.inicio).getDate()).toBe(1);
  });

  it('ayer sin hora cae a mediodía de ayer', () => {
    const v = validarEntreno({ ...form, dia: 'ayer' }, ahora, 'a');
    if (!v.ok) throw new Error('debería validar');
    expect(new Date(v.entrada.inicio).getDate()).toBe(7);
    expect(new Date(v.entrada.inicio).getHours()).toBe(12);
  });
});

describe('leerCiudades', () => {
  it('compone el nombre y descarta lo incompleto', () => {
    expect(
      leerCiudades([
        { nombre: 'Madrid', region: 'Madrid', pais: 'España', lat: 40.42, lon: -3.7, zona: 'Europe/Madrid' },
        { nombre: 'Sin coordenadas', region: null, pais: null },
        { nombre: 'Polo', lat: 120, lon: 0 },
      ]),
    ).toEqual([{ nombre: 'Madrid, España', lat: 40.42, lon: -3.7 }]);
    expect(leerCiudades({ error: 'x' })).toEqual([]);
  });
});

describe('RutaMapa', () => {
  const ruta = Array.from({ length: 41 }, (_, i) => ({ lat: 40 + i * 0.001, lon: -3.7 }));

  it('la ruta cabe, sin salirse del margen, y el norte queda arriba', () => {
    const p = proyectarRuta(ruta, 300, 200, 10);
    expect(p).toHaveLength(41);
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(10);
      expect(q.x).toBeLessThanOrEqual(290);
      expect(q.y).toBeGreaterThanOrEqual(10);
      expect(q.y).toBeLessThanOrEqual(190);
    }
    expect(p[0]!.y).toBeGreaterThan(p[40]!.y);
  });

  it('una ruta sin extensión va al centro y no da NaN', () => {
    const p = proyectarRuta([{ lat: 40, lon: -3 }, { lat: 40, lon: -3 }], 300, 200, 10);
    expect(p[0]).toEqual({ x: 150, y: 100 });
  });

  it('marca cada km en orden', () => {
    const marcas = marcasKm(ruta, proyectarRuta(ruta, 300, 200, 10));
    expect(marcas.map((m) => m.km)).toEqual([1, 2, 3, 4]);
  });

  it('una ruta larga no se llena de marcas', () => {
    expect(pasoMarcas(10000)).toBe(1);
    expect(pasoMarcas(40000)).toBe(5);
    expect(pasoMarcas(180000)).toBe(10);
  });
});

describe('prefillEntreno', () => {
  const s = (disciplina: 'natacion' | 'brick' | 'descanso', hecha: string | null = null) => ({ disciplina, duracion_min: 45, hecha_entreno_id: hecha });
  it('rellena con la primera sesión pendiente', () => {
    expect(prefillEntreno([s('natacion', 'x'), s('brick')])).toEqual({ deporte: 'bici', duracion: '45' });
    expect(prefillEntreno([s('natacion')])).toEqual({ deporte: 'piscina', duracion: '45' });
  });
  it('un descanso no rellena nada', () => {
    expect(prefillEntreno([s('descanso')])).toEqual({});
  });
});

describe('formDeObjetivo', () => {
  it('trae la prueba activa al formulario', () => {
    const o = { tipo: 'otra', nombre: 'Mi prueba', fecha: '2027-03-07', natacion_m: 1000, bici_m: 30500, carrera_m: null, horas_semana: 7.5, nivel: 'avanzado' } as ObjetivoCarrera;
    expect(formDeObjetivo(o)).toEqual({ tipo: 'otra', nombre: 'Mi prueba', fecha: '07/03/2027', horas: '7,5', nivel: 'avanzado', natacion: '1000', bici: '30,5', carrera: '' });
  });
});

describe('textos del plan', () => {
  it('todo título y detalle que escribe generarPlan se resuelve por clave', () => {
    for (const tipo of ['olimpico', 'maraton', '5k'] as const) {
      for (const nivel of ['principiante', 'avanzado'] as const) {
        const p = generarPlan({ tipo, fecha_prueba: '2027-03-07', hoy: '2026-11-08', horas_semana: 8, nivel });
        for (const x of p.semanas.flatMap((s) => s.sesiones)) {
          expect([x.titulo, claveTitulo(x.titulo) !== null]).toEqual([x.titulo, true]);
          expect([x.detalle, esDetalleDelPlan(x.detalle)]).toEqual([x.detalle, true]);
        }
      }
    }
  });
  it('lo que reescribe el coach sale tal cual', () => {
    expect(detalleSesion('Hoy, cuarenta minutos en llano.')).toBe('Hoy, cuarenta minutos en llano.');
  });
});
