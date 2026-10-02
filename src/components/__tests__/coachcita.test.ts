import { describe, expect, test } from '@jest/globals';
import { citaDe, esConsulta, sinConsultas } from '../coach/cita';

describe('cita del coach', () => {
  test('reconoce las herramientas de consulta', () => {
    expect(esConsulta('consultar_historial')).toBe(true);
    expect(esConsulta('consultar_dia')).toBe(true);
    expect(esConsulta('registrar_dato')).toBe(false);
    expect(esConsulta('toString')).toBe(false);
  });

  test('sin consultas no hay cita', () => {
    expect(citaDe([])).toBeNull();
    expect(citaDe(['registrar_dato', 'fijar_ficha'])).toBeNull();
  });

  test('una consulta', () => {
    expect(citaDe(['consultar_historial'])).toBe('Consultado: tu historial');
  });

  test('sin duplicados y en orden de llegada', () => {
    expect(citaDe(['consultar_dia', 'registrar_dato', 'consultar_historial', 'consultar_dia'])).toBe(
      'Consultado: tu registro del día y tu historial',
    );
    expect(citaDe(['consultar_historial', 'consultar_historial'])).toBe('Consultado: tu historial');
  });

  test('las consultas salen de la lista de acciones', () => {
    expect(sinConsultas(['consultar_dia', 'registrar_dato', 'consultar_historial'])).toEqual(['registrar_dato']);
  });

  test('sin guion largo', () => {
    expect(citaDe(['consultar_dia', 'consultar_historial'])).not.toContain('\u2014');
  });
});
