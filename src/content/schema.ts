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
  z.object({
    kind: z.literal('meditation_progress'),
    /** Base progress amount before technique multiplier is applied. */
    base: z.number().nonnegative(),
    /** Optional flat insight bonus added on top of cultivation progress. */
    insightBonus: z.number().nonnegative().optional(),
  }),
  z.object({ kind: z.literal('item_add'), id: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('item_remove'), id: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('technique_learn'), id: z.string() }),
  z.object({ kind: z.literal('meridian_open'), id: z.number().int().min(1).max(12) }),
  z.object({ kind: z.literal('karma_delta'), amount: z.number() }),
  z.object({ kind: z.literal('notice_delta'), amount: z.number() }),
  z.object({ kind: z.literal('age_delta_days'), amount: z.number().int().nonnegative() }),
  // Phase 2B-2 Task 20: realm-gate events dispatch into RealmCrossing helpers.
  z.object({
    kind: z.literal('attempt_realm_crossing'),
    /** Which transition to attempt. */
    transition: z.enum(['bt9_to_qs', 'qs_to_qc1', 'qc_sublayer', 'qc9_to_foundation']),
  }),
  // Phase 2B-2 Task 21: region-transition events update runState.region.
  z.object({
    kind: z.literal('region_change'),
    regionId: z.string().min(1),
  }),
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
  /** If set, this choice is hidden unless the character has learned a technique
   *  whose `unlock_choice` effect declares the matching choiceId. */
  unlockedBy: z.string().optional(),
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
  /** Phase 2C: 'beat' = single-Continue narrative paragraph; 'decision' = forking choice.
   *  Optional for backward compatibility with all pre-2C events; consumers treat
   *  `undefined` as `'decision'`. */
  kind: z.enum(['beat', 'decision']).optional(),
}).refine(
  (e) => {
    if (e.kind !== 'beat') return true;
    return e.choices.length === 1
      && e.choices[0]!.id === 'continue'
      && e.choices[0]!.label === 'Continue';
  },
  { message: "beat events must have exactly one choice {id:'continue', label:'Continue'}" },
);

// ---- Phase 2A-2 Echo schema ----
// Source: docs/spec/design.md §7.2, §9.8.

const REALM_OR_STRING = z.union([z.enum(REALM_STRINGS), z.string()]);
const ATTR_STAT = z.enum(STAT_STRINGS);

const UnlockConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reach_realm'), realm: z.string(), sublayer: z.number().int().positive().optional() }),
  z.object({ kind: z.literal('choice_category_count'), category: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('outcome_count'), outcomeKind: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('lives_as_anchor_max_age'), anchor: z.string(), lives: z.number().int().positive() }),
  z.object({ kind: z.literal('died_with_flag'), flag: z.string() }),
  z.object({ kind: z.literal('flag_set'), flag: z.string() }),
  z.object({ kind: z.literal('died_in_same_region_streak'), region: z.string(), streak: z.number().int().positive() }),
  z.object({ kind: z.literal('reached_insight_cap_lives'), lives: z.number().int().positive() }),
  z.object({ kind: z.literal('lived_min_years_in_single_life'), years: z.number().int().positive() }),
  z.object({ kind: z.literal('reached_realm_without_techniques'), realm: z.string() }),
]);

const EchoEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stat_mod'), stat: ATTR_STAT, delta: z.number() }),
  z.object({ kind: z.literal('stat_mod_pct'), stat: ATTR_STAT, pct: z.number() }),
  z.object({ kind: z.literal('resolver_bonus'), category: z.string(), bonus: z.number() }),
  z.object({ kind: z.literal('event_weight'), eventTag: z.string(), mult: z.number().positive() }),
  z.object({ kind: z.literal('starting_flag'), flag: z.string() }),
  z.object({ kind: z.literal('heal_efficacy_pct'), pct: z.number() }),
  z.object({ kind: z.literal('hp_mult'), mult: z.number().positive() }),
  z.object({ kind: z.literal('mood_swing_pct'), pct: z.number() }),
  z.object({ kind: z.literal('body_cultivation_rate_pct'), pct: z.number() }),
  z.object({ kind: z.literal('insight_cap_bonus'), bonus: z.number() }),
  z.object({ kind: z.literal('old_age_death_roll_pct'), pct: z.number() }),
  z.object({ kind: z.literal('imprint_encounter_rate_pct'), pct: z.number() }),
]);

export const EchoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  tier: z.enum(['fragment', 'partial', 'full']),
  unlockCondition: UnlockConditionSchema,
  effects: z.array(EchoEffectSchema),
  conflicts: z.array(z.string()),
  reveal: z.enum(['birth', 'trigger']),
});

export const EchoPackSchema = z.object({
  version: z.number().int().positive(),
  echoes: z.array(EchoSchema),
});

// ---- Phase 2A-2 Memory schema ----
// Source: docs/spec/design.md §7.3, §9.9.

export const MemoryRequirementsSchema = z.object({
  minMeridians: z.number().int().positive().optional(),
  minRealm: REALM_OR_STRING.optional(),
});

export const MemorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  element: z.enum(['metal', 'wood', 'water', 'fire', 'earth', 'void']),
  witnessFlavour: z.object({
    fragment: z.string().min(1),
    partial: z.string().min(1),
    complete: z.string().min(1),
  }),
  manifestFlavour: z.string().min(1),
  manifestInsightBonus: z.number().int().nonnegative(),
  manifestFlag: z.string().min(1),
  requirements: MemoryRequirementsSchema,
});

export const MemoryPackSchema = z.object({
  version: z.number().int().positive(),
  memories: z.array(MemorySchema),
});

export type EchoDef = z.infer<typeof EchoSchema>;
export type EchoPack = z.infer<typeof EchoPackSchema>;
export type MemoryDef = z.infer<typeof MemorySchema>;
export type MemoryPack = z.infer<typeof MemoryPackSchema>;

// ---- Phase 2B-1 Technique schema ----
// Source: docs/spec/design.md §9.5.

const TECHNIQUE_GRADES = ['mortal', 'yellow', 'profound', 'earth', 'heaven', 'immortal'] as const;
const ELEMENTS_WITH_NONE = ['metal', 'wood', 'water', 'fire', 'earth', 'none'] as const;
const MOOD_STRINGS = ['sorrow', 'rage', 'serenity', 'paranoia', 'resolve', 'melancholy'] as const;

const CORE_AFFINITY_TOKEN = z.union([
  z.enum([
    'iron_mountain', 'severing_edge', 'still_water', 'howling_storm',
    'blood_ember', 'root_and_bough', 'thousand_mirrors', 'hollow_vessel',
    'shattered_path',
  ]),
  z.literal('any'),
]);

const TechniqueEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choice_bonus'), category: z.string().min(1), bonus: z.number() }),
  z.object({ kind: z.literal('qi_regen'), amount: z.number() }),
  z.object({ kind: z.literal('insight_gain_per_meditation'), amount: z.number() }),
  z.object({ kind: z.literal('mood_modifier'), mood: z.enum(MOOD_STRINGS), delta: z.number() }),
  z.object({ kind: z.literal('unlock_choice'), choiceId: z.string().min(1) }),
  z.object({ kind: z.literal('cultivation_multiplier_pct'), pct: z.number() }),
]);

const TechniqueRankEffectsSchema = z.object({
  novice: z.array(TechniqueEffectSchema),
  adept: z.array(TechniqueEffectSchema),
  master: z.array(TechniqueEffectSchema),
});

export const TechniqueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  grade: z.enum(TECHNIQUE_GRADES),
  element: z.enum(ELEMENTS_WITH_NONE),
  coreAffinity: z.array(CORE_AFFINITY_TOKEN).min(1),
  requires: z.object({
    realm: z.enum(REALM_STRINGS).optional(),
    meridians: z.array(z.number().int().min(1).max(12)).optional(),
    openMeridianCount: z.number().int().nonnegative().optional(),
  }),
  qiCost: z.number().nonnegative(),
  insightCost: z.number().nonnegative().optional(),
  effects: z.array(TechniqueEffectSchema),
  description: z.string(),
  rankPath: TechniqueRankEffectsSchema.optional(),
});

export const TechniquePackSchema = z.object({
  version: z.number().int().positive(),
  techniques: z.array(TechniqueSchema),
});

export type TechniqueRawDef = z.infer<typeof TechniqueSchema>;
export type TechniquePack = z.infer<typeof TechniquePackSchema>;

// ---- Phase 2B-1 Item / Manual schemas ----
// Source: docs/spec/design.md §9.6, §9.7.

const ITEM_TYPES = ['pill', 'manual', 'weapon', 'armor', 'talisman', 'misc'] as const;
const ITEM_GRADES = TECHNIQUE_GRADES;   // shared 6-tier ladder

const ItemEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('heal_hp'), amount: z.number() }),
  z.object({ kind: z.literal('restore_qi'), amount: z.number() }),
  z.object({ kind: z.literal('pill_bonus'), amount: z.number() }),
  z.object({ kind: z.literal('insight_gain'), amount: z.number() }),
  z.object({ kind: z.literal('deviation_risk'), delta: z.number() }),
  z.object({ kind: z.literal('choice_bonus'), category: z.string().min(1), bonus: z.number() }),
]);

export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(ITEM_TYPES),
  grade: z.enum(ITEM_GRADES),
  stackable: z.boolean(),
  effects: z.array(ItemEffectSchema),
  description: z.string(),
  weight: z.number().nonnegative().optional(),
  // Manual-only fields:
  teaches: z.string().optional(),
  completeness: z.union([z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1.0)]).optional(),
  readerRequires: z.object({
    minMind: z.number().nonnegative().optional(),
    minInsight: z.number().nonnegative().optional(),
  }).optional(),
}).superRefine((v, ctx) => {
  if (v.type === 'manual') {
    if (!v.teaches) ctx.addIssue({ code: 'custom', message: 'manual requires teaches' });
    if (v.completeness === undefined) ctx.addIssue({ code: 'custom', message: 'manual requires completeness' });
  }
});

export const ItemPackSchema = z.object({
  version: z.number().int().positive(),
  items: z.array(ItemSchema),
});

export type ItemRawDef = z.infer<typeof ItemSchema>;
export type ItemPack = z.infer<typeof ItemPackSchema>;

// ---- Phase 2B-1 Tribulation pillar schema ----
// Source: docs/spec/design.md §4.5, §9.4.

const PillarPhaseSchema = z.object({
  id: z.string().min(1),
  checkStats: z.record(z.enum(STAT_STRINGS), z.number().optional()),
  difficulty: z.number().positive(),
  failEffect: z.string().min(1),
});

export const PillarEventSchema = z.object({
  id: z.string().min(1),
  phases: z.array(PillarPhaseSchema).min(1),
});

export type PillarPhase = z.infer<typeof PillarPhaseSchema>;
export type PillarEvent = z.infer<typeof PillarEventSchema>;

// ---- Phase 2B-2 Region schema ----
// Source: docs/spec/design.md §7.2, §8.1.

const ClimateSchema = z.object({
  seasonWeights: z.object({
    spring: z.number().nonnegative(),
    summer: z.number().nonnegative(),
    autumn: z.number().nonnegative(),
    winter: z.number().nonnegative(),
  }),
  rainWeight: z.number().min(0).max(1),
});

const LocaleSchema = z.object({
  id: z.string().min(1),
  tagBias: z.array(z.string()).min(1),
});

const FactionSlotSchema = z.object({
  id: z.string().min(1),
  era: z.tuple([z.number().int(), z.number().int()]),
});

const NamePoolSchema = z.object({
  placePrefix: z.array(z.string().min(1)).min(1),
  placeFeature: z.array(z.string().min(1)).min(1),
});

export const RegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  qiDensity: z.number().positive(),
  climate: ClimateSchema,
  locales: z.array(LocaleSchema).min(1),
  factionSlots: z.array(FactionSlotSchema),
  eventPool: z.array(z.string()).min(1),
  pillarPool: z.array(z.string()),
  npcArchetypes: z.array(z.string()),
  namePool: NamePoolSchema,
});

export const RegionPackSchema = z.object({
  version: z.number().int().positive(),
  regions: z.array(RegionSchema).min(1),
});

export type RegionDef = z.infer<typeof RegionSchema>;
export type RegionPack = z.infer<typeof RegionPackSchema>;

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
