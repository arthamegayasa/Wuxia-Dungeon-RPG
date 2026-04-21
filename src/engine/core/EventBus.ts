// Tiny synchronous typed pub/sub.
// Used inside the engine for cross-module notifications.
// Intentionally NOT exposed to React components — React talks to the engine
// through the engineBridge, not this bus.

export type EventMap = Record<string, unknown>;

export type Handler<P> = (payload: P) => void;

export interface EventBus<E extends EventMap> {
  on<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void;
  once<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void;
  off<K extends keyof E>(key: K, handler: Handler<E[K]>): void;
  emit<K extends keyof E>(key: K, payload: E[K]): void;
}

export function createEventBus<E extends EventMap>(): EventBus<E> {
  const handlers = new Map<keyof E, Set<Handler<unknown>>>();

  function on<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void {
    let set = handlers.get(key);
    if (!set) {
      set = new Set();
      handlers.set(key, set);
    }
    set.add(handler as Handler<unknown>);
    return () => off(key, handler);
  }

  function once<K extends keyof E>(key: K, handler: Handler<E[K]>): () => void {
    const wrapper: Handler<E[K]> = (p) => {
      off(key, wrapper);
      handler(p);
    };
    return on(key, wrapper);
  }

  function off<K extends keyof E>(key: K, handler: Handler<E[K]>): void {
    const set = handlers.get(key);
    if (!set) return;
    set.delete(handler as Handler<unknown>);
  }

  function emit<K extends keyof E>(key: K, payload: E[K]): void {
    const set = handlers.get(key);
    if (!set) return;
    // Clone so mutations during iteration don't break us.
    for (const h of [...set]) {
      try {
        (h as Handler<E[K]>)(payload);
      } catch (err) {
        // Swallow + report. One bad subscriber cannot break the emit loop.
        // eslint-disable-next-line no-console
        console.error(`[EventBus] handler error for "${String(key)}":`, err);
      }
    }
  }

  return { on, once, off, emit };
}
