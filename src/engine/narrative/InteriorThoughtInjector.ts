// Reflective-sentence injector. Source: docs/spec/design.md §6.4 + §6.6.

import { createRng } from '@/engine/core/RNG';
import { Mood } from '@/engine/core/Types';
import { SnippetLibrary, pickSnippet } from './SnippetLibrary';

export const BASE_INJECT_RATE = 0.3;
export const MIND_SCALE_DENOMINATOR = 50;
export const MAX_INJECT_RATE = 0.6;

const MOOD_LYRICAL_BIAS: Record<Mood, number> = {
  sorrow: 1.1,
  rage: 0.6,
  serenity: 1.0,
  paranoia: 0.7,
  resolve: 0.9,
  melancholy: 1.2,
};

export function reflectionSnippetKey(mood: Mood, realm: string): string {
  return `reflection.${mood}.${realm}`;
}

function derivedSeed(runSeed: number, turnIndex: number): number {
  let h = (runSeed ^ 0xdeadbeef) >>> 0;
  h = Math.imul(h ^ (turnIndex + 0x7f4a7c15), 0x9e3779b1);
  h = (h ^ (h >>> 16)) >>> 0;
  return h || 1;
}

export interface InjectArgs {
  text: string;
  mood: Mood;
  realm: string;
  mindStat: number;
  runSeed: number;
  turnIndex: number;
  library: SnippetLibrary;
}

export function maybeInjectInteriorThought(args: InjectArgs): string {
  const { text, mood, realm, mindStat, runSeed, turnIndex, library } = args;

  const bias = MOOD_LYRICAL_BIAS[mood] ?? 1.0;
  const rate = Math.max(
    0,
    Math.min(MAX_INJECT_RATE, BASE_INJECT_RATE * (mindStat / MIND_SCALE_DENOMINATOR) * bias),
  );
  if (rate <= 0) return text;

  const rng = createRng(derivedSeed(runSeed, turnIndex));
  // IRng.next() returns [0, 1) — use directly instead of intRange workaround
  const roll = rng.next();
  if (roll >= rate) return text;

  const primaryKey = reflectionSnippetKey(mood, realm);
  const fallbackKey = reflectionSnippetKey(mood, 'mortal');
  const primary = pickSnippet(library, primaryKey, [], rng);
  if (primary !== null) return `${text} ${primary}`;
  const fallback = pickSnippet(library, fallbackKey, [], rng);
  if (fallback !== null) return `${text} ${fallback}`;
  return text;
}
