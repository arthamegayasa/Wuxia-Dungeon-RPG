// FNV-1a 32-bit hash. Used for seed derivation only — not cryptographic.
// See spec §6.10.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime mod 2^32
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Derive a 32-bit seed from a base seed plus ordered parts.
 * Parts are stringified and concatenated with NUL separators (NUL cannot appear
 * in a normal identifier so collisions across distinct part sequences are rare).
 */
export function hashSeed(baseSeed: number, ...parts: Array<string | number>): number {
  const joined = parts.map((p) => String(p)).join('\u0000');
  const h = fnv1a32(joined);
  // Mix with base seed using xor + FNV prime multiplication
  return (Math.imul(h ^ baseSeed, FNV_PRIME) >>> 0);
}
