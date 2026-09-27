import { completionStats, fetchCompletionsForDate, fetchCompletionsSince } from '../data';
import { computeDayClose } from '../closing';
import { fetchFechasPorHabito } from '../habitdata';
import type { Quest } from '../types';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
const safeCompletion = { id: 'c', user_id: 'owner', quest_id: 'q', date: '2026-06-08', completed_at: '', xp_awarded: 25, evidence_url: null };
beforeEach(() => mockRpc.mockReset().mockResolvedValue({ data: [safeCompletion], error: null }));

test('la foto queda oculta pero el hecho conserva racha, piedra y XP del cierre', async () => {
  const completions = await fetchCompletionsSince('2026-06-08');
  expect(mockRpc).toHaveBeenCalledWith('my_completions', { p_from: '2026-06-08' });
  const quest: Quest = { id: 'q', user_id: 'owner', title: 'Leer', stat: 'INT', difficulty: 'facil', days_of_week: [1], requires_evidence: false,
    active: true, is_penalty: false, penalty_date: null, penalty_xp: null, is_bonus: false, acquired_at: null, acquired_streak: null, created_at: '2026-06-01' };
  const close = computeDayClose({ fromDate: '2026-06-08', today: '2026-06-09', quests: [quest],
    completedKeys: new Set(completions.map(c => `${c.date}|${c.quest_id}`)), streak: 3, stones: 1, freezeUntil: null });
  expect(close).toMatchObject({ penaltyXp: 0, streakLost: false, stonesUsed: 0, streak: 4 });
  expect(completions[0].evidence_url).toBeNull();
});

test('Hoy y calendario de hábitos utilizan la misma proyección segura', async () => {
  expect(await fetchCompletionsForDate('2026-06-08')).toEqual([safeCompletion]);
  expect(mockRpc).toHaveBeenCalledWith('my_completions', { p_from: '2026-06-08', p_until: '2026-06-08' });
  expect((await fetchFechasPorHabito()).get('q')?.has('2026-06-08')).toBe(true);
});

test('un fallo o respuesta incompleta nunca se convierte en una lista vacía que castigue al usuario', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(fetchCompletionsSince('2026-06-08')).rejects.toThrow('offline');
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(fetchCompletionsForDate('2026-06-08')).rejects.toThrow();
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(completionStats()).rejects.toThrow();
  mockRpc.mockResolvedValueOnce({ data: { total: 4, with_evidence: 2 }, error: null });
  await expect(completionStats()).resolves.toEqual({ total: 4, withEvidence: 2 });
});
