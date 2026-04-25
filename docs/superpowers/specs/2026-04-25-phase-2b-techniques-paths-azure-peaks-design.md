# Phase 2B — Techniques, Paths & Azure Peaks

**Status:** Design spec (brainstormed 2026-04-25)
**Supersedes:** CLAUDE.md "Phase 2B candidate scope" (pre-brainstorm notes)
**Predecessor:** [`2026-04-23-phase-2a-inheritance-and-reveal-design.md`](2026-04-23-phase-2a-inheritance-and-reveal-design.md) (Phase 2A — Cross-Life Inheritance & Reveal, shipped as 4 PRs)
**Next step:** Write implementation plan `2B-1` (engine foundations) via `superpowers:writing-plans`

---

## 1. Context

Phase 2A shipped cross-life inheritance (echoes, memories, 3 new anchors, MoodFilter, Codex/Lineage UI). The game now reincarnates with accumulated state, but every character still lives and dies as a Yellow-Plains peasant in Body Tempering. Phase 2B closes Phase 2 by delivering the **classic wuxia/xianxia early-game cultivation arc**: leaving the backwater, entering a sect, lock-in of Core Path identity, learning first techniques, and crossing from Body Tempering through Qi Sensing to Qi Condensation.

Design spec §13's Phase 2 exit conditions cover inheritance (done by 2A), **plus** core-path detection affecting 5+ resolvers, which requires the technique pipeline to exist. Phase 2B fills that gap and extends the playable vertical into two regions (Yellow Plains + Azure Peaks) and three realms (Body Tempering + Qi Sensing + Qi Condensation).

**What Phase 1A / 2A already shipped that 2B will consume:**

- `Character.corePath: CorePathId | null` field ([Character.ts:43](../../../src/engine/character/Character.ts:43))
- `Character.openMeridians: ReadonlyArray<MeridianId>` — **opening order preserved** ([Character.ts:42](../../../src/engine/character/Character.ts:42))
- `withOpenedMeridian(c, id)` — already calls `detectCorePath` and persists the result ([Character.ts:144](../../../src/engine/character/Character.ts:144))
- `detectCorePath(openingOrder)` — full 9-path detector (7 named meridian-triples + `hollow_vessel` same-element + `shattered_path` three-distinct-elements) per spec §4.4 ([CorePath.ts:28](../../../src/engine/character/CorePath.ts:28))
- `cultivationGainRate.techniqueMultiplier` — parameter already in formula ([CultivationProgress.ts:13](../../../src/engine/cultivation/CultivationProgress.ts:13)); callers currently pass 1.0
- `Realm` enum covers all 10 realms including `QI_SENSING` and `QI_CONDENSATION`
- `INSIGHT_CAP_BY_REALM` is complete through Immortal

**What 2B must build:** the registries, wiring, content, UI, and breakthrough transitions that turn those dormant Phase-1A hooks into a playable arc.

**North star for 2B:** every life in Azure Peaks *feels like a sect story* — sect hierarchy mentioned in events, a first technique learned by mid-life, core-path identity revealed at the 3rd meridian, inventory of manuals/pills/stones visible on the screen, Qi Sensing awakening as a discrete narrative beat.

---

## 2. Scope & exit criteria

### In scope

- **Technique registry** (§9.5) with Zod schema, 10 canonical techniques, and integration into `ChoiceResolver`
- **Item registry** (§9.6) with Zod schema, ~20-item corpus, and backfill of Phase 1 opaque strings (`spiritual_stone`, `minor_healing_pill`, `silver_pouch`)
- **Manual** item subtype (§9.7) with `completeness` field and partial-manual learning mechanics
- **Core Path consumption** — use Phase-1A detector output in `ChoiceResolver` (on-path technique full bonus, off-path ×0.5 multiplier) and surface on the UI
- **Azure Peaks region** (§8.1) with full `Region` definition: qiDensity 1.5×, climate, locales, 2 hardcoded factions per era, namePool
- **~35 Azure Peaks events** (daily, sect-training, sect-social, danger, opportunity, realm-gate, region-transition)
- **Qi Sensing awakening** (Body Tempering 9 + Spirit Root ≥ Mottled → QS; unlocks technique-learning)
- **Qi Condensation 1-9 breakthrough path** (gate: QS + ≥1 technique known)
- **Tribulation I stub** — scripted pillar event at QC9 → Foundation attempt, non-fatal in 2B (fail = retry next life)
- **Sect Initiate anchor** (Azure Peaks spawn at age 10, +Spirit Root tier bias, starts with 1 meridian open)
- **Inventory UI** (overlay panel on PlayScreen)
- **Technique list UI** (char sheet section)
- **CorePathBadge UI** on char sheet with reveal-on-3rd-meridian shimmer
- **Region indicator** on PlayScreen header
- **`BardoPanel` extension**: reveal section for techniques learned + core path
- **`LineageScreen` extension**: LifeCards show corePath + technique count
- **`CodexScreen` extension**: new "Techniques" tab (seen-in-world vs learned distinction)
- **Snippet library expansion** to ~150 leaves (sect / pill / elder / senior-brother register)
- **Save migration** `MetaState` v3 → v4 (adds `corePath` + `techniquesLearned[]` to `LineageEntrySummary`)
- **Phase 1 lingering fix** — peek/resolve RNG stream split (bundled into 2B-1 iff it doesn't perturb existing integration test snapshots; else split to its own follow-up)

### Exit criteria (all must pass to merge 2B)

1. Azure Peaks life is playable end-to-end via the **Sect Initiate** anchor with region-appropriate event pool + name pool (integration test: `tests/integration/azure_peaks_playable_life.test.ts`).
2. ≥10 techniques are registered, learnable via `technique_learn` choice outcomes OR `Manual`-read events, and the `choice_bonus` effect modifies ≥5 distinct later checks (integration test + resolver unit tests).
3. Core Path is detected from first-3-meridians-opened (already handled Phase 1A) and drives the **on-path full vs off-path ×0.5** technique-bonus split in `ChoiceResolver` (unit test: same technique gives different bonus to two characters with different paths).
4. Qi Sensing awakening (from Body Tempering 9 + Spirit Root ≥ Mottled) + Qi Condensation 1-9 progression is reachable. Integration test: a single life advances from Body Tempering 1 → Qi Condensation 3 via seeded event sequence.
5. Inventory panel + Technique list UI reflect engine state (UI integration test asserts the DOM).
6. `BardoPanel` reveals this-life techniques + core path; `LineageScreen` LifeCards show both; Codex "Techniques" tab lists seen + learned.
7. Save file with `MetaState` v3 (from Phase 2A-3) loads and upgrades cleanly to v4 with Phase 2A lineage + echoes + memories preserved and empty techniques/corePath history filled lazily.
8. Tribulation I stub fires at QC9 → Foundation breakthrough attempt, runs the 4-phase pillar structure, and returns a **non-fatal** fail on all paths in 2B (Phase 3 will flip to fatal + Heavenly Notice scaling).
9. Build ≤ 450 KB raw (Phase 3 budget). If >450 KB, lazy-load Azure Peaks content JSON so cold start stays under budget.

### Explicitly out of scope (deferred)

- Full **Faction state machine** with cross-life persistence (§8.3 "Phase 2+") — 2B hardcodes 2 factions per era in Azure Peaks; full state machine → Phase 3
- **Foundation / Core / Nascent Soul / Soul Transformation / Void Refinement** realms — Phase 3+
- **Tribulation I fatal** + Heavenly Notice scaling + **Tribulations II-IX** → Phase 3+
- **Heavenly Notice, Karmic Imprints, Karmic Hunters** → Phase 3
- **Cross-life Mystery Threads** puzzle layer (§7.8) → Phase 3
- **World map UI** → Phase 3
- **Bone Marshes / Imperial Capital / Northern Wastes / Sunken Isles** regions → Phase 3/4/5
- **NPC cross-life persistence** (§8.4) → Phase 4
- **Pillar puzzle events** beyond Tribulation I → Phase 4
- **Adept / Master rank-path progression** on techniques — 2B ships `rankPath` schema field + novice tier; adept/master unlock-progress tracking → Phase 3
- **`getCurrentPendingPreview` non-advancing resume** (Phase 1 lingering) — defer; 2B keeps current peek-advances-turn behavior
- **Event-flag consumption retrofit** of Phase 1D-3 orphan flags (`married`, `apprentice`, etc.) beyond natural Azure Peaks use

---

## 3. Engine subsystems

### 3.1 Technique registry (§9.5)

**Data shapes:**

```ts
type TechniqueGrade = 'mortal' | 'yellow' | 'profound' | 'earth' | 'heaven' | 'immortal';
type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'none';

interface TechniqueEffect {
  kind:
    | 'choice_bonus'             // adds flat % to choices matching `category`
    | 'qi_regen'                 // per-turn qi restore
    | 'insight_gain_per_meditation'  // insight bonus on meditate-tagged events
    | 'mood_modifier'            // +delta to a Mood input per turn while known
    | 'unlock_choice';           // gate: makes a specific choiceId visible
  // discriminated fields per kind — see schema
}

type CoreAffinityToken = CorePathId | 'any';   // 'any' = universal (always full bonus)

interface Technique {
  id: string;
  name: string;
  grade: TechniqueGrade;
  element: Element;
  coreAffinity: ReadonlyArray<CoreAffinityToken>;  // on-path = full, off-path = ×0.5
  requires: {
    realm?: Realm;                          // min realm to learn
    meridians?: ReadonlyArray<MeridianId>;
    openMeridianCount?: number;
  };
  qiCost: number;
  insightCost?: number;
  effects: ReadonlyArray<TechniqueEffect>;
  description: string;
  rankPath?: {
    novice: ReadonlyArray<TechniqueEffect>;
    adept: ReadonlyArray<TechniqueEffect>;
    master: ReadonlyArray<TechniqueEffect>;
  };
}
```

**Character shape addition:**

```ts
interface Character {
  // ... existing fields ...
  readonly techniques: ReadonlyArray<TechniqueId>;   // known techniques
}
```

**TechniqueRegistry:**

```ts
interface TechniqueRegistry {
  all(): ReadonlyArray<Technique>;
  byId(id: TechniqueId): Technique | null;
  canLearn(c: Character, id: TechniqueId): { ok: true } | { ok: false; reason: string };
}
```

**TechniqueApplier** — the integration point with `ChoiceResolver`:

```ts
interface TechniqueBonusContext {
  character: Character;
  choice: Choice;             // has `technique_bonus_category?: string`
}

// Summed over character.techniques:
//   each choice_bonus effect whose `category` matches choice.technique_bonus_category
//   contributes `effect.bonus × affinityMultiplier(technique, character.corePath)`
function computeTechniqueBonus(ctx: TechniqueBonusContext): number;
```

Where `affinityMultiplier(technique, character.corePath)`:
- `1.0` if `technique.coreAffinity.includes('any')` — universal technique
- `1.0` if `character.corePath === null` — character hasn't revealed a path yet (no penalty pre-reveal)
- `1.0` if `technique.coreAffinity.includes(character.corePath)` — on-path match
- `0.5` otherwise — off-path

**`Choice` schema addition:**

```ts
// Phase 1B Choice schema already has placeholders for technique bonus wiring.
// 2B extends (backwards-compatible optional field):
interface Choice {
  // ... existing fields ...
  technique_bonus_category?: string;   // e.g. 'strike', 'study', 'flee', 'intimidate'
}
```

**`cultivationGainRate.techniqueMultiplier` wiring:** callers compute from character's techniques — specifically, `insight_gain_per_meditation` effects during meditation events add multiplicative gain; baseline remains 1.0 when none active. The parameter already exists — update callers, not the function.

### 3.2 Item registry (§9.6) + Manuals (§9.7)

**Data shapes:**

```ts
type ItemType = 'pill' | 'manual' | 'weapon' | 'armor' | 'talisman' | 'misc';
type ItemGrade = TechniqueGrade;   // same 6-tier ladder

interface Item {
  id: string;
  name: string;
  type: ItemType;
  grade: ItemGrade;
  stackable: boolean;
  effects: ReadonlyArray<ItemEffect>;
  description: string;
  weight?: number;
}

interface Manual extends Item {
  type: 'manual';
  teaches: TechniqueId;
  completeness: 0.25 | 0.5 | 0.75 | 1.0;
  readerRequires?: { minMind?: number; minInsight?: number };
}

type ItemEffect =
  | { kind: 'heal_hp'; amount: number }
  | { kind: 'restore_qi'; amount: number }
  | { kind: 'pill_bonus'; amount: number }               // for breakthrough attempts
  | { kind: 'insight_gain'; amount: number }
  | { kind: 'deviation_risk'; delta: number }           // talismans may modify risk
  | { kind: 'choice_bonus'; category: string; bonus: number };  // weapon/talisman
```

**Inventory:**

```ts
interface InventoryStack {
  itemId: ItemId;
  count: number;                // 1 if not stackable
}

// Added to Character:
readonly inventory: ReadonlyArray<InventoryStack>;
```

**Partial-manual learning mechanic** (the xianxia flavor):

A partial manual (`completeness < 1.0`) can still teach the technique, but learning it triggers a **deviation-risk roll**:

```
deviationRisk = baseRisk × (1 - completeness)²
              − Mind × 0.3
              − Insight × 0.05
              + (realm < minRealm ? 40 : 0)
```

Clamped [0, 95]. Rolled on `technique_learn` outcome where source is a manual item. Failure outcomes (per severity tier from §4.6):
- Tremor: character takes 10% HP, no technique learned, manual consumed
- Scar: character takes 25% HP, −5 insight, no technique learned, manual consumed
- Cripple: character takes 50% HP, +`cripple_<meridian>` flag, no technique learned, manual consumed
- Rend / Shatter: not reachable from partial-manual in 2B (reserved for Phase 3 over-cultivation)

Complete manuals (`1.0`) bypass the roll entirely. Fragment memories (§7.3) manifesting as "you remember a fragment of this technique" map to `completeness = 0.25` internally (this unifies the Forbidden Memory → Technique pipeline).

### 3.3 Core Path consumption (§4.4)

Phase 1A's `detectCorePath` already identifies the path. **2B's work:**

- Ensure `withOpenedMeridian` is invoked through the `meridian_open` stateDelta in Phase 1B's `OutcomeApplier` (verify during plan-writing; if already wired, no engine work needed — just UI surfaces the path).
- Add a reveal **side-effect** hook in the outcome-applier: when a `meridian_open` promotes `openMeridians` from length 2 to length 3 and `detectCorePath` returns non-null, emit a post-outcome event `core_path_revealed` consumable by the UI shimmer.
- `computeTechniqueBonus` (3.1) uses `character.corePath` for the on/off multiplier split.
- `Character` with `corePath === null` (before 3 meridians) treats all techniques as on-path (×1.0) — a minor simplification so early-life technique use isn't unfairly penalized.

### 3.4 Realm crossing — Body Tempering 9 → Qi Sensing → Qi Condensation 1-9

**Body Tempering 9 → Qi Sensing (awakening):**

Gate (all required):
- `realm === BODY_TEMPERING` and `bodyTemperingLayer === 9`
- `spiritRoot.tier` >= `MOTTLED` (using existing `spiritRootTier` ordering)
- `cultivationProgress >= 100` (bar full)

Attempt is a breakthrough event:
```
awakeningSuccessChance = 40
                       + Mind × 0.3
                       + Spirit × 0.3
                       + Insight × 0.05
                       + pillBonus           // already pre-scaled per Phase 1A quirk
                       − (spiritRootTier rank penalty table)
```

Clamped [15, 95]. Success: realm → QI_SENSING, reset `cultivationProgress` to 0, set `bodyTemperingLayer` back to 0 (no sub-layers in QS). Failure: 50% of bar lost, no deviation in 2B.

**Qi Sensing → Qi Condensation 1:**

Gate:
- `realm === QI_SENSING` and `cultivationProgress >= 100`
- `character.techniques.length >= 1` (the spec §4.1 "Qi Sensing + 1 technique" gate)

Success: realm → QI_CONDENSATION, `cultivationProgress` 0, `qiCondensationLayer` 1.

**QC sub-layer breakthrough 1 → ... → 9:** standard §4.3 formula reused — the `Breakthrough.attemptSublayerBreakthrough` helper already exists from Phase 1A. Plan will verify it generalizes to QC or add a `QiCondensationBreakthrough` helper.

**Character shape:**

```ts
interface Character {
  // ... existing fields ...
  readonly bodyTemperingLayer: number;     // 0 (not in BT) | 1..9
  readonly qiCondensationLayer: number;    // 0 (not in QC) | 1..9    ← NEW
}
```

Migration: all existing Phase 2A characters get `qiCondensationLayer = 0`.

### 3.5 Tribulation I stub (§4.5)

Non-fatal in 2B. Triggers when `realm === QI_CONDENSATION && qiCondensationLayer === 9 && cultivationProgress >= 100`.

Scripted 4-phase sequence (deterministic order, no selector):

1. **Heart Demon** — Mind + Spirit vs difficulty 60. Fail = −5 insight, retry.
2. **First Thunder** — Body + Spirit vs difficulty 50. Fail = −20% HP, continue.
3. **Second Thunder** — Body + Spirit vs difficulty 65. Fail = −40% HP, continue.
4. **Third Thunder** — Body + Spirit vs difficulty 80. **In Phase 2B: fail = retry next life (no death).** Phase 3 flips to death.

The scripted pillar is delivered as a new event kind: `PillarEvent` with fixed phase array (same schema as §9.4). Plan will either extend the existing `Event` schema or introduce a sibling — TBD at plan-write time.

### 3.6 Phase 1 lingering: peek/resolve RNG stream split

The current `peekNextEvent` uses `cursor + 1` for its local RNG to avoid mutating the resolver's seed trajectory. This produces narrative drift on repeated peeks without resolving.

**2B-1 fix (best-effort):**

Introduce two seeded sub-streams derived from the turn seed:
- `selectorSubstream = derivedRng(turnSeed, 'selector')`
- `narrativeSubstream = derivedRng(turnSeed, 'narrative')`

`peekNextEvent` reads from both at advance=0; `resolveChoice` reads from both at advance=1. Event ID and choices are deterministic from `selectorSubstream`; narrative composition reads from `narrativeSubstream`. Repeated peek-without-resolve returns identical output.

**Gate:** if the fix perturbs Phase 1 integration test snapshots (`playable_life`, `ui_full_cycle`) or Phase 2A tests (`playable_life_2a`), the fix is split to its own follow-up PR (`fix/peek-resolve-rng-split`) after 2B-3 merges. Plan-writing confirms this.

---

## 4. Content

### 4.1 Azure Peaks region

```ts
const AZURE_PEAKS: Region = {
  id: 'azure_peaks',
  name: 'Azure Peaks',
  qiDensity: 1.5,
  climate: { seasonWeights: { spring: 0.3, summer: 0.25, autumn: 0.25, winter: 0.2 }, rainWeight: 0.3 },
  locales: [
    { id: 'outer_sect_courtyard',   tagBias: ['social', 'study'] },
    { id: 'scripture_hall',         tagBias: ['study', 'manual_discovery'] },
    { id: 'meditation_cave',        tagBias: ['training', 'meditate'] },
    { id: 'beast_pass',             tagBias: ['danger', 'hunt'] },
    { id: 'alchemy_pavilion',       tagBias: ['opportunity', 'pill'] },
    { id: 'elder_quarters',         tagBias: ['social', 'bond'] },
  ],
  factionSlots: [
    // hardcoded per era; full state machine Phase 3
    { id: 'azure_cloud_sect', era: [0, 1000] },   // default era faction
    { id: 'broken_mountain_cult', era: [200, 800] },  // rival
  ],
  eventPool: ['ap_*'],                 // events with `region: 'azure_peaks'`
  pillarPool: ['tribulation_i'],
  npcArchetypes: [],                   // Phase 4
  namePool: {
    placePrefix: ['Azure', 'Cloudcrane', 'Soaring', 'Crystal', 'Whispering', 'Nine-Peak'],
    placeFeature: ['Peak', 'Hall', 'Vale', 'Pavilion', 'Scripture House', 'Sword Pool'],
  },
};
```

### 4.2 10 canonical techniques (novice tier)

| id | name | grade | element | coreAffinity | cost | effect highlight |
|----|------|-------|---------|---------------|------|------------------|
| `iron_mountain_body_seal` | Iron Mountain Body Seal | mortal | earth | [iron_mountain] | 5 qi | `choice_bonus('body_check', +15)`, `choice_bonus('resist', +10)` |
| `severing_edge_swordform` | Severing Edge Swordform | mortal | metal | [severing_edge] | 8 qi | `choice_bonus('strike', +18)`, `choice_bonus('duel', +12)` |
| `still_water_heart_sutra` | Still Water Heart Sutra | mortal | water | [still_water] | 3 qi | `insight_gain_per_meditation(+2)`, `mood_modifier('serenity', +1)` |
| `howling_storm_step` | Howling Storm Step | mortal | none | [howling_storm] | 4 qi | `choice_bonus('evade', +20)`, `unlock_choice('flee_mounted_pursuer')` |
| `blood_ember_sigil` | Blood Ember Sigil | yellow | fire | [blood_ember] | 10 qi | `choice_bonus('intimidate', +15)`, `mood_modifier('wrath', +2)` |
| `thousand_mirrors_mnemonic` | Thousand Mirrors Mnemonic | mortal | none | [thousand_mirrors] | 2 qi | `choice_bonus('study', +12)`, `choice_bonus('social', +8)` |
| `common_qi_circulation` | Common Qi Circulation | mortal | none | [any] | 0 qi | `qi_regen(+1)` |
| `novice_fireball` | Novice Fireball | mortal | fire | [blood_ember, iron_mountain] | 6 qi | `choice_bonus('strike', +10)` |
| `golden_bell_defense` | Golden Bell Defense | yellow | metal | [iron_mountain] | 7 qi | `choice_bonus('resist', +22)` |
| `wind_walking_steps` | Wind-Walking Steps | mortal | none | [howling_storm, any] | 3 qi | `choice_bonus('evade', +10)`, `unlock_choice('traverse_difficult_terrain')` |

All ten include `rankPath` novice-only in 2B; adept + master effect variants are authored as stubs for forward-compat but not learnable.

### 4.3 Item corpus

~20 items total:

**Pills** (6): `low_grade_qi_pill` (restore_qi 20), `minor_healing_pill` (heal_hp 30) *[backfill from Phase 1D-3]*, `foundation_pill` (pill_bonus 25, breakthrough aid), `cleansing_pill` (deviation_risk −10), `insight_dew` (insight_gain 10), `spirit_gathering_pill` (qi_regen 1 for 30 days).

**Manuals** (6): one per canonical technique from §4.2, mix of completeness: `manual_common_qi_circulation` (1.0), `manual_iron_mountain_body_seal` (1.0), `manual_severing_edge_swordform_fragment` (0.5), `manual_still_water_heart_sutra` (1.0), `manual_wind_walking_steps_partial` (0.75), `manual_blood_ember_sigil_fragment` (0.25).

**Weapons / armor / talismans** (5): `outer_sect_iron_sword` (choice_bonus strike +3), `inner_disciple_robe` (choice_bonus resist +2), `warding_talisman` (deviation_risk −15, consumed on use), `spirit_gathering_bracelet` (qi_regen 0.5), `paper_qi-block_talisman` (choice_bonus evade +10, consumable).

**Misc** (3): `spiritual_stone` (currency / breakthrough fuel; stackable) *[backfill]*, `silver_pouch` (mortal currency; stackable) *[backfill]*, `sect_token` (unlock_choice 'enter_scripture_hall').

### 4.4 ~35 Azure Peaks events

Breakdown:

- **Daily (8):** morning qi circulation, alchemy pavilion errand, scripture copying, sect chore, outer courtyard sparring, meditation session, herb gathering, sect meal
- **Sect-training (6):** elder's guided cultivation, pill-assisted breakthrough, technique drilling, meridian-opening assistance, spirit beast sparring, scripture study
- **Sect-social (6):** senior brother mentorship offer, junior sister request, rival disciple challenge, elder's favor, sect mission briefing, faction-lean choice
- **Danger (5):** rival sect incursion, demonic cultivator encounter, beast pass ambush, rogue talisman master, outer-sect trial hazard
- **Opportunity (5):** cave discovery (manual), elder's unexpected gift, market lucky find, spirit beast befriending, treasure hunt
- **Realm-gate (5):** Qi Sensing awakening (BT9 → QS breakthrough event), first technique learn offering, Qi Condensation 1 breakthrough, Qi Condensation 5 mid-realm trial, Qi Condensation 9 Tribulation I setup
- **Region-transition (5):** descend to Yellow Plains (mission), return to Azure Peaks, cross-region travel encounters, visit to wandering master, sect-sanctioned pilgrimage

Of those 35, ~8-10 contain `technique_learn` outcomes or `item_add` for manuals/pills, driving the technique-acquisition loop.

### 4.5 Sect Initiate anchor

```json
{
  "id": "sect_initiate",
  "displayName": "Sect Initiate",
  "region": "azure_peaks",
  "startingAgeYears": 10,
  "attributeBiases": { "Mind": +2, "Spirit": +2 },
  "spiritRootTierBias": +1,        // e.g., common → mottled more often
  "startingMeridianId": 7,         // kidney — neutral for most sect paths (Still Water + Iron Mountain); does NOT alone trigger core-path detection (need 3)
  "startingFlags": ["sect_disciple", "outer_sect_roster"],
  "unlockCondition": "life_reached_qi_sensing"   // triggered in prior life
}
```

Replaces the "outer_disciple" Phase 2A-2 anchor's role as the gateway to sect content — but `outer_disciple` stays (Yellow Plains-born aspirant who *hopes* to join a sect); `sect_initiate` is sect-born.

### 4.6 Snippet library expansion

Target ~150 leaves after 2B (from 80 post-Phase-1D-3 + 18 post-Phase-2A-2). +~50 new leaves focused on:

- sect register (robe texture, peak names, elder demeanor)
- pill-smoke imagery (cultivation events)
- senior/junior brother/sister tone
- technique-manifestation flavor (fire, sword, body-seal)
- Qi Sensing awakening moment (once-per-life narrative beat)

---

## 5. UI subsystems (§11)

### 5.1 `InventoryPanel`

Overlay on `PlayScreen`, triggered by a new "Inventory" button next to the char-sheet button. Grid of slot-cards grouped by item type. Hover shows full effect list + description. Pills and consumables show stack count. Consume action is a choice-event outcome in 2B — the panel itself is read-only. (Direct-use consumables out of scope; Phase 3 may add.)

### 5.2 `TechniqueList`

Section inside the existing char-sheet drawer. Lists known techniques:
- Name + grade badge + element icon
- `coreAffinity` indicator — green dot if character's corePath is on-affinity, gray otherwise
- rankPath progress (always at novice in 2B; adept/master stubs greyed out)
- hover-tooltip shows effect list

### 5.3 `CorePathBadge`

On char sheet header. States:
- **Not yet revealed** (fewer than 3 meridians open): "Path: undetermined"
- **Ambiguous** (3 meridians but no match — 2 share an element + 1 odd): "Path: wandering"
- **Revealed**: shows path name + iconography + short flavor

On transition from 2 → 3 meridians with a detected path, shimmer animation (reusing Phase 2A-3 anchor shimmer pattern) + one-turn mood cue.

### 5.4 Region indicator

Small pill on `PlayScreen` header showing current region name + qi-density indicator. Updates on region-transition events.

### 5.5 `BardoPanel` / `LineageScreen` / `CodexScreen` extensions

- **BardoPanel** — adds a "Techniques learned this life" reveal section + "Core path walked" section (conditional on corePath != null).
- **LineageScreen LifeCards** — existing year-range/anchor/realm/cause/echoes rendering is extended with corePath (icon + name) and technique count (`3 techniques`).
- **CodexScreen** — adds a fifth tab "Techniques" alongside Memories/Echoes/Anchors (and Phase 2A-3's 3 tabs). Shows list of all techniques the player has **seen in any life** (via `seen_technique_<id>` flags set by Azure Peaks events when the player witnesses without learning), with a learned/unlearned distinction. The per-life "learned this life" view is via LineageScreen; Codex is cumulative-encyclopedia.

---

## 6. Persistence — `MetaState` v3 → v4

### v3 → v4 additions

```ts
interface LineageEntrySummary {
  // ... v3 fields (birthYear, deathYear, anchor, realm, cause, echoesUnlocked) ...
  corePath: CorePathId | null;                 // NEW (null if character died before 3 meridians)
  techniquesLearned: ReadonlyArray<TechniqueId>;  // NEW
}

interface MetaState {
  // ... v3 fields ...
  seenTechniques: ReadonlyArray<TechniqueId>;  // NEW — cumulative across all lives, powers Codex "Techniques" tab
}
```

Migration `v3 → v4`:
- Existing lineage entries get `corePath: null`, `techniquesLearned: []`
- `seenTechniques: []`
- Schema version bumps

Tested by fixture migration test (`Migrator.v3_to_v4.test.ts`).

### `RunSave` additions

`Character.techniques` + `Character.inventory` + `Character.qiCondensationLayer` are persisted under the existing `RunSave` envelope. No RunSave schema version bump (RunSave is runtime state, not persisted meta; new fields default to `[]` / `0` on load for Phase 2A saves).

---

## 7. Sub-phase decomposition

### Phase 2B-1: Engine foundations (target ~70 tests)

Pure engine, no content, no UI. Mirrors Phase 2A-1's cadence.

- `Technique` Zod schema + `TechniqueRegistry` (empty default; corpus ships 2B-2)
- `TechniqueApplier.computeTechniqueBonus` + resolver integration (on/off-path multiplier)
- `Item` + `Manual` Zod schemas + `ItemRegistry` (empty default)
- `InventoryModel` (add/remove/count helpers, pure)
- `Character.techniques`, `Character.inventory`, `Character.qiCondensationLayer` fields + migrations
- Realm-crossing helpers: `attemptQiSensingAwakening`, `attemptQiCondensationEntry`, reuse of `attemptSublayerBreakthrough` for QC
- Partial-manual `deviationRisk` computation + tier resolver + outcome applier
- `cultivationGainRate` callers updated to compute techniqueMultiplier from active techniques
- `core_path_revealed` post-outcome hook fires on 2→3 meridian transition (consumable by UI in 2B-3)
- **Tribulation I** pillar event engine (scripted 4-phase, non-fatal in 2B via a `tribulation_mode: 'non_fatal' | 'fatal'` runtime flag defaulting to `'non_fatal'`; Phase 3 flips)
- `MetaState` v3 → v4 migration w/ fixture test
- **Optional (bundled if safe):** peek/resolve RNG stream split
- Engine-level integration test: `tests/integration/technique_bonus_resolution.test.ts`

### Phase 2B-2: Content + engine wiring (target ~80 tests)

- `Region` content: `azure_peaks.json` loaded via existing loader + lazy-load gate
- 10 technique JSON defs
- 20-item corpus including 6 Manuals
- ~35 Azure Peaks events
- Phase 1D-3 opaque-item backfill (swap `'spiritual_stone'` strings for `ItemId` references)
- Sect Initiate anchor registration + unlock rule (`life_reached_qi_sensing`)
- +~50 snippet leaves for Azure Peaks register
- Event retrofits on Yellow Plains: 2-3 events that gate on `sect_disciple` flag; bridge events between YP and AP
- Integration test: `tests/integration/azure_peaks_playable_life.test.ts` — spawns Sect Initiate, plays through QS awakening + first technique + QC1
- Closes exit criteria #1, #2, #3 (via integration tests), #4, partial #8

### Phase 2B-3: UI + Tribulation I stub + integration (target ~50 tests)

- `InventoryPanel` component + integration into PlayScreen
- `TechniqueList` char-sheet section
- `CorePathBadge` with reveal-on-3rd-meridian shimmer
- Region indicator on PlayScreen header
- `BardoPanel` extensions (techniques + core path reveal sections)
- `LineageScreen` LifeCards show corePath + technique count
- `CodexScreen` new "Techniques" tab
- `CreationScreen` lists Sect Initiate anchor w/ locked silhouette until unlock
- Tribulation I UI — scripted pillar renders as 4-phase sequence with per-phase check feedback
- Full multi-life UI integration test: `tests/integration/playable_life_2b.test.tsx` — 3-life loop where Sect Initiate unlocks and is then used
- Closes exit criteria #5, #6, #7, #8 (full), #9 (bundle audit)

**Aggregate target:** 694 → ~890 tests, 3 sub-PRs, 2-3 days each.

---

## 8. Known risks / open questions / plan-divergence flags

1. **`meridian_open` stateDelta → `withOpenedMeridian` wiring**. The current `OutcomeApplier` handles `meridian_open` with a numeric id; it must route through `Character.withOpenedMeridian` (not a raw push to `openMeridians`) so `detectCorePath` fires. Plan-writing verifies this; if direct push is used, 2B-1 first refactors the applier.

2. **`Phase 1B Choice` schema** may not have `technique_bonus_category` as an optional field yet. Extension is backwards-compatible (optional), but plan-writing verifies and adds via schema additive change (no migration — JSON events without the field simply don't get technique bonuses).

3. **`Breakthrough.attemptSublayerBreakthrough` reuse for QC.** Phase 1A designed it for Body Tempering. Likely works for QC (same formula), but plan verifies layer-penalty constant scales acceptably at QC7-9. If not, a `QiCondensationBreakthrough` wrapper adjusts.

4. **Peek/resolve RNG stream split risk.** If the fix perturbs Phase 1 / 2A integration snapshots (seeded event sequences) the fix gets deferred to a standalone follow-up PR. Plan-writing includes a "canary test" step: run existing snapshots under the new RNG layout and compare.

5. **Tribulation I schema.** `§9.4 PillarEvent` was scaffolded but not shipped in Phase 1 (opaque in corpus). 2B-1 ships the **schema** + the engine; 2B-3 ships the **UI**. If Tribulation I tests reveal the existing `Event` schema can't represent a scripted 4-phase sequence without extension, plan-writing inserts schema work into 2B-1.

6. **Bundle budget.** Current 434.76 KB. +35 events JSON (~20 KB) + 10 techniques JSON (~4 KB) + 20 items JSON (~4 KB) + 50 snippets (~10 KB) + ~6 UI components (~8 KB minified) ≈ +46 KB → ~481 KB raw. **Over 450 KB by ~31 KB.**
   - **Mitigation (required in 2B-2):** lazy-load Azure Peaks content at region entry (split `content/azure_peaks/**` into a dynamic-import chunk). Baseline cold-start bundle would stay at ~440 KB; Azure Peaks chunk ~45 KB loads on first AP life.
   - **Fallback if lazy-load is too complex for 2B-2:** defer CorePathBadge and TechniqueList rich visuals to 2B-3.5 or ship minimal SVG icons.

7. **`Character.flags` growth.** Techniques authored via Azure Peaks events set `sect_disciple`, `outer_sect_roster`, `seen_technique_<id>`, etc. Target flag count post-2B: ~50 (from ~30 post-2A). Still well under anything that'd require a different data structure.

8. **Partial-manual deviation formula uncertainty.** The `(1 - completeness)²` quadratic is chosen to make `0.25` fragments much riskier than `0.75` partials. If plan-writing or implementer tests suggest the gradient is too steep/shallow, the formula is adjustable — the SHAPE matters, the exact coefficient is tunable.

9. **Core-path "wandering" state.** When a character opens 3 meridians that match no named path and don't all share or differ an element (i.e., 2 share + 1 odd), `detectCorePath` returns `null`. Spec §4.4 doesn't explicitly name this case. 2B surfaces it as "wandering" on the badge and treats all techniques as off-path (×0.5) since there's no path affinity. Plan verifies this matches existing `detectCorePath` null-return semantics.

10. **Anchor-roster size.** After 2A we have 5 anchors; 2B-2 adds Sect Initiate for 6. Still under a natural UI-scroll threshold. No refactor needed.

11. **Elder/Master bonus wiring.** The existing `MeridianOpen.techniqueBonus` + `masterBonus` parameters from Phase 1A will now have a real source — techniques grant `techniqueBonus`; sect-elder events grant `masterBonus`. Plan wires this during 2B-2 event authoring; 2B-1 leaves callers passing 0 (no regression).

12. **`spiritRoot.tier` comparison.** The Qi Sensing awakening gate uses `spiritRoot.tier >= MOTTLED`. Plan-writing verifies that Phase 1A's `SpiritRoot` type exposes a tier ordinal (or a helper `spiritRootTierRank(tier): number`) usable in numeric comparison. If not, 2B-1 adds a tiny `SPIRIT_ROOT_TIER_RANK` constant map before the gate check.

13. **`SpiritRoot` penalty table in awakening formula (§3.4).** The formula references "spiritRootTier rank penalty". Concrete values not specified in spec §4.2 — needs a small tunable table (e.g., `{TRUE_SPIRIT: 0, MOTTLED: 5, MUDDY: 15, COMMON: 30 /* = locked out */}`). Plan-writing picks defaults + notes them in the 2B-1 commit for transparency.

---

## 9. Open decisions for user (before plan-writing)

**None blocking.** All design decisions are captured above. If the user wants to tune:

- **Bundle budget mitigation** (§8.6): lazy-load vs minimal-SVG fallback — default is lazy-load, plan can flip if user prefers a simpler PR
- **Partial-manual failure tiers** (§3.2): three tiers (Tremor/Scar/Cripple) vs simpler binary success/fail — default is three tiers for xianxia flavor
- **Sect Initiate unlock condition**: `life_reached_qi_sensing` feels tight; alternative is `life_joined_sect` (any life where `sect_disciple` flag was set) — default is `life_reached_qi_sensing` for progression gating

---

## 10. Implementation plan pointer

Next step: write implementation plan for **Phase 2B-1 (Engine foundations)** via `superpowers:writing-plans` at `docs/superpowers/plans/2026-04-25-phase-2b1-engine.md`. Plans for 2B-2 and 2B-3 are written after 2B-1 merges, following the Phase 2A cadence.
