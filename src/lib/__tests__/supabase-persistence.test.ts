const mockCreateClient = jest.fn((...args: unknown[]) => {
  void args;
  return { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } };
});
const mockAddEventListener = jest.fn();
let mockOS = 'ios';
jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }));
jest.mock('react-native', () => ({ AppState: { addEventListener: (...args: unknown[]) => mockAddEventListener(...args) }, Platform: { get OS() { return mockOS; } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('react-native-url-polyfill/auto', () => ({}));
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalURL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_KEY = 'public-test-key';
  Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true });
});
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalURL === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = originalURL;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_KEY = originalKey;
});

test.each(['ios', 'android'])('native %s persists and refreshes auth even without window', (platform) => {
  mockOS = platform;
  jest.isolateModules(() => { jest.requireActual('../supabase'); });
  expect(mockCreateClient).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({
    auth: expect.objectContaining({ storage: expect.any(Object), persistSession: true, autoRefreshToken: true }),
  }));
  expect(mockAddEventListener).toHaveBeenCalledTimes(1);
});

test('web server rendering does not touch device storage or lifecycle', () => {
  mockOS = 'web';
  jest.isolateModules(() => { jest.requireActual('../supabase'); });
  const options = mockCreateClient.mock.calls[0][2] as { auth: Record<string, unknown> };
  expect(options.auth.persistSession).toBe(false);
  expect(options.auth.autoRefreshToken).toBe(false);
  expect(options.auth.storage).toBeUndefined();
  expect(mockAddEventListener).not.toHaveBeenCalled();
});