import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '../auth';

const mockGetSession = jest.fn();
const mockUnsubscribe = jest.fn();
let mockCallback: (event: string, session: Session | null) => void;
jest.mock('../supabase', () => ({ supabase: { auth: {
  getSession: () => mockGetSession(),
  onAuthStateChange: (callback: typeof mockCallback) => {
    mockCallback = callback;
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
  },
} } }));
const { create, act } = jest.requireActual<{
  create: (element: React.ReactElement) => { unmount: () => void };
  act: (fn: () => unknown) => Promise<void>;
}>('react-test-renderer');
let observed: ReturnType<typeof useAuth>;
const Probe = () => { observed = useAuth(); return null; };
let rendered: ReturnType<typeof create> | null;
let resolveSession: (value: { data: { session: Session | null } }) => void;
let rejectSession: (reason: Error) => void;
const session = (id: string) => ({ user: { id } } as Session);
const mount = async () => {
  await act(async () => { rendered = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
};
beforeEach(() => {
  jest.clearAllMocks();
  rendered = null;
  mockGetSession.mockReturnValue(new Promise((resolve, reject) => { resolveSession = resolve; rejectSession = reject; }));
});
afterEach(async () => { await act(async () => rendered?.unmount()); });

test('the stored session initializes the account when no newer auth event exists', async () => {
  await mount();
  expect(observed!.loading).toBe(true);
  await act(async () => resolveSession({ data: { session: session('stored') } }));
  expect(observed!).toEqual({ session: session('stored'), loading: false });
});

test('a login received during bootstrap is never replaced by the old stored snapshot', async () => {
  await mount();
  await act(async () => mockCallback('SIGNED_IN', session('new')));
  expect(observed!.loading).toBe(false);
  await act(async () => resolveSession({ data: { session: session('old') } }));
  expect(observed!.session?.user.id).toBe('new');
});

test('a logout during bootstrap cannot restore the previous account', async () => {
  await mount();
  await act(async () => mockCallback('SIGNED_OUT', null));
  await act(async () => resolveSession({ data: { session: session('old') } }));
  expect(observed!).toEqual({ session: null, loading: false });
});

test('a failed bootstrap does not clear a session from a newer auth event', async () => {
  await mount();
  await act(async () => mockCallback('SIGNED_IN', session('new')));
  await act(async () => rejectSession(new Error('storage')));
  expect(observed!.session?.user.id).toBe('new');
});

test('a failed bootstrap without auth events resolves loading', async () => {
  await mount();
  await act(async () => rejectSession(new Error('storage')));
  expect(observed!).toEqual({ session: null, loading: false });
});

test('unmount unsubscribes and ignores both pending storage and late events', async () => {
  await mount();
  await act(async () => rendered!.unmount());
  rendered = null;
  const before = observed!;
  await act(async () => {
    mockCallback('SIGNED_IN', session('late'));
    resolveSession({ data: { session: session('stored') } });
  });
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  expect(observed!).toBe(before);
});