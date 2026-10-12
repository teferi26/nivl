import React from 'react';
import { HoldToSign } from '../../components/HoldToSign';
const mockVibrate = jest.fn();
const mockListeners = new Set<(state: string) => void>();
const mockAnimations: { config: { toValue: number; duration: number }; complete?: (mockResult: { finished: boolean }) => void; stop: jest.Mock }[] = [];
jest.mock('@/design/haptics', () => ({ vibrar: (...args: unknown[]) => mockVibrate(...args) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle' }));
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  AppState: { currentState: 'active', addEventListener: (_event: string, listener: (state: string) => void) => {
    mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
  } },
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  Easing: { linear: (v: number) => v },
  Animated: {
    Value: class { setValue = jest.fn(); stopAnimation = jest.fn(); interpolate() { return 0; } },
    View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component,
    timing: (_value: unknown, config: { toValue: number; duration: number }) => {
      const animation = { config, complete: undefined as ((mockResult: { finished: boolean }) => void) | undefined, stop: jest.fn(),
        start(callback?: (mockResult: { finished: boolean }) => void) { animation.complete = callback; } };
      mockAnimations.push(animation); return animation;
    },
  },
}));
interface RenderNode {
  type: unknown;
  parent: RenderNode | null;
  props: { children?: unknown; onPress?: () => void; onPressIn?: () => void; onPressOut?: () => void };
}
const { create, act } = jest.requireActual<{
  create: (element: React.ReactElement) => { unmount: () => void; update: (element: React.ReactElement) => void;
    root: { findAllByType: (type: string) => RenderNode[]; findByType: (type: string) => { props: { disabled: boolean; onPressIn: () => void; onPressOut: () => void; onPress: () => void; onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => void } } } };
  act: (fn: () => unknown) => Promise<void>;
}>('react-test-renderer');
const complete = jest.fn();
const focus = jest.fn();
const holding = jest.fn();
let rendered: ReturnType<typeof create> | null;
const tree = (props: Record<string, unknown> = {}) => React.createElement(HoldToSign, {
  label: 'Escribe tu nombre', onComplete: complete, onHoldChange: holding, onRequestInput: focus, ...props,
} as React.ComponentProps<typeof HoldToSign>);
const mount = async (props?: Record<string, unknown>) => { await act(async () => { rendered = create(tree(props)); }); };
const button = () => rendered!.root.findByType('Pressable').props;
const start = async () => { await act(async () => button().onPressIn()); };
const finishAnimation = async () => { await act(async () => mockAnimations.filter((a) => a.config.toValue === 1).at(-1)?.complete?.({ finished: true })); };
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); complete.mockReset(); mockAnimations.length = 0; mockListeners.clear(); rendered = null; });
afterEach(async () => { await act(async () => rendered?.unmount()); jest.useRealTimers(); });

test('pending signature responds to a touch by requesting input, never sealing', async () => {
  await mount({ disabled: true });
  expect(button().disabled).toBe(false);
  await start();
  await act(async () => button().onPress());
  expect(focus).toHaveBeenCalledTimes(1);
  expect(complete).not.toHaveBeenCalled();
  expect(mockAnimations.filter((a) => a.config.toValue === 1)).toHaveLength(0);
});

test('invalid accessible activation guides to input and never signs', async () => {
  await mount({ disabled: true });
  await act(async () => button().onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
  expect(focus).toHaveBeenCalledTimes(1);
  expect(complete).not.toHaveBeenCalled();
});

test('a valid full hold signs exactly once at the configured duration', async () => {
  await mount({ disabled: false }); await start();
  expect(mockAnimations.find((a) => a.config.toValue === 1)?.config.duration).toBe(1600);
  await finishAnimation(); await finishAnimation();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(holding).toHaveBeenLastCalledWith(false);
});

test.each(['invalid', 'background', 'unmount', 'release'])('%s cancels an ongoing hold and ignores even a late finished callback', async (reason) => {
  await mount({ disabled: false }); await start();
  const animation = mockAnimations.find((a) => a.config.toValue === 1)!;
  if (reason === 'invalid') await act(async () => rendered!.update(tree({ disabled: true })));
  if (reason === 'background') await act(async () => mockListeners.forEach((listener) => listener('background')));
  if (reason === 'release') await act(async () => button().onPressOut());
  if (reason === 'unmount') { await act(async () => rendered!.unmount()); rendered = null; }
  await act(async () => animation.complete?.({ finished: true }));
  expect(animation.stop).toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
  expect(holding).toHaveBeenLastCalledWith(false);
  const count = mockVibrate.mock.calls.length;
  await jest.advanceTimersByTimeAsync(3000);
  expect(mockVibrate).toHaveBeenCalledTimes(count);
});

test('busy blocks touch and accessibility until a retry becomes available', async () => {
  await mount({ disabled: false, loading: true });
  expect(button().disabled).toBe(true);
  await start();
  await act(async () => button().onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
  expect(complete).not.toHaveBeenCalled();
  await act(async () => rendered!.update(tree({ disabled: false, loading: false })));
  await start(); await finishAnimation();
  expect(complete).toHaveBeenCalledTimes(1);
});

/** Follow the rendered label to its enclosing native touch action. */
const actionForLabel = (label: string) => {
  const text = rendered!.root.findAllByType('Text').find((node) => node.props.children === label);
  expect(text).toBeDefined();
  let action = text?.parent ?? null;
  while (action && action.type !== 'Pressable') action = action.parent;
  expect(action?.type).toBe('Pressable');
  return action!;
};

test('touching the literal pending label focuses input rather than requiring a tap on the ring', async () => {
  await mount({ disabled: true });
  const action = actionForLabel('Escribe tu nombre');
  await act(async () => action.props.onPress?.());
  expect(focus).toHaveBeenCalledTimes(1);
  expect(complete).not.toHaveBeenCalled();
});

test('the valid label belongs to the same hold action and seals only after the full gesture', async () => {
  await mount({ disabled: false, label: 'Mantén pulsado para firmar' });
  const action = actionForLabel('Mantén pulsado para firmar');
  await act(async () => action.props.onPressIn?.());
  expect(complete).not.toHaveBeenCalled();
  await finishAnimation();
  expect(complete).toHaveBeenCalledTimes(1);
});

test('releasing a short gesture on the label cancels the signature without sealing', async () => {
  await mount({ disabled: false, label: 'Mantén pulsado para firmar' });
  const action = actionForLabel('Mantén pulsado para firmar');
  await act(async () => action.props.onPressIn?.());
  await act(async () => action.props.onPressOut?.());
  await finishAnimation();
  expect(complete).not.toHaveBeenCalled();
  expect(holding).toHaveBeenLastCalledWith(false);
});


test('a resolved signature callback permits another hold without relying on a loading render', async () => {
  complete.mockImplementation(() => Promise.resolve());
  await mount({ disabled: false });
  await start(); await finishAnimation();
  await start(); await finishAnimation();
  expect(complete).toHaveBeenCalledTimes(2);
});

test('pending callback blocks duplicates even if loading remains false, then permits retry', async () => {
  let settle!: () => void;
  complete.mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
  await mount({ disabled: false });
  await start(); await finishAnimation();
  await start();
  await act(async () => button().onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
  expect(complete).toHaveBeenCalledTimes(1);
  await act(async () => settle());
  await start(); await finishAnimation();
  expect(complete).toHaveBeenCalledTimes(2);
});

test('a rejected callback releases the action for retry without a loading transition', async () => {
  complete.mockRejectedValueOnce(new Error('network'));
  await mount({ disabled: false });
  await start(); await finishAnimation();
  await start(); await finishAnimation();
  expect(complete).toHaveBeenCalledTimes(2);
});


test('loading render changes cannot unlock a signature whose callback is still pending', async () => {
  let settle!: () => void;
  complete.mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
  await mount({ disabled: false });
  await start(); await finishAnimation();
  await act(async () => rendered!.update(tree({ disabled: false, loading: true })));
  await act(async () => rendered!.update(tree({ disabled: false, loading: false })));
  await act(async () => button().onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
  expect(complete).toHaveBeenCalledTimes(1);
  await act(async () => settle());
  await start(); await finishAnimation();
  expect(complete).toHaveBeenCalledTimes(2);
});

test('settling after unmount does not restart feedback or notify the parent again', async () => {
  let settle!: () => void;
  complete.mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
  await mount({ disabled: false });
  await start(); await finishAnimation();
  await act(async () => rendered!.unmount()); rendered = null;
  const changes = holding.mock.calls.length;
  const vibrations = mockVibrate.mock.calls.length;
  await act(async () => settle());
  await jest.advanceTimersByTimeAsync(3000);
  expect(holding).toHaveBeenCalledTimes(changes);
  expect(mockVibrate).toHaveBeenCalledTimes(vibrations);
  expect(mockListeners.size).toBe(0);
});
