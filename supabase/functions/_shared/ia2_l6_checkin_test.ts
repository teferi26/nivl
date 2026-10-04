// L6 · Reglas puras del checkin: topes, sueño, 6 h, retiro y limpieza del texto.
import { assertEquals } from 'jsr:@std/assert@1';
import {
  checkinPermitido,
  desdeParaMensajes,
  esMensajeDelGladiador,
  fechaLocal,
  horaDelCheckin,
  limpiarCheckin,
  MAX_CARACTERES_CHECKIN,
  pushesDeHoy,
  retirado,
  type EntradaCheckin,
} from './checkin.ts';

const TZ = 'Europe/Madrid';
// 2026-10-10 18:30 en Madrid (CEST, UTC+2).
const AHORA_ISO = '2026-10-10T16:30:00Z';
const AHORA_MS = Date.parse(AHORA_ISO);
const h = (horas: number) => new Date(AHORA_MS - horas * 3_600_000).toISOString();
const d = (dias: number) => h(dias * 24);

function entrada(extra: Partial<EntradaCheckin> = {}): EntradaCheckin {
  return {
    ahora: { fecha: '2026-10-10', min: 18 * 60 + 30 },
    ahoraMs: AHORA_MS,
    timezone: TZ,
    wakeTime: '08:00:00',
    sleepTime: '23:00:00',
    checkins: [],
    intentos: [],
    mensajesGladiador: [],
    ...extra,
  };
}

Deno.test('checkin: sin historial y a su hora, se permite', () => {
  assertEquals(checkinPermitido(entrada()), { ok: true, motivo: 'ok' });
});

Deno.test('checkin: hora del checkin (18:00 si cabe; si no, centro de la ventana)', () => {
  assertEquals(horaDelCheckin('08:00', '23:00'), 18);
  assertEquals(horaDelCheckin(null, null), 18); // 8–22 por defecto
  assertEquals(horaDelCheckin('05:00', '15:00'), 10); // 18 cae fuera
  assertEquals(horaDelCheckin('17:00', '02:00'), 20); // duerme pasada la medianoche: 17–24
  assertEquals(checkinPermitido(entrada({ ahora: { fecha: '2026-10-10', min: 12 * 60 } })).motivo, 'hora');
});

Deno.test('checkin: nunca en horas de sueño', () => {
  const r = checkinPermitido(entrada({ ahora: { fecha: '2026-10-10', min: 23 * 60 + 30 } }));
  assertEquals(r, { ok: false, motivo: 'sueno' });
  assertEquals(checkinPermitido(entrada({ ahora: { fecha: '2026-10-10', min: 6 * 60 } })).motivo, 'sueno');
});

Deno.test('checkin: como mucho 1 al día (también un intento fallido)', () => {
  assertEquals(checkinPermitido(entrada({ checkins: [h(1)], intentos: [h(1)] })).motivo, 'tope_dia');
  assertEquals(checkinPermitido(entrada({ intentos: [h(1)] })).motivo, 'tope_dia');
  // Ayer (fecha local distinta) no cuenta para el día.
  assertEquals(checkinPermitido(entrada({ checkins: [d(1)], intentos: [d(1)], mensajesGladiador: [h(10)] })).ok, true);
});

Deno.test('checkin: como mucho 3 en 7 días', () => {
  const tres = [d(1), d(3), d(5)];
  // Con respuestas entre medias, para que no salte el retiro.
  const mensajes = [h(30), h(70), h(100)];
  assertEquals(checkinPermitido(entrada({ checkins: tres, intentos: tres, mensajesGladiador: mensajes })).motivo, 'tope_semana');
  const viejos = [d(1), d(3), d(8)];
  assertEquals(checkinPermitido(entrada({ checkins: viejos, intentos: viejos, mensajesGladiador: mensajes })).ok, true);
});

Deno.test('checkin: nunca si escribió en las últimas 6 h', () => {
  assertEquals(checkinPermitido(entrada({ mensajesGladiador: [h(5.9)] })).motivo, 'escribio');
  assertEquals(checkinPermitido(entrada({ mensajesGladiador: [h(6.1)] })).ok, true);
});

Deno.test('checkin: se retira tras 2 seguidos sin respuesta y vuelve cuando escribe', () => {
  const dos = [d(4), d(2)];
  assertEquals(retirado(dos, []), true);
  assertEquals(checkinPermitido(entrada({ checkins: dos, intentos: dos })).motivo, 'retirado');
  // Contestó al primero (antes del segundo): solo uno ignorado.
  assertEquals(retirado(dos, [d(3)]), false);
  // Escribió después del segundo: vuelve.
  assertEquals(retirado(dos, [d(1)]), false);
  assertEquals(checkinPermitido(entrada({ checkins: dos, intentos: dos, mensajesGladiador: [d(1)] })).ok, true);
  // Uno solo ignorado no retira.
  assertEquals(retirado([d(2)], []), false);
  // Lo que importa son los DOS últimos.
  assertEquals(retirado([d(6), d(4), d(2)], [d(5)]), true);
});

Deno.test('checkin: desde cuándo leer mensajes (6 h o el penúltimo checkin)', () => {
  assertEquals(desdeParaMensajes([], AHORA_MS), h(6));
  assertEquals(desdeParaMensajes([d(1)], AHORA_MS), h(6));
  assertEquals(desdeParaMensajes([d(2), d(4)], AHORA_MS), d(4));
});

Deno.test('checkin: solo cuenta lo que escribió él', () => {
  assertEquals(esMensajeDelGladiador('text', 'Hoy no he podido ir'), true);
  assertEquals(esMensajeDelGladiador('text', '[te envía 1 foto(s)]\nmira'), true);
  assertEquals(esMensajeDelGladiador('tool_result', 'ok'), false);
  assertEquals(esMensajeDelGladiador('text', 'Es 2026-10-10. Dicta el brief de hoy y escribe el plan.'), false);
  assertEquals(esMensajeDelGladiador('text', 'Es 2026-10-10. Escribe el plan del dia completo.'), false);
  assertEquals(esMensajeDelGladiador('text', 'Cierra el mes.'), false);
  assertEquals(esMensajeDelGladiador('text', 'Haz la revisión de la semana.'), false);
  assertEquals(esMensajeDelGladiador('text', 'Lleva cuatro días en silencio.'), false);
  assertEquals(esMensajeDelGladiador('text', '[ritual: brief]'), false);
  assertEquals(esMensajeDelGladiador('text', '   '), false);
  assertEquals(esMensajeDelGladiador(undefined, undefined), false);
});

Deno.test('checkin: push del día por fecha local y solo rituales sin error', () => {
  const runs = [
    { kind: 'brief', created_at: '2026-10-10T06:00:00Z' }, // 08:00 Madrid, hoy
    { kind: 'titular', created_at: '2026-10-10T06:01:00Z' }, // no es un push propio
    { kind: 'escalada', created_at: '2026-10-10T09:00:00Z', error: 'turn_failed' },
    { kind: 'brief', created_at: '2026-10-09T21:30:00Z' }, // 23:30 del día 9 en Madrid
    { kind: 'checkin', created_at: '2026-10-09T22:30:00Z' }, // 00:30 del día 10 en Madrid
  ];
  assertEquals(pushesDeHoy(runs, '2026-10-10', TZ), 2);
  assertEquals(fechaLocal('2026-10-09T22:30:00Z', TZ), '2026-10-10');
  assertEquals(fechaLocal('no-es-fecha', TZ), null);
});

Deno.test('checkin: el texto queda en una línea, ≤280 y con pregunta', () => {
  assertEquals(limpiarCheckin('**Pierna** pendiente.\n¿A qué hora vas?'), 'Pierna pendiente. ¿A qué hora vas?');
  assertEquals(limpiarCheckin('"¿Vas a ir hoy?"'), '¿Vas a ir hoy?');
  assertEquals(limpiarCheckin('Sin pregunta ninguna.'), null);
  assertEquals(limpiarCheckin(''), null);
  const largo = `${'x'.repeat(200)} ¿Primera? ${'y'.repeat(200)} ¿Segunda?`;
  const r = limpiarCheckin(largo)!;
  assertEquals(r.endsWith('¿Primera?'), true);
  assertEquals(r.length <= MAX_CARACTERES_CHECKIN, true);
  assertEquals(limpiarCheckin(`${'z'.repeat(300)}?`), null);
});
