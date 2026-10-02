import { olvidarFirma, removeAvatar, signedUrlCached, uploadAvatar } from '../data';
import { supabase } from '../supabase';

jest.mock('../health', () => ({ requireHealthConsent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

const upload = jest.fn();
const remove = jest.fn();
const sign = jest.fn();
const user = '10000000-0000-4000-8000-000000000001';
const path = `${user}/approved.jpg`;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-09-29T09:00:00Z'));
  olvidarFirma('avatars', path);
  jest.mocked(supabase.storage.from).mockReturnValue({ upload, remove, createSignedUrl: sign } as never);
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  sign.mockResolvedValue({ data: { signedUrl: 'https://example.invalid/approved' }, error: null });
});
afterEach(() => jest.useRealTimers());

test('replacing an avatar cannot change bytes at the approved object path', async () => {
  const first = await uploadAvatar(user, 'aGVsbG8=');
  jest.advanceTimersByTime(1);
  const second = await uploadAvatar(user, 'aGVsbG8=');
  expect(first).not.toBe(second);
  expect(first.startsWith(`${user}/avatar-`)).toBe(true);
  expect(second.startsWith(`${user}/avatar-`)).toBe(true);
  for (const call of upload.mock.calls) expect(call[2].upsert).toBe(false);
});

test('expired avatar permission is rechecked instead of serving a week-old cached URL', async () => {
  expect(await signedUrlCached('avatars', path)).toBe('https://example.invalid/approved');
  expect(await signedUrlCached('avatars', path)).toBe('https://example.invalid/approved');
  expect(sign).toHaveBeenCalledTimes(1);
  expect(sign).toHaveBeenCalledWith(path, 60);
  jest.advanceTimersByTime(50_001);
  sign.mockResolvedValueOnce({ data: null, error: new Error('blocked') });
  expect(await signedUrlCached('avatars', path)).toBeNull();
  expect(sign).toHaveBeenCalledTimes(2);
});

test('retiring an old image uses Storage and invalidates its cached signature', async () => {
  await signedUrlCached('avatars', path);
  await removeAvatar(user, path);
  expect(remove).toHaveBeenCalledWith([path]);
  await signedUrlCached('avatars', path);
  expect(sign).toHaveBeenCalledTimes(2);
});

test('a cleanup request cannot target another user or traverse directories', async () => {
  await expect(removeAvatar(user, 'someone-else/avatar.jpg')).rejects.toThrow();
  await expect(removeAvatar(user, `${user}/../someone-else/avatar.jpg`)).rejects.toThrow();
  expect(remove).not.toHaveBeenCalled();
});
