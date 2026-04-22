import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './EventBus';

type Events = {
  turnComplete: { turnIndex: number };
  death: { cause: string };
};

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.on('turnComplete', spy);
    bus.emit('turnComplete', { turnIndex: 3 });
    expect(spy).toHaveBeenCalledWith({ turnIndex: 3 });
  });

  it('delivers to all subscribers of the same event', () => {
    const bus = createEventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('death', a);
    bus.on('death', b);
    bus.emit('death', { cause: 'old_age' });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('isolates events by key', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.on('turnComplete', spy);
    bus.emit('death', { cause: 'starvation' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('off removes a subscription', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    const off = bus.on('turnComplete', spy);
    off();
    bus.emit('turnComplete', { turnIndex: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('once delivers exactly one event', () => {
    const bus = createEventBus<Events>();
    const spy = vi.fn();
    bus.once('turnComplete', spy);
    bus.emit('turnComplete', { turnIndex: 1 });
    bus.emit('turnComplete', { turnIndex: 2 });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith({ turnIndex: 1 });
  });

  it('errors in one subscriber do not prevent others from firing', () => {
    const bus = createEventBus<Events>();
    const thrower = vi.fn(() => { throw new Error('boom'); });
    const ok = vi.fn();
    bus.on('death', thrower);
    bus.on('death', ok);
    expect(() => bus.emit('death', { cause: 'beast' })).not.toThrow();
    expect(ok).toHaveBeenCalledOnce();
  });
});
