// Chat 3 · (b) Exportación: rama web (Blob + <a download>) sin tocar la nativa.
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { exportAllData } from '../exporter';
import { supabase } from '../supabase';

const mockWrite = jest.fn();
const mockDelete = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache://' },
  File: jest.fn().mockImplementation(() => ({ uri: 'file://dump.json', write: mockWrite, delete: mockDelete })),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));

const TABLES = ['profiles', 'quests', 'completions', 'events', 'dungeons', 'dungeon_tasks', 'calendar_events', 'gym_days',
  'gym_exercises', 'gym_sessions', 'gym_lifts', 'meal_slots', 'shopping_items', 'journal_entries', 'achievements', 'rules',
  'rule_breaks', 'bonus_redemptions', 'journal_photos', 'letters', 'body_metrics', 'goals', 'coach_dossier', 'coach_facts',
  'coach_threads', 'coach_messages', 'day_plans', 'day_blocks', 'cardio_sessions', 'nutrition_targets', 'nutrition_logs',
  'training_prescriptions', 'money_accounts', 'transactions', 'category_rules', 'budgets', 'money_plan', 'quest_photos',
  'recaps', 'rule_checks', 'body_profile', 'health_consents', 'health_state', 'health_erasure_jobs', 'ai_consents'];
const dump = Object.fromEntries(TABLES.map(t => [t, t === 'profiles' ? [{ id: 'u1', name: 'Gladiador' }] : []]));
const rpc = jest.mocked(supabase.rpc);
const originalOS = Platform.OS;

function fakeDom() {
  const anchor = { href: '', download: '', rel: '', style: {} as Record<string, string>, click: jest.fn(), remove: jest.fn() };
  const blobs: { parts: unknown[]; type: string }[] = [];
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, Blob: g.Blob, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  g.document = { createElement: jest.fn(() => anchor), body: { appendChild: jest.fn() } };
  g.Blob = class { constructor(parts: unknown[], opts: { type: string }) { blobs.push({ parts, type: opts.type }); } };
  URL.createObjectURL = jest.fn(() => 'blob:nivl/1');
  URL.revokeObjectURL = jest.fn();
  const restore = () => {
    g.document = saved.document; g.Blob = saved.Blob;
    URL.createObjectURL = saved.create; URL.revokeObjectURL = saved.revoke;
  };
  return { anchor, blobs, restore };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  rpc.mockResolvedValue({ data: dump, error: null } as never);
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  jest.useRealTimers();
});

test('web: descarga un Blob JSON con <a download>, revoca la URL y no usa expo-file-system', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  const dom = fakeDom();
  try {
    await exportAllData();
    expect(rpc).toHaveBeenCalledWith('export_my_data');
    expect(dom.blobs).toHaveLength(1);
    expect(dom.blobs[0].type).toBe('application/json');
    expect(JSON.parse(String(dom.blobs[0].parts[0]))).toEqual(dump);
    expect(dom.anchor.href).toBe('blob:nivl/1');
    expect(dom.anchor.download).toMatch(/^nivl-export-\d+\.json$/);
    expect(dom.anchor.click).toHaveBeenCalledTimes(1);
    expect(dom.anchor.remove).toHaveBeenCalledTimes(1);
    jest.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:nivl/1');
    expect(mockWrite).not.toHaveBeenCalled();
  } finally {
    dom.restore();
  }
});

test('web: si el clic falla, la URL se revoca igualmente y el error llega a la pantalla', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  const dom = fakeDom();
  dom.anchor.click.mockImplementation(() => { throw new Error('bloqueado'); });
  try {
    await expect(exportAllData()).rejects.toThrow('bloqueado');
    expect(dom.anchor.remove).toHaveBeenCalled();
    jest.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:nivl/1');
  } finally {
    dom.restore();
  }
});

test('web sin DOM: error claro, nada se descarga', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  const g = globalThis as Record<string, unknown>;
  const saved = g.document;
  delete g.document;
  try {
    await expect(exportAllData()).rejects.toThrow('La descarga no está disponible');
  } finally {
    g.document = saved;
  }
});

test('exportación incompleta del servidor se rechaza antes de crear ningún archivo', async () => {
  rpc.mockResolvedValueOnce({ data: { profiles: [] }, error: null } as never);
  await expect(exportAllData()).rejects.toThrow('La exportación está incompleta.');
  expect(mockWrite).not.toHaveBeenCalled();
});

test('nativo: la ruta de siempre (archivo en caché, compartir y borrar) no cambia', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  await exportAllData();
  expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledTimes(1);
});
