// Mood-scoped adjective substitution. Post-pass. Source: docs/spec/design.md §6.4.

import { Mood } from '@/engine/core/Types';

export type AdjectiveDict = Readonly<Record<string, Readonly<Partial<Record<Mood, string>>>>>;

export const DEFAULT_ADJECTIVE_DICT: AdjectiveDict = {
  warm:    { melancholy: 'lonely', rage: 'stifling', serenity: 'gentle', paranoia: 'feverish' },
  quiet:   { melancholy: 'hollow', rage: 'sullen', serenity: 'still',    paranoia: 'watchful' },
  bright:  { melancholy: 'pale',   rage: 'glaring', serenity: 'clear' },
  soft:    { melancholy: 'faded',  rage: 'slack',   serenity: 'tender',  paranoia: 'slippery' },
  heavy:   { melancholy: 'slow',   rage: 'bludgeoning', serenity: 'settled', resolve: 'anchored' },
  cold:    { melancholy: 'bitter', rage: 'ironbound',   serenity: 'crisp',   paranoia: 'wary' },
  old:     { melancholy: 'weary',  rage: 'decrepit',    serenity: 'patient', resolve: 'seasoned' },
  dark:    { melancholy: 'smothered', rage: 'brooding', serenity: 'shaded',  paranoia: 'hidden' },
  deep:    { melancholy: 'fathomless', rage: 'barrel-deep', serenity: 'still', resolve: 'rooted' },
  sharp:   { melancholy: 'clean',  rage: 'cutting',  serenity: 'edged',   resolve: 'clear' },
  slow:    { melancholy: 'drawn',  rage: 'sluggish', serenity: 'measured' },
  small:   { melancholy: 'frail',  rage: 'brittle',  serenity: 'fine',    resolve: 'quiet' },
  tall:    { melancholy: 'looming',rage: 'imposing', serenity: 'upright' },
  empty:   { melancholy: 'abandoned', rage: 'scoured', serenity: 'open',  paranoia: 'exposed' },
  fresh:   { melancholy: 'strange', rage: 'raw',     serenity: 'new',     resolve: 'ready' },
  thin:    { melancholy: 'threadbare', rage: 'stretched', serenity: 'fine', paranoia: 'tenuous' },
  hot:     { melancholy: 'aching', rage: 'boiling',  serenity: 'warmth',  paranoia: 'feverish' },
  loud:    { melancholy: 'clamouring', rage: 'savage', serenity: 'steady', paranoia: 'distracting' },
  gentle:  { melancholy: 'muted',  rage: 'tame',     serenity: 'gentle',  resolve: 'patient' },
  still:   { melancholy: 'motionless', rage: 'suspended', serenity: 'calm' },
};

function preserveCase(replacement: string, original: string): string {
  if (original.length === 0) return replacement;
  const firstOrig = original[0]!;
  if (firstOrig === firstOrig.toUpperCase() && firstOrig !== firstOrig.toLowerCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function substituteAdjectives(text: string, mood: Mood, dict: AdjectiveDict): string {
  let out = text;
  for (const [key, moodMap] of Object.entries(dict)) {
    const replacement = moodMap[mood];
    if (replacement === undefined) continue;
    const re = new RegExp(`\\b${key}\\b`, 'gi');
    out = out.replace(re, (matched) => preserveCase(replacement, matched));
  }
  return out;
}
