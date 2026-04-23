// Composer orchestrator: renders an EventDef into prose.
// Source: docs/spec/design.md §6.1, §6.10.

import { Mood, Realm, Season } from '@/engine/core/Types';
import { IRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { SnippetLibrary } from './SnippetLibrary';
import { NameRegistry } from './NameRegistry';
import { expandTemplate } from './TemplateExpander';
import { maybeInjectInteriorThought } from './InteriorThoughtInjector';
import { substituteAdjectives, DEFAULT_ADJECTIVE_DICT } from './MoodAdjectiveDict';

export interface CompositionContext {
  characterName: string;
  region: string;
  season: Season;
  realm: Realm | string;          // Realm enum value (string literal underlying)
  dominantMood: Mood;
  turnIndex: number;
  runSeed: number;
  extraVariables: Readonly<Record<string, string>>;
  mindStat?: number;       // Phase 2A-1: drives interior-thought injection rate
}

/** Map mood → preferred snippet tag(s). Phase 1C uses a lean 1-to-1 mapping. */
const MOOD_TAG_PREFERENCES: Readonly<Record<Mood, ReadonlyArray<string>>> = {
  sorrow:     ['lyrical', 'tender'],
  rage:       ['terse', 'bitter'],
  serenity:   ['lyrical', 'tender'],
  paranoia:   ['terse', 'ominous'],
  resolve:    ['serious'],
  melancholy: ['lyrical', 'bitter'],
};

function buildVariables(ctx: CompositionContext): Record<string, string> {
  return {
    CHARACTER: ctx.characterName,
    REGION: ctx.region,
    SEASON: ctx.season,
    REALM: String(ctx.realm),
    ...ctx.extraVariables,
  };
}

function renderLine(
  line: string,
  ctx: CompositionContext,
  library: SnippetLibrary,
  _registry: NameRegistry,
  rng: IRng,
): string {
  const preferredTags = MOOD_TAG_PREFERENCES[ctx.dominantMood];
  return expandTemplate(line, {
    library,
    variables: buildVariables(ctx),
    preferredTags,
    rng,
  });
}

/** Pick one entry per non-empty section; concatenate with single spaces. */
export function renderEvent(
  event: EventDef,
  ctx: CompositionContext,
  library: SnippetLibrary,
  registry: NameRegistry,
  rng: IRng,
): string {
  const parts: string[] = [];

  for (const section of ['intro', 'body', 'outro'] as const) {
    const lines = event.text[section] ?? [];
    if (lines.length === 0) continue;
    const chosen = lines[rng.intRange(0, lines.length - 1)]!;
    const rendered = renderLine(chosen, ctx, library, registry, rng);
    if (rendered.length > 0) parts.push(rendered);
  }

  let rendered = parts.join(' ');

  // Phase 2A-1 post-pass 1: interior-thought injection.
  rendered = maybeInjectInteriorThought({
    text: rendered,
    mood: ctx.dominantMood,
    realm: String(ctx.realm),
    mindStat: ctx.mindStat ?? 0,
    runSeed: ctx.runSeed,
    turnIndex: ctx.turnIndex,
    library,
  });

  // Phase 2A-1 post-pass 2: mood-adjective substitution.
  rendered = substituteAdjectives(rendered, ctx.dominantMood, DEFAULT_ADJECTIVE_DICT);

  return rendered;
}
