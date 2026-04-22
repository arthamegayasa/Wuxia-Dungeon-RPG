// Envelope-wrapped localStorage persistence with atomic swap.
// See docs/spec/design.md §10.

export interface SaveEnvelope<T> {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  gameVersion: string;
  data: T;
}

export interface SaveManager {
  load<T>(key: string): SaveEnvelope<T> | null;
  save<T>(key: string, data: T, schemaVersion: number): void;
  clear(key: string): void;
}

export interface SaveManagerOptions {
  /** Accessor so jsdom's localStorage can be injected and swapped for IDB later. */
  storage: () => Storage;
  gameVersion: string;
  now?: () => string;
}

const TMP_SUFFIX = '.__tmp__';

export function createSaveManager(opts: SaveManagerOptions): SaveManager {
  const now = opts.now ?? (() => new Date().toISOString());

  function readEnvelope<T>(key: string): SaveEnvelope<T> | null {
    const raw = opts.storage().getItem(key);
    if (raw == null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`corrupt save at "${key}": JSON parse failed`);
    }
    if (!isEnvelope<T>(parsed)) {
      throw new Error(`invalid envelope at "${key}": missing required fields`);
    }
    return parsed;
  }

  function load<T>(key: string): SaveEnvelope<T> | null {
    // Crash recovery: if a tmp exists with no main, promote tmp.
    const tmpKey = key + TMP_SUFFIX;
    const tmp = opts.storage().getItem(tmpKey);
    const main = opts.storage().getItem(key);
    if (tmp != null && main == null) {
      opts.storage().setItem(key, tmp);
      opts.storage().removeItem(tmpKey);
    } else if (tmp != null && main != null) {
      // Both present → discard tmp (previous save succeeded after tmp written).
      opts.storage().removeItem(tmpKey);
    }
    return readEnvelope<T>(key);
  }

  function save<T>(key: string, data: T, schemaVersion: number): void {
    const existing = readEnvelope<T>(key);
    const envelope: SaveEnvelope<T> = {
      schemaVersion,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
      gameVersion: opts.gameVersion,
      data,
    };
    const serialised = JSON.stringify(envelope);
    const tmpKey = key + TMP_SUFFIX;
    // Atomic-ish swap: write tmp, overwrite main, clear tmp.
    // If we crash mid-write, load() recovers.
    opts.storage().setItem(tmpKey, serialised);
    opts.storage().setItem(key, serialised);
    opts.storage().removeItem(tmpKey);
  }

  function clear(key: string): void {
    opts.storage().removeItem(key);
    opts.storage().removeItem(key + TMP_SUFFIX);
  }

  return { load, save, clear };
}

function isEnvelope<T>(v: unknown): v is SaveEnvelope<T> {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.schemaVersion === 'number'
    && typeof o.createdAt === 'string'
    && typeof o.updatedAt === 'string'
    && typeof o.gameVersion === 'string'
    && 'data' in o
  );
}
