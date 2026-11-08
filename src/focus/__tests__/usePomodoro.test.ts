// NIVL · FOCUS: en frío, el bloque acabado fuera espera a que lleguen los datos.
import { createElement } from 'react';
// @ts-expect-error el paquete no trae tipos y solo se usa aquí
import { act, create } from 'react-test-renderer';
import type { Cierre } from '@/focus/pomodoro';
import { usePomodoro } from '@/components/focus/usePomodoro';

const mockGuardado = { finEn: 0 };

jest.mock('@/focus/temporizador', () => {
  const { CONFIG_POR_DEFECTO: c, ESTADO_INICIAL: e } = jest.requireActual('@/focus/pomodoro');
  return {
    leerConfig: jest.fn(async () => c),
    leerEstado: jest.fn(async () => ({ ...e, finEn: mockGuardado.finEn, idFase: 'foco-1-1', minutosFase: 25, fechaInicio: '2026-11-09', objetivo: { asignaturaId: 'h', temaId: 't', misionId: null } })),
    guardarEstado: jest.fn(async () => undefined),
    guardarConfig: jest.fn(async () => undefined),
    avisarFin: jest.fn(async () => undefined),
    cancelarAvisoFin: jest.fn(async () => undefined),
  };
});
jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));
jest.mock('@/i18n', () => ({ t: (k: string) => k }));
jest.mock('@/components/focus/keepAwake', () => ({ mantenerDespierto: jest.fn() }));
jest.mock('@/components/focus/sonidoFin', () => ({ sonarFin: jest.fn() }));

function Prueba({ puede, onFin }: { puede: boolean; onFin: (c: Cierre) => void }) {
  usePomodoro('u', onFin, puede);
  return null;
}

const asentar = () => act(async () => void (await new Promise((r) => setImmediate(r))));

it('no cierra hasta tener datos, y entonces cierra una vez', async () => {
  mockGuardado.finEn = Date.now() - 60_000;
  const onFin = jest.fn();
  let r!: ReturnType<typeof create>;
  await act(async () => {
    r = create(createElement(Prueba, { puede: false, onFin }));
  });
  await asentar();
  expect(onFin).not.toHaveBeenCalled();

  await act(async () => {
    r.update(createElement(Prueba, { puede: true, onFin }));
  });
  await asentar();
  expect(onFin).toHaveBeenCalledTimes(1);
  expect((onFin.mock.calls[0]![0] as Cierre).focoCompleto?.objetivo.asignaturaId).toBe('h');

  await act(async () => {
    r.update(createElement(Prueba, { puede: true, onFin }));
  });
  expect(onFin).toHaveBeenCalledTimes(1);
  await act(async () => r.unmount());
});
