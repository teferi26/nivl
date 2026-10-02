import { describe, expect, test } from '@jest/globals';
import { enJuegoHoy, fallosPermitidos } from '@/lib/closing';
import type { Quest } from '@/lib/types';
import { lineaEnJuego, type EnJuego } from '../hoy/enJuego';

const j = (p: Partial<EnJuego>): EnJuego => ({
  pendientes: 0,
  faltanParaSalvar: 0,
  rachaEnRiesgo: false,
  gastariaPiedra: false,
  xpEnJuego: 0,
  ...p,
});

function makeQuest(partial: Partial<Quest>): Quest {
  return {
    id: 'q1',
    user_id: 'u1',
    title: 'Test',
    stat: 'FUE',
    difficulty: 'media',
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    requires_evidence: false,
    active: true,
    is_penalty: false,
    penalty_date: null,
    penalty_xp: null,
    is_bonus: false,
    acquired_at: null,
    acquired_streak: null,
    created_at: '',
    ...partial,
  };
}

describe('lineaEnJuego', () => {
  test('todo hecho → null', () => {
    expect(lineaEnJuego(j({}), 5)).toBeNull();
  });

  test('racha en riesgo, singular', () => {
    expect(lineaEnJuego(j({ pendientes: 1, faltanParaSalvar: 1, rachaEnRiesgo: true, xpEnJuego: 25 }), 1)).toEqual({
      texto: 'Te falta 1 para salvar la racha de 1 día · dejarlo te costaría 25 XP',
      alerta: true,
    });
  });

  test('racha en riesgo, plural', () => {
    expect(lineaEnJuego(j({ pendientes: 3, faltanParaSalvar: 2, rachaEnRiesgo: true, xpEnJuego: 75 }), 12)).toEqual({
      texto: 'Te faltan 2 para salvar la racha de 12 días · dejarlo te costaría 75 XP',
      alerta: true,
    });
  });

  test('racha en riesgo sin XP en juego omite la cifra', () => {
    expect(lineaEnJuego(j({ pendientes: 2, faltanParaSalvar: 2, rachaEnRiesgo: true, xpEnJuego: 0 }), 4)?.texto).toBe(
      'Te faltan 2 para salvar la racha de 4 días',
    );
  });

  test('una piedra la protegería', () => {
    expect(lineaEnJuego(j({ pendientes: 2, faltanParaSalvar: 1, gastariaPiedra: true }), 9)).toEqual({
      texto: 'Si no llegas, una piedra protegerá tu racha esta noche',
      alerta: false,
    });
  });

  test('sin riesgo: pendiente(s) y coste', () => {
    expect(lineaEnJuego(j({ pendientes: 1, xpEnJuego: 25 }), 0)).toEqual({
      texto: '1 pendiente · dejarla te costaría 25 XP',
      alerta: false,
    });
    expect(lineaEnJuego(j({ pendientes: 3, xpEnJuego: 60 }), 0)?.texto).toBe('3 pendientes · dejarlas te costaría 60 XP');
  });

  test('sin riesgo y sin coste: solo lo pendiente', () => {
    expect(lineaEnJuego(j({ pendientes: 2, xpEnJuego: 0 }), 0)?.texto).toBe('2 pendientes');
    expect(lineaEnJuego(j({ pendientes: 1, xpEnJuego: 0 }), 0)?.texto).toBe('1 pendiente');
  });

  test('faltanParaSalvar 0 con rachaEnRiesgo no se trata como riesgo', () => {
    expect(lineaEnJuego(j({ pendientes: 1, rachaEnRiesgo: true, xpEnJuego: 10 }), 3)?.alerta).toBe(false);
  });
});

describe('lineaEnJuego con enJuegoHoy', () => {
  const quests = [makeQuest({ id: 'a' }), makeQuest({ id: 'b' })];

  test('con racha y sin piedras, nada hecho → alerta', () => {
    const r = enJuegoHoy({ questsHoy: quests, completadasHoy: new Set(), streak: 6, stones: 0 });
    expect(r.rachaEnRiesgo).toBe(true);
    const l = lineaEnJuego(r, 6);
    expect(l?.alerta).toBe(true);
    const n = 2 - fallosPermitidos(2);
    expect(l?.texto.startsWith(`Te ${n === 1 ? 'falta' : 'faltan'} ${n} para salvar la racha de 6 días`)).toBe(true);
  });

  test('con piedra → la piedra protege', () => {
    const r = enJuegoHoy({ questsHoy: quests, completadasHoy: new Set(), streak: 6, stones: 1 });
    expect(lineaEnJuego(r, 6)?.texto).toBe('Si no llegas, una piedra protegerá tu racha esta noche');
  });

  test('todo completado → null', () => {
    const r = enJuegoHoy({ questsHoy: quests, completadasHoy: new Set(['a', 'b']), streak: 6, stones: 0 });
    expect(lineaEnJuego(r, 6)).toBeNull();
  });
});
