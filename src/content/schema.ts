import { z } from 'zod';

// ---- Phase 0 snippet stubs (unchanged) ----
export const SnippetEntrySchema = z.object({
  text: z.string().min(1),
  weight: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export const SnippetLibrarySchema = z.record(z.string(), z.array(SnippetEntrySchema));

// ---- Phase 1B event/choice/outcome schemas ----
// Source: docs/spec/design.md §9.

const REALM_STRINGS = [
  'mortal', 'body_tempering', 'qi_sensing', 'qi_condensation',
  'foundation', 'core', 'nascent_soul', 'soul_transformation',
  'void_refinement', 'immortal',
] as const;

const SEASON_STRINGS = ['spring', 'summer', 'autumn', 'winter'] as const;

const TIME_COST_STRINGS = ['INSTANT', 'SHORT', 'MEDIUM', 'LONG', 'EPOCH'] as const;

const STAT_STRINGS = ['Body', 'Mind', 'Spirit', 'Agility', 'Charm', 'Luck'] as const;

const DEATH_CAUSE_STRINGS = [
  'starvation', 'disease', 'old_age',
  'combat_melee', 'combat_qi', 'poison',
  'betrayal', 'tribulation', 'qi_deviation',
  'cripple_wasting', 'suicide_ritual', 'heavenly_intervention',
  'karmic_hunter', 'self_sacrifice', 'love_death', 'madness',
  'drowning', 'beast', 'demonic_corruption', 'childbirth',
] as const;

export const ConditionSetSchema = z.object({
  minAge: z.number().int().nonnegative().optional(),
  maxAge: z.number().int().nonnegative().optional(),
  regions: z.array(z.string()).optional(),
  locales: z.array(z.string()).optional(),
  realms: z.array(z.enum(REALM_STRINGS)).optional(),
  seasons: z.array(z.enum(SEASON_STRINGS)).optional(),
  worldFlags: z.object({
    require: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),
  characterFlags: z.object({
    require: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }).optional(),
  minStat: z.record(z.enum(STAT_STRINGS), z.number().optional()).optional(),
  maxStat: z.record(z.enum(STAT_STRINGS), z.number().optional()).optional(),
  minNotice: z.number().optional(),
  maxNotice: z.number().optional(),
  requiresEcho: z.array(z.string()).optional(),
  excludesEcho: z.array(z.string()).optional(),
  requiresMemory: z.array(z.string()).optional(),
  requiresItem: z.array(z.string()).optional(),
  era: z.object({
    minYear: z.number().int().optional(),
    maxYear: z.number().int().optional(),
  }).optional(),
  customPredicate: z.string().optional(),
});

const StateDeltaSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hp_delta'), amount: z.number() }),
  z.object({ kind: z.literal('qi_delta'), amount: z.number() }),
  z.object({ kind: z.literal('insight_delta'), amount: z.number() }),
  z.object({ kind: z.literal('attribute_delta'), stat: z.enum(STAT_STRINGS), amount: z.number() }),
  z.object({ kind: z.literal('flag_set'), flag: z.string() }),
  z.object({ kind: z.literal('flag_clear'), flag: z.string() }),
  z.object({ kind: z.literal('world_flag_set'), flag: z.string() }),
  z.object({ kind: z.literal('world_flag_clear'), flag: z.string() }),
  z.object({ kind: z.literal('cultivation_progress_delta'), amount: z.number() }),
  z.object({ kind: z.literal('item_add'), id: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('item_remove'), id: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('technique_learn'), id: z.string() }),
  z.object({ kind: z.literal('meridian_open'), id: z.number().int().min(1).max(12) }),
  z.object({ kind: z.literal('karma_delta'), amount: z.number() }),
  z.object({ kind: z.literal('notice_delta'), amount: z.number() }),
  z.object({ kind: z.literal('age_delta_days'), amount: z.number().int().nonnegative() }),
]);

export const OutcomeSchema = z.object({
  narrativeKey: z.union([z.string(), z.array(z.string())]),
  stateDeltas: z.array(StateDeltaSchema).optional(),
  eventQueue: z.array(z.object({
    id: z.string(),
    priority: z.number().int().optional(),
  })).optional(),
  unlocks: z.object({
    echoes: z.array(z.string()).optional(),
    memories: z.array(z.string()).optional(),
    anchors: z.array(z.string()).optional(),
    codex: z.array(z.string()).optional(),
  }).optional(),
  witnessMemory: z.string().optional(),
  noticeDelta: z.number().optional(),
  deathCause: z.enum(DEATH_CAUSE_STRINGS).optional(),
});

export const OutcomeTableSchema = z.object({
  CRIT_SUCCESS: OutcomeSchema.optional(),
  SUCCESS: OutcomeSchema,
  PARTIAL: OutcomeSchema.optional(),
  FAILURE: OutcomeSchema,
  CRIT_FAILURE: OutcomeSchema.optional(),
});

export const ChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  subtext: z.string().optional(),
  preconditions: ConditionSetSchema.optional(),
  cost: z.object({
    qi: z.number().nonnegative().optional(),
    insight: z.number().nonnegative().optional(),
    items: z.array(z.object({
      id: z.string(),
      count: z.number().int().positive(),
    })).optional(),
  }).optional(),
  check: z.object({
    stats: z.record(z.enum(STAT_STRINGS), z.number().optional()).optional(),
    skills: z.record(z.string(), z.number()).optional(),
    base: z.number().nonnegative(),
    difficulty: z.number(),
    techniqueBonusCategory: z.string().optional(),
  }).optional(),
  timeCost: z.enum(TIME_COST_STRINGS),
  outcomes: OutcomeTableSchema,
  flagDeltas: z.object({
    set: z.array(z.string()).optional(),
    clear: z.array(z.string()).optional(),
  }).optional(),
});

export const EventSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  version: z.number().int().positive(),
  weight: z.number().positive(),
  conditions: ConditionSetSchema,
  timeCost: z.enum(TIME_COST_STRINGS),
  text: z.object({
    intro: z.array(z.string()).optional(),
    body: z.array(z.string()).optional(),
    outro: z.array(z.string()).optional(),
  }),
  choices: z.array(ChoiceSchema).min(1),
  flags: z.object({
    set: z.array(z.string()).optional(),
    clear: z.array(z.string()).optional(),
  }).optional(),
  witnessMemory: z.string().optional(),
  repeat: z.enum(['once_per_life', 'once_ever', 'unlimited']),
});

// ---- Content pack (Phase 0 loader — now wraps the richer Event schema) ----

export const ContentPackSchema = z.object({
  version: z.number().int().positive(),
  snippets: SnippetLibrarySchema,
  events: z.array(EventSchema),
});

export type ContentPack = z.infer<typeof ContentPackSchema>;
export type SnippetEntry = z.infer<typeof SnippetEntrySchema>;
export type EventDef = z.infer<typeof EventSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type OutcomeTable = z.infer<typeof OutcomeTableSchema>;
export type ConditionSet = z.infer<typeof ConditionSetSchema>;
