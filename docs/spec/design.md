# The Thousand Deaths of a Would-Be Immortal

**Technical Design Specification — v1.0**
**Project codename:** Wuxia Dungeon RPG v2 (WDR2)
**Status:** Design lock — ready for phased implementation
**Target platform:** Client-side web (React 19 + TS + Vite + Tailwind). No backend, no LLM, offline-capable.

---

## Table of Contents

1. [Overview & Design Pillars](#1-overview--design-pillars)
2. [Game Loop Architecture](#2-game-loop-architecture)
3. [Character System](#3-character-system)
4. [Cultivation System](#4-cultivation-system)
5. [Choice-Event System](#5-choice-event-system)
6. [Narrative Composition Engine](#6-narrative-composition-engine)
7. [Meta-Progression](#7-meta-progression)
8. [World & Era System](#8-world--era-system)
9. [Content Data Schemas](#9-content-data-schemas)
10. [Persistence Model](#10-persistence-model)
11. [UI / UX Spec](#11-ui--ux-spec)
12. [File & Module Architecture](#12-file--module-architecture)
13. [Implementation Phases](#13-implementation-phases)
14. [Appendix: Formulas, Samples & Edge Cases](#14-appendix)

---

## 1. Overview & Design Pillars

### 1.1 Core Pitch

> *You are nobody. No spirit root, no bloodline, no destiny. The Heavens did not write your name. Yet the cycle of reincarnation is patient — and you are stubborn. Each death is a lesson. Each life is a brushstroke. After a thousand deaths, perhaps the Heavens will finally notice.*

### 1.2 Genre Tag

- **Primary:** Text-based Roguelite RPG + Cultivation Sim + Reincarnation Meta-Progression
- **Combat model:** Choice-event only (no tactical grid combat). Every conflict resolves as a weighted probability check.
- **Tone target:** Philosophical, puzzle-heavy, mind-bending, mystery-rich — a xianxia webnovel crossed with a stat-literate soulslike.
- **Language:** English only (v2). Localisation hooks present but no ID strings shipped.

### 1.3 Design Pillars (non-negotiable)

1. **Death is content, not failure.** Every death teaches, unlocks, or rewards.
2. **Mortal life must feel *systemically* unfair, not randomly unfair.** The world does not care about you — that's the point. But outcomes are always *derivable* from stats + luck + inputs.
3. **Knowledge is the primary currency.** Information persists between lives more than raw stats.
4. **Style is mechanic.** Narrative tone shifts with realm — that shift is the progression feedback.
5. **No LLM means *more* craft, not less.** Hand-written pillars + combinatorial snippet grammars + layered filters.
6. **The Soulslike contract.** The game respects the player by being unforgiving and *consistent*. Every failure is legible.
7. **Mystery is structural.** Clues span multiple lives. The payoff for a puzzle seeded in Life 3 might come in Life 47. This must be designed from day one, not bolted on later.
8. **Probability with a floor and a ceiling.** Weak characters can win through luck. Strong characters can still fumble. Determinism is the death of wonder.

### 1.4 Out of Scope (v2)

- Turn-based tactical combat (explicitly cut — choice events only).
- Multiplayer / online features.
- Gemini / any LLM dependency (removed).
- Bilingual EN/ID content (English only this revision).
- Mobile-native builds (browser PWA acceptable later).

### 1.5 Tone Target Examples

The narrative voice must reliably produce passages like these (sample, not shipped content):

> *In the forty-seventh year of the Jade Sovereign, the drought came as the old women had foretold. Lin Wei buried his mother in soil that cracked like porcelain and did not weep, because weeping too required water. He was nine years old. He did not yet know that this was the first of his debts.*

> *He perceived the sword as one perceives a bell — not the shape of it, but its willingness to ring. This was the difference, he understood, between holding a weapon and being held by one.*

> *The cultivator laughed. It was the laugh of a man who had lived too long and remembered too much. "Do you know," he said, "how many times I have watched a boy with your eyes die in front of me? Seven. And every time, I said nothing. The eighth time, I said: little brother, do not go down that road. The ninth time — ah, but we are only at the eighth."*

Delivery of this tone is not optional. §6 specifies the composition machinery that makes this reproducible without an LLM.

---

## 2. Game Loop Architecture

### 2.1 Two-Loop Model

```
┌──────────────────────────────────────────────────────────────┐
│                    OUTER LOOP — Samsara                      │
│   persistent state: karma, echoes, memories, notice, lineage │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │               INNER LOOP — Mortal Coil               │   │
│   │   one life: 30 min – 3 hrs wall-clock                │   │
│   │   spawn → live → die → bardo                         │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
│   bardo screen → spend karma → reincarnate (anchor select)   │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Phases

Top-level `GamePhase` enum (replaces the existing three-value enum):

```ts
enum GamePhase {
  TITLE,               // title screen, new/continue/codex/settings
  CREATION,            // anchor select → name → spirit root reveal → echo reveal
  PLAYING,             // main inner-loop play state
  BARDO,               // between-lives, karma spend, echo reveal
  CODEX,               // full-screen library browser
  GAME_OVER_FINAL      // true ending reached (Immortal Ascension or narrative finale)
}
```

### 2.3 Inner-Loop State Machine

Within `PLAYING`, a life is a sequence of **Turns**. Each turn is:

1. **Scheduler** picks an event (see §5.1) given current (character, region, era, flags).
2. **Composer** renders narrative (see §6).
3. **Player** selects one `Choice`.
4. **Resolver** rolls the check (see §5.3), picks an `Outcome`.
5. **Applier** mutates character + world state.
6. **AgeTick** advances in-game time (per-event cost; see §2.5).
7. **DeathCheck** — if dead, transition to `BARDO`.

Pseudocode:

```ts
async function runTurn(state: RunState): Promise<RunState> {
  const event = EventSelector.pick(state);
  const narrative = Composer.render(event, state);
  const choice = await UI.presentChoices(narrative, event.choices);
  const outcome = ChoiceResolver.resolve(choice, state);
  const nextState = OutcomeApplier.apply(state, outcome);
  return AgeTick.advance(nextState, event.timeCost);
}
```

### 2.4 Outer-Loop State Machine

```
PLAYING --(death)--> BARDO
   BARDO --(reincarnate)--> CREATION
     CREATION --(ready)--> PLAYING
```

`BARDO → CREATION` is where meta-progression writes happen (echo additions, memory logging, karma accrual, notice delta).

### 2.5 Time & Age

Every event declares a `timeCost` bucket:

| Bucket      | Elapsed game-time |
|-------------|-------------------|
| `INSTANT`   | 0 days            |
| `SHORT`     | 1–7 days          |
| `MEDIUM`    | 1–3 months        |
| `LONG`      | 6–18 months       |
| `EPOCH`     | 3–10 years        |

`EPOCH` buckets are reserved for **meditation montages, closed-door seclusion, and time-skip narrative passes**. They are the primary pacing lever that lets a single life span 70+ in-game years in 30 minutes of play.

Age is tracked in days. Lifespan cap depends on realm (see §4.1). Old-age death fires when days_lived ≥ lifespan_cap × variance.

### 2.6 Run vs Meta Separation

Two strictly separated state slices:

- **`RunState`** — everything about the current life. Wiped on death.
- **`MetaState`** — everything that persists. Never touched during `PLAYING` except read-only.

Writing to `MetaState` from `PLAYING` is a bug. All meta deltas are buffered as `MetaDelta` objects during the life, then applied atomically during `BARDO`. This is enforced at the type level (§12).

---

## 3. Character System

### 3.1 Attribute Model

Six primary attributes (range 0–100, soft-capped by realm; see §4.3):

| Attribute   | Governs                                          | Typical check example                     |
|-------------|--------------------------------------------------|-------------------------------------------|
| **Body**    | HP, physical durability, body-cultivation speed | Resist poison, survive a fall             |
| **Mind**    | Insight generation, comprehension speed         | Understand a manual, solve a riddle       |
| **Spirit**  | Qi capacity, soul-cultivation speed              | Sense qi, resist mental attacks           |
| **Agility** | Action order, evasion, reaction checks          | Dodge an ambush, flee                     |
| **Charm**   | Social checks, faction standing                 | Convince a master, seduce, intimidate     |
| **Luck**    | Variance modifier (see §5.3)                    | Floor/ceiling on all other checks         |

Rolled at birth. Each starts at a base value determined by `Anchor` (§7.4), then modified by `SpiritRoot`, `SoulEchoes`, and random ±5 jitter.

### 3.2 Spirit Roots

Rolled once at birth on a 1d10,000:

| Roll range    | Tier            | Qi absorption mult | Breakthrough mult | Notes                                  |
|---------------|-----------------|--------------------|-------------------|----------------------------------------|
| 0 – 9,499     | **None**        | 0.00×              | impossible        | Cannot cultivate qi without a Heaven-Stealing artifact. ~95% of mortals. |
| 9,500 – 9,899 | **Mottled**     | 0.30×              | 0.5×              | Trash root. Can cultivate, but caps at Qi Condensation without exotic aid. |
| 9,900 – 9,989 | **Single Element** | 1.00×           | 1.0×              | Standard sect-eligible root.           |
| 9,990 – 9,998 | **Dual Element** | 1.30×             | 1.1×              | Prodigy tier.                          |
| 9,999         | **Heavenly Root** | 2.00×            | 1.3×              | Once per ~10,000 rolls. Three named variants, randomly chosen when rolled. |

Karmic upgrades (§7.1) shift the distribution by raising the lower bounds — e.g. "Awakened Soul I" re-rolls on result < 9,500 with probability 10%.

Named Heavenly Roots (randomly picked on 9,999):
- **Frostfire Root** — dual-aspect, ignores elemental opposition penalty.
- **Heart of the Severed Dao** — cultivates on insight alone, no qi needed for breakthroughs.
- **Hollow Root** — caps at Nascent Soul, but every breakthrough is guaranteed.

### 3.3 Meridians

Twelve meridians, each a binary state: **closed** or **open**. Opening a meridian is a **one-shot, run-time event** gated behind qi cost + insight cost + deviation risk.

| # | Meridian           | Element | Body modifier  | Technique affinity     | Unlock risk |
|---|--------------------|---------|----------------|------------------------|-------------|
| 1 | Lung               | Metal   | +Body          | Breath arts            | Low         |
| 2 | Large Intestine    | Metal   | +Body          | Defensive              | Low         |
| 3 | Stomach            | Earth   | +Body, +HP     | Body cultivation       | Low         |
| 4 | Spleen             | Earth   | +Spirit        | Qi refinement          | Medium      |
| 5 | Heart              | Fire    | +Spirit, +Charm| Sword arts, fire       | High        |
| 6 | Small Intestine    | Fire    | +Agility       | Speed arts             | Medium      |
| 7 | Bladder            | Water   | +Body, +Spirit | Healing                | Low         |
| 8 | Kidney             | Water   | +Spirit, +Mind | Water, healing, longevity | High     |
| 9 | Pericardium        | Fire    | +Spirit        | Dual-aspect fire       | High        |
| 10| Triple Burner      | Fire    | +Qi capacity   | Qi circulation         | Very High   |
| 11| Gallbladder        | Wood    | +Charm, +Body  | Wind/wood arts         | Medium      |
| 12| Liver              | Wood    | +Mind, +Spirit | Insight, wood          | Medium      |

**Deviation roll** (per attempt):

```
deviationChance = meridianBaseRisk
                  - (Mind × 0.5)
                  - (technique_guide_bonus)
                  - (master_supervision_bonus)
                  + (impatience_penalty)
                  + (notice_penalty)
```

On deviation: outcomes scale with severity — stall (3 months lost), scar (permanent -10% to that meridian's element), internal injury (HP cap -30%), cripple (close one already-open meridian), **death**.

**Opening order matters.** The first three meridians opened define the character's **Core Path** (§4.4), which unlocks technique trees.

### 3.4 Spirit-Sense & Insight

Two derived resources:

- **Qi** — fuel for techniques and breakthroughs. Capacity = `Spirit × (1 + openMeridians × 0.15) × rootMultiplier`.
- **Insight** — accumulated understanding. Spent on breakthroughs, meridian openings, memory manifestation. Gained from events, meditation, reading manuals, witnessing cultivation.

Insight has a hard cap per realm (§4.3). Overflow is lost unless the player has the "Vessel of Understanding" echo.

### 3.5 Cause-of-Death Taxonomy

Every death logs a taxonomy tag for meta-progression. Tags drive echo unlocks and bardo narrative:

`starvation`, `disease`, `old_age`, `combat_melee`, `combat_qi`, `poison`, `betrayal`, `tribulation`, `qi_deviation`, `cripple_wasting`, `suicide_ritual`, `heavenly_intervention`, `karmic_hunter`, `self_sacrifice`, `love_death`, `madness`.

---

## 4. Cultivation System

### 4.1 Realm Ladder

| # | Realm                       | Sub-layers | Lifespan cap | Gate                   | Unlocks                                         |
|---|-----------------------------|------------|--------------|------------------------|-------------------------------------------------|
| 0 | **Mortal**                  | —          | 60 yrs       | —                      | Baseline.                                       |
| 1 | **Body Tempering**          | 1–9        | 80 yrs       | Any single meridian    | Survive minor combat. Beat 3 mortals.           |
| 2 | **Qi Sensing**              | —          | 100 yrs      | Spirit Root ≥ Mottled  | Perceive qi. Can learn techniques.              |
| 3 | **Qi Condensation**         | 1–9        | 120 yrs      | Qi Sensing + 1 technique | Sect-eligible.                               |
| 4 | **Foundation Establishment**| 1–3        | 200 yrs      | **Tribulation I**      | First flight. Elder status in small sects.      |
| 5 | **Core Formation**          | 1–9        | 500 yrs      | **Tribulation II**     | Golden Core. Soul survives body for 7 days.     |
| 6 | **Nascent Soul**            | 1–3        | 1,000 yrs    | **Tribulation III**    | Can reincarnate *consciously* (meta-game unlock)|
| 7 | **Soul Transformation**     | 1–3        | 3,000 yrs    | **Tribulation IV**     | Reshape own soul. Cross regions in a breath.    |
| 8 | **Void Refinement**         | 1–3        | 10,000 yrs   | **Tribulation V**      | See karma threads.                              |
| 9 | **Immortal Ascension**      | —          | ∞            | **Tribulation IX**     | True ending: ascend, vanish, or refuse.         |

### 4.2 Cultivation Progress

Each realm has a **cultivation bar** filled by Qi + Insight. Formula:

```
cultivationGain_per_tick = baseRate
                         × rootMultiplier
                         × environmentQiDensity
                         × techniqueMultiplier
                         × (1 + openMeridiansBonus)
                         × anchorFocusBonus
                         × heavenlyNoticeMalice   // can go below 1.0
```

`baseRate` is event-specific (meditation events give the most; living life gives trickles).

### 4.3 Breakthrough Mechanics

Once the bar is full, the player can **attempt breakthrough**. Not automatic.

**Sub-layer breakthroughs** (e.g. Body Tempering 1 → 2): simple probability check, low stakes.

```
sublayerSuccessChance = 50
                      + Mind × 0.3
                      + Insight × 0.1
                      + pills × 5
                      + safeEnvironmentBonus
                      - (currentLayer × 4)    // harder at layer 7→8 than 1→2
```

Clamped to [15, 95]. Failure = 25% of bar lost, possible injury on crit fail.

**Realm breakthroughs** (Qi Cond 9 → Foundation): **Tribulation**. See §4.5.

**Insight cap per realm** (hard cap on insight pool):

| Realm                    | Insight cap |
|--------------------------|-------------|
| Mortal / Body Tempering  | 100         |
| Qi Sensing / Condensation| 300         |
| Foundation               | 800         |
| Core                     | 2,000       |
| Nascent Soul             | 5,000       |
| Soul Transformation      | 15,000      |
| Void Refinement          | 50,000      |
| Immortal                 | ∞           |

### 4.4 Core Paths (Build Identity)

The first three meridians opened lock in a **Core Path**. There are nine:

1. **Iron Mountain** (Stomach + Lung + Bladder) — body cultivator, tanky.
2. **Severing Edge** (Heart + Small Intestine + Liver) — sword cultivator, glass cannon.
3. **Still Water** (Kidney + Bladder + Spleen) — healer, longevity.
4. **Howling Storm** (Gallbladder + Lung + Heart) — wind/speed.
5. **Blood Ember** (Heart + Pericardium + Triple Burner) — demonic-adjacent, fire.
6. **Root & Bough** (Liver + Gallbladder + Spleen) — wood/poison/herbalism.
7. **Thousand Mirrors** (Liver + Spleen + Kidney) — scholar, mental arts.
8. **Hollow Vessel** (any three on same element) — pure, single-aspect mastery.
9. **Shattered Path** (three meridians, each different element) — chaos, high risk, rare synergy echoes.

Core Path determines which **Techniques** (§4.7) the character can learn at peak efficiency. Off-path techniques still work, just at reduced effect.

### 4.5 Tribulations

Five major tribulations gate realms 4, 5, 6, 7, 8. Plus **Tribulation IX** at realm 9.

Each tribulation is a **scripted pillar event** (§9.4) composed of 3–9 sequential sub-checks. No free-form choice escape — you face it or you don't attempt breakthrough.

Tribulation I (Foundation) structure (example):

| Phase            | Check attribute    | Difficulty (baseline) | Fail consequence               |
|------------------|--------------------|-----------------------|--------------------------------|
| Heart Demon      | Mind + Spirit      | 60                    | -5 insight, retry              |
| First Thunder    | Body + Spirit      | 50                    | -20% HP, continue              |
| Second Thunder   | Body + Spirit      | 65                    | -40% HP, continue              |
| Third Thunder    | Body + Spirit      | 80                    | **Death**                      |
| Heart's Reward   | Mind               | 40                    | Reduce Foundation bonus        |

Failing any mandatory phase kills the character (unless Nascent Soul+ protection exists). Difficulty is modified by Heavenly Notice: each 10 Notice adds +3 to all tribulation difficulties of tier ≥ II.

### 4.6 Qi Deviation

Triggered by: over-cultivation, opening meridians unguided, techniques misused, emotional disturbance during cultivation, forced breakthrough.

Five severity tiers: **Tremor**, **Scar**, **Cripple**, **Rend**, **Shatter** (Shatter = always death).

Deviation is a core source of tragic deaths and of the soulslike punishment model. The game must clearly telegraph deviation risk before any action that can cause it.

### 4.7 Techniques & Manuals

A **Technique** is a learned ability. A **Manual** is the in-world artifact that teaches it.

Technique attributes:
- `grade`: Mortal / Yellow / Profound / Earth / Heaven / Immortal
- `element`: one of the five + "none"
- `coreAffinity`: which Core Paths run it at full efficiency
- `qiCost`: per use
- `insightCost`: per use (rare; mostly zero)
- `effects`: structured effect list (see §9.5)

Techniques are primarily used to **modify choice-event success chances** (§5.3) — there is no combat grid. A Flame Palm technique doesn't fire in a turn queue; it adds a +X% bonus to "strike" choices, a +Y% bonus to "intimidate", and consumes qi.

### 4.8 Longevity & Old Age

Each realm extends lifespan cap. Old age triggers when `days_lived / lifespan_cap > 0.85`. At this point, **every** `EPOCH` bucket has a `1 - (1 - 0.05)^years_elapsed` cumulative death roll from natural causes. Old age is one of the most common deaths in early meta-game.

---

## 5. Choice-Event System

This is the single most important subsystem. Everything — combat, social, cultivation, mystery — resolves through it.

### 5.1 Event Selection

```ts
interface EventCandidate {
  id: string;
  weight: number;          // base weight, modified by state
  conditions: ConditionSet;
}
```

The `EventSelector` builds a candidate pool each turn by:

1. Loading all events whose hard conditions match `(region, era, realm, age, flags, openMeridians, worldState)`.
2. Computing weighted weight: `finalWeight = baseWeight × conditionBonus × repetitionPenalty × anchorBias × echoBias`.
3. Weighted-random pick using seedable PRNG (§2.1 footnote: all RNG is seed-stable for replayable bug reports).

`repetitionPenalty`: an event seen recently in this life gets a ×0.1 penalty for N turns. Across lives, a "flagship" event retains full weight (players should see Big Moments in every life).

### 5.2 Choice Structure

```ts
interface Choice {
  id: string;
  label: string;                  // player-facing text
  subtext?: string;               // "Strength · Moderate risk · +Insight"
  timeCost: TimeCost;             // §2.5 bucket
  check?: Check;                  // optional — some choices auto-succeed
  outcomes: OutcomeTable;
  preconditions?: ConditionSet;   // hide or disable if unmet
  cost?: ResourceCost;            // qi, insight, item, karma
}
```

Choices without a `check` still have `outcomes` — they may select among flavor outcomes randomly or deterministically.

### 5.3 The Probability Resolver

**The critical formula.** This is the heart of the game.

```
rawChance = base
          + Σ(statWeight_i × stat_i)
          + Σ(skillWeight_j × skill_j)
          + techniqueBonus
          + itemBonus
          + echoBonus
          + memoryBonus
          + moodBonus
          - difficultyPenalty
          - worldPenalty

luckBand  = Luck × 0.4                 // range 0 – 40

floor     = 5  + (Luck / 10)           // 5 – 15
ceiling   = 95 - (worldMalice / 5)     // typically 85 – 95

clampedChance = clamp(rawChance, floor, ceiling)

roll = d100   (seeded PRNG)

if roll <= clampedChance × critBand:   CRIT_SUCCESS
else if roll <= clampedChance:          SUCCESS
else if roll <= clampedChance + 15:     PARTIAL
else if roll >= 100 - fumbleFloor:      CRIT_FAILURE
else:                                   FAILURE
```

Where:

- `critBand = 0.15 + (Luck × 0.003)` — up to ~0.45 at max Luck.
- `fumbleFloor = max(1, 5 - Luck × 0.04)` — high Luck reduces fumble window.
- `worldMalice` — rises with Heavenly Notice + local hostile era (§8.2).

**Key properties:**
- A character with Strength 0 and Luck 100 still has ~15% floor on a "fight the bandit" check. Not zero. Stories.
- A character with maxed stats still fumbles ~1–3% of the time on hard checks. Hubris.
- Crit bands reward Luck specifically — Luck is not just "reroll chance", it's the *variance stat*, and that matters thematically.

### 5.4 Outcome Resolution

Each `Check` has an `OutcomeTable`:

```ts
interface OutcomeTable {
  CRIT_SUCCESS?: Outcome;
  SUCCESS: Outcome;
  PARTIAL?: Outcome;
  FAILURE: Outcome;
  CRIT_FAILURE?: Outcome;
}
```

If a tier is missing, the engine falls back one level toward SUCCESS or FAILURE (never silently cross the success/fail boundary).

An `Outcome` contains:
- `narrativeKey` — which narrative fragment(s) to compose for this result.
- `stateDeltas` — structured mutations (HP, qi, insight, karma, flags, inventory, relationships).
- `eventQueue` — zero or more events to force-schedule next (chains).
- `unlocks` — echoes, memories, anchors, codex entries.
- `deathFlag` — if set, transition to BARDO with logged cause.

### 5.5 Probability Transparency

Player sees `subtext` on every choice — a *qualitative* hint, never the raw %:

| Internal clampedChance | Displayed subtext |
|------------------------|-------------------|
| ≥ 85                   | *Certain*         |
| 65 – 84                | *Likely*          |
| 45 – 64                | *Even odds*       |
| 25 – 44                | *Difficult*       |
| 10 – 24                | *Grim*            |
| < 10                   | *Near-impossible* |

Rationale: players should feel texture, not optimize spreadsheets. The exact % is deliberately hidden to preserve the xianxia mood. Settings toggle can expose raw % for power users.

### 5.6 Streakbreaking

Anti-frustration: if the player has rolled FAILURE on 4 consecutive non-trivial checks, the next check silently gets a one-time +10 bonus. Logged in debug but invisible to player. Resets on any success.

Anti-greed: if the player has rolled CRIT_SUCCESS on 3 consecutive checks, `worldMalice` ticks up by +3 for 5 turns. The world notices arrogance.

### 5.7 Worked Example

Event: "The Bandit on the Road" — age 19, Body Tempering 3, Luck 42, Body 28, Agility 35.

Choice A: *Fight.*
- `statWeight`: Body × 1.2, Agility × 0.6
- `base`: 30, `difficulty`: 40 (bandit is a Body Tempering 4)
- `rawChance = 30 + 1.2×28 + 0.6×35 - 40 = 30 + 33.6 + 21 - 40 = 44.6`
- `floor = 5 + 4.2 = 9.2`; `ceiling = 95`
- `clampedChance = 44.6`
- `critBand = 0.15 + 42×0.003 = 0.276` → crit if roll ≤ 12.3
- Rolls: 7 → CRIT_SUCCESS; 35 → SUCCESS; 55 → PARTIAL; 70 → FAILURE; 98 → CRIT_FAIL
- Displayed: *Even odds*.

Choice B: *Talk your way past.*
- `statWeight`: Charm × 1.5
- `base`: 45, `difficulty`: 20 (bandit is greedy, not malicious)
- Given Charm 22: `rawChance = 45 + 33 - 20 = 58`
- Displayed: *Likely*.

Choice C: *Flee.*
- `statWeight`: Agility × 1.5
- `base`: 55, `difficulty`: 30
- `rawChance = 55 + 52.5 - 30 = 77.5`
- Displayed: *Likely*. But outcome even on CRIT_SUCCESS yields -1 month time, no reward, and a shame flag that costs 2 karma at bardo.

This is where **wisdom** beats stats: the character could flee easily, but the *bardo penalty* makes it a strategic trade. Weak character → flee is rational. Strong character → fighting pays better.

### 5.8 Check Types & Common Stat Weights

Reference table (defaults, events override):

| Check category      | Primary            | Secondary             | Typical base |
|---------------------|--------------------|-----------------------|--------------|
| Brute force         | Body × 1.2         | Agility × 0.4         | 30           |
| Melee skill         | Body × 0.8         | Agility × 0.8         | 35           |
| Qi combat           | Spirit × 1.2       | Mind × 0.4            | 30           |
| Dodge / flee        | Agility × 1.5      | Luck × 0.3            | 50           |
| Social — persuade   | Charm × 1.3        | Mind × 0.5            | 45           |
| Social — intimidate | Charm × 0.7        | Body × 0.7            | 40           |
| Social — seduce     | Charm × 1.4        | —                     | 40           |
| Deception           | Charm × 1.0        | Mind × 0.6            | 35           |
| Insight / puzzle    | Mind × 1.4         | Spirit × 0.3          | 30           |
| Resist mental       | Spirit × 1.0       | Mind × 0.8            | 40           |
| Resist poison       | Body × 1.0         | Spirit × 0.3          | 40           |
| Cultivation attempt | Spirit × 1.0       | Mind × 0.7            | 40           |
| Survival            | Body × 0.7         | Luck × 0.5            | 45           |
| Lore / scholarship  | Mind × 1.5         | —                     | 25           |

---

## 6. Narrative Composition Engine

Replaces Gemini. Hand-written skeletons + combinatorial fill + mood/realm filters.

### 6.1 Architecture

```
Event + RunState
     │
     ▼
┌─────────────────────────────────────────┐
│  1. TemplateExpander                    │
│     picks skeleton from event.text      │
│     resolves $[variable] placeholders   │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│  2. SnippetLibrary                      │
│     $[category.sub] → random snippet    │
│     weighted by tags (season, region…)  │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│  3. MoodFilter                          │
│     substitutes tone-sensitive words    │
│     based on character emotion state    │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│  4. RealmLens                           │
│     injects/adjusts perception layer    │
│     based on cultivation realm          │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│  5. NameResolver                        │
│     fills [CHARACTER], [MASTER], etc.   │
│     using stable name registry          │
└────────────────┬────────────────────────┘
                 ▼
           final text
```

All five stages are pure functions on a single `CompositionContext` — easy to test in isolation.

### 6.2 Event Template Format

Events store text as a structured tree, not a blob:

```json
{
  "text": {
    "intro": [
      "$[weather.$[SEASON].heavy] $[sensory.oppressive.1] $[timePhrase.now]."
    ],
    "body": [
      "[CHARACTER] $[action.hungry.1] as $[terrain.$[REGION].stretch] $[sensory.$[TIME].1].",
      "$[emotion.resignation.1]"
    ],
    "outro": [
      "A $[person.traveler.$[REGION].descriptor] approaches. $[dialogue.traveler.greeting.$[REGION]]"
    ]
  }
}
```

The text is an array of *lines*; the expander picks one of each (optional weights) and joins with newlines to form the rendered paragraph. Multiple lines per slot = stylistic variance without new events.

### 6.3 Snippet Library

Snippet keys are dotted paths: `weather.drought.heavy`, `emotion.resignation.1`, `terrain.yellow_plains.stretch`.

Each leaf is an array of strings (with optional weight and tag constraints):

```json
{
  "weather.drought.heavy": [
    { "text": "The sun hung like a bronze coin nailed to the sky.", "tags": ["serious"] },
    { "text": "Three moons without rain. The earth had forgotten the taste of it.", "tags": ["lyrical"] },
    { "text": "The air itself felt burned.", "tags": ["terse"] }
  ]
}
```

Selection respects active mood tags: a character in "melancholy" mood biases toward `lyrical`; a character in "rage" biases toward `terse`.

**Content volume target per phase** (see §13):

| Phase | Snippet leaves | Variants each | Rough total |
|-------|----------------|---------------|-------------|
| 1 MVP | 80             | 6             | ~480        |
| 2     | 200            | 8             | ~1,600      |
| 3     | 450            | 10            | ~4,500      |
| 4+    | 700+           | 12+           | ~8,400+     |

Permutation math: at Phase 3, a single event template with 6 snippet slots produces 10^6 = 1M surface variants.

### 6.4 Mood Filter

Mood is a computed field from the character state:

```
mood = dominantOf(
  sorrow   = recentRegrets × 2 + unreturnedDebts,
  rage     = recentBetrayals × 3 + humiliationsThisYear,
  serenity = recentMeditationEpochs × 2 + resolvedVows,
  paranoia = recentCloseDeaths × 2 + heavenlyNoticeTier,
  resolve  = recentBreakthroughs × 2 + mastershipsAcquired,
  melancholy = yearsAlone × 0.5 + wintersInSeclusion
)
```

Dominant mood drives:
- Snippet tag preference (see §6.3).
- Adjective substitution dictionary: `{ "warm": { "melancholy": "lonely", "serene": "gentle", "rage": "stifling" } }`. Applied as a post-pass on rendered text.
- Character-internal-thought injection rate (§6.6).

### 6.5 Realm Lens

Each realm has a **perception layer** that can add a sentence of interior observation to any paragraph:

| Realm            | Lens example                                                                    |
|------------------|---------------------------------------------------------------------------------|
| Mortal           | (none — literal only)                                                           |
| Body Tempering   | *"He noticed the ache in his left shoulder — a debt from last winter, unpaid."* |
| Qi Condensation  | *"The air was thick with wood-qi, the kind that made old scars itch."*          |
| Foundation       | *"Three paths opened before him — he saw them as tendrils of light."*           |
| Core             | *"He read the merchant's intent before the man spoke: greed dressed in kindness."* |
| Nascent Soul     | *"Karma gathered around the boy like smoke. Debts, all of them, inherited."*    |
| Soul Trans.      | *"The mountain was seven ages old. It had opinions."*                           |
| Void Refinement  | *"The wind carried the lamentations of seven dead kingdoms."*                   |
| Immortal         | *"He chose to see only the moment. It was still too much."*                     |

The lens injects 0–1 interior sentence per event, rate scaling with realm. At Mortal, 0%. At Void+, 80%. Gives realm progression *tangible prose feedback*.

### 6.6 Interior Thought Grammar

Alongside realm lens, a **interior beat** system injects a short reflective sentence after ~30% of events. Template:

```
"[CHARACTER] $[reflection.mood.$[REALM].1]"

e.g.:
"Lin Wei understood, then, that patience was a kind of cultivation no sect could teach."
```

Rate scales with Mind and with the mood's lyrical bias.

### 6.7 Name Generation

Name pools are **stable within a life** — the same NPC must be called the same name across turns.

Algorithm: `NameRegistry` maps `(archetype, slotId)` → name. Generated on first reference, cached.

Generators per type:

- **Personal name (Chinese-inspired)**: `[family_name_pool][given_name_syllable_1][given_name_syllable_2?]`. Example pools hand-curated, ~200 family names × ~400 given-name syllables = 64k combinations.
- **Courtesy name (zi)**: `[zi_prefix][zi_virtue]`.
- **Sect name**: `[adjective_lofty] [element/object] [sect_suffix]`. Example: "Azure Cloud Sword Sect", "Nine Mists Valley", "Void Lotus Pavilion".
- **Place name**: `[geographic_prefix] [feature] [poetic_suffix?]`. Example: "Cold Iron Peak", "The Nine-Hundred-Steps Gorge".
- **Technique name**: `[element/motion] [body_part/object] [verb_noun]`. Example: "Frost Palm Severing", "Crimson Spear That Crosses the River".
- **Manual name**: `[adjective_ancient] [element/concept] [manual_suffix]`. Example: "Scripture of the Silent Waters".
- **Era title**: `[virtue/calamity] [ruler_rank]`. Example: "The Silent Sovereign's Reign", "The Bone Emperor's Third Year".

### 6.8 Time-Skip Prose

EPOCH-bucket events demand time-skip prose. Dedicated template category:

```
"Three winters passed in the hut. $[montage.seclusion.1] $[montage.seclusion.2]. When [CHARACTER] opened the door again, the plum tree had died."
```

~30 montage snippets seeded at MVP, ~150 at Phase 3.

### 6.9 Bardo Composition

Bardo text is its own composition pipeline — more ceremonial, fixed structure:

```
In the [YEAR]th year of the [EMPEROR], [CHARACTER] died at the age of [AGE].
Realm: [REALM].
Cause of death: $[death.[CAUSE].1]
$[regrets.summary.1]
```

Hand-written per cause tag, with ~5 variants each. Realm-gated variants (a Core Formation death is narrated more grandly than a peasant's).

### 6.10 Determinism Contract

Given identical `(event, RunState, seed)`, the composer MUST return identical text. This is required for save/load and bug reporting. PRNG calls inside the composer use a derived seed: `derivedSeed = hash(runSeed, turnIndex, eventId)`.

---

## 7. Meta-Progression

Five systems that persist across lives. This is what makes the game a *reincarnation* game and not just a roguelike.

### 7.1 Karmic Insights (Soft Currency)

Integer. Earned on death, spent at Bardo.

**Earn rates** (accumulate during life, commit on death):

| Source                                 | Karma |
|----------------------------------------|-------|
| Living 10 years                        | +1    |
| Reaching new realm (per realm)         | +10 × realm index |
| Opening first meridian (lifetime first)| +5    |
| First breakthrough of a realm (ever)   | +25 × realm index |
| Surviving a tribulation                | +50 × tribulation tier |
| Dying with unfulfilled vow             | +15 per vow |
| Dying protecting another               | +30   |
| Dying in betrayal                      | +20   |
| Dying to old age, peacefully           | +5    |
| Dying by tribulation                   | +40   |
| Achievement: first time event X        | variable (5–100) |

**Spend menu** (permanent upgrades; most tiered ×3 levels):

| Upgrade                        | Cost (L1 / L2 / L3) | Effect                                              |
|--------------------------------|----------------------|-----------------------------------------------------|
| Awakened Soul                  | 80 / 200 / 500      | Spirit-root re-roll chance on low roll: 10% / 20% / 35% |
| Cycle Memory                   | 50 / 150 / 400      | Start with 1 / 2 / 3 snippets of current region map |
| Heavenly Patience              | 100 / 300 / 800     | Starting Insight cap +20 / +50 / +100               |
| Carry the Weight               | 120 / 350 / —       | +1 / +2 starting Echo slots                         |
| Student of the Wheel           | 200 / 500 / —       | Forbidden Memory recall chance +25% / +50%          |
| Faded Name                     | 150 / 400 / —       | Starting Heavenly Notice -5 / -10                   |
| Open Eye                       | 300 / —             | Reveal raw probabilities in choices (toggle)        |
| Chain of Vows                  | 250 / —             | Vows made in previous life carry forward until fulfilled |
| Anchor unlock: varies          | 100–800             | (alt: some anchors unlock via action, not currency) |

**Important:** Awakened Soul does NOT guarantee a good root. It increases the probability of *re-rolling* a bad one. This matters for the lore: you can't buy your way out of being nobody, you can only improve the odds.

### 7.2 Soul Echoes (Inherited Traits)

Echoes are **conditionally-unlocked** passive traits that randomly manifest at rebirth.

**At birth**, the player rolls N echoes from their unlocked pool, where N is determined by:

```
echoSlots = 1                            // baseline
          + karmicUpgrade("Carry the Weight")   // +0 / +1 / +2
          + floor(heavenlyNotice / 25)          // +0 .. +4
```

Hard cap: 6 slots. Notice tier 100 = Awakening-grade character.

**Echo structure:**

```ts
interface SoulEcho {
  id: string;
  name: string;
  tier: "fragment" | "partial" | "full";
  unlockCondition: Condition;          // how to earn it
  effects: EffectList;                 // stat mods, resolver bonuses, event triggers
  conflicts: string[];                 // incompatible echo IDs
  reveal: "birth" | "trigger";         // when the player learns they have it
}
```

**Canonical echo roster (MVP + early):**

| Echo                 | Unlock condition                           | Effect                                       |
|----------------------|--------------------------------------------|----------------------------------------------|
| Iron Body            | Reached Body Tempering 5                   | +20% HP, +10% body-cultivation rate          |
| Sword Memory         | 100+ sword-category choices selected       | +15 melee, unlocks "sword intuition" check   |
| Doctor's Hands       | 50+ heal events performed                  | +30% heal efficacy, +5 herb-lore             |
| Cold Resolve         | Resisted 10 temptations                    | -10% mood swing amplitude                    |
| Demonic Whisper      | Survived cult encounter                    | +10% demonic-technique comprehension; cult events +1 weight |
| Regret of the Unspoken | Died with unfulfilled vow              | +15 Charm; starting insight +10              |
| Farmer's Eye         | 5+ lives as peasant, max age reached       | +20% survival checks, detect weather shifts  |
| Ghost in the Mirror  | Died in same region 3 consecutive lives    | Karmic Imprint encounters +100% rate         |
| Hollow Teacher       | Cultivated to Foundation with zero techniques | +25% meridian-opening insight                |
| Patience of Stone    | Lived ≥ 90 years in a single life          | -20% old-age death roll                      |
| Vessel of Understanding | Hit insight cap in 3 lives             | Insight overflow preserved (up to +50)       |
| Blood Remembers      | Died to karmic hunter                      | Spot hunters before they strike (event weight) |

Phase 3+ expands to ~40 echoes total.

**Conflict rule:** incompatible echoes (e.g. *Cold Resolve* vs *Wildfire Heart*) can never appear together. Roll resolves conflicts by dropping the later-rolled echo and re-rolling.

### 7.3 Forbidden Memories (Cultivation Art Library)

Every Technique the character *witnesses* in a life gets logged. In future lives, the character may *remember* it.

**Logging rule:** an event outcome can declare `"witnessMemory": "TECH_ID"`. Witnesses count once per life. Seeing the same technique three times across three lives upgrades it from *Fragment* → *Partial*. Seven times → *Complete*.

**Manifestation roll (per meditation event per life):**

```
manifestChance = 2                                    // base
              + (Mind × 0.1)
              + (insight × 0.01)
              + memoryLevel × 5                       // fragment=1, partial=2, complete=3
              + karmicUpgrade("Student of the Wheel") × 25
              - notice_suppression                    // if player hid from Heavens
```

Clamped to [1, 60] per meditation attempt. Each life, the player can attempt up to 3 meditation-recalls.

On success, the character "dreams" a technique. Partial memories yield a partial technique (e.g. 50% effect, unable to upgrade to mastery). Complete memories give the technique at Novice rank, with full upgrade path available.

**Manifestation cost:** if realised in a life with insufficient meridians/realm, technique is learned but unusable until requirements met.

### 7.4 Reincarnation Anchors

An **Anchor** is a spawn template. Determines starting:
- Region (possibly with sub-location bias)
- Year (era window)
- Age (most are 6–16; some are 0 or even "before birth")
- Family tier (peasant → imperial)
- Starting attribute distribution
- Starting inventory
- Starting known facts (flags)
- Karma multiplier

**Default anchor:** *True Random*. Max karma multiplier (×1.5), rolls everything.

**Standard roster:**

| Anchor              | Unlock                                    | Spawn                                    | Karma mult |
|---------------------|-------------------------------------------|------------------------------------------|------------|
| True Random         | default                                   | Random region, random year, mortal family | ×1.5       |
| Peasant Farmer      | default                                   | Yellow Plains, poor family, age 10–14    | ×1.0       |
| Martial Family      | Reach Body Tempering 5 (1 life)          | Yellow Plains / Northern Wastes, age 8   | ×0.9       |
| Scholar's Son       | Read 10+ tomes in one life                | Imperial Capital, age 10                 | ×0.9       |
| Outer Disciple      | Befriend a sect disciple                  | Azure Peaks, age 15, outer sect          | ×0.8       |
| Cult Initiate       | Die to a demonic cultivator               | Bone Marshes, age 14, cult               | ×1.1       |
| Sworn Sibling       | Die for love                               | Random region, has named "elder sibling" NPC | ×1.2    |
| Hermit's Apprentice | Meet a hermit master                      | Northern Wastes, age 12, lonely          | ×1.0       |
| Beggar's Ward       | Receive charity 20+ times across lives    | Imperial Capital, age 10, homeless       | ×1.3       |
| Second-Born Cursed  | Be killed by a sibling                    | Any region, age 7, has hostile sibling NPC | ×1.1     |
| Ashes of a Dead Sect| Watched a sect fall                       | Ruins of fallen sect, age 16, orphan     | ×1.2       |
| The Returned (endgame) | Reach Nascent Soul                    | Choose *any* anchor + keep prior memories | ×0.5    |

**Lock rule:** once an anchor is used, it's locked for that life. Can be changed between lives freely.

**Phase rollout:**
- Phase 1: True Random + Peasant Farmer only.
- Phase 2: +3 anchors.
- Phase 3: +4 anchors.
- Phase 4+: endgame anchors.

### 7.5 Heavenly Notice

Integer, 0–100, persistent. **The double-edged meta stat.**

**Gain sources (per life, committed at Bardo):**

| Event                                  | Δ Notice |
|----------------------------------------|----------|
| Breakthrough Foundation                | +3       |
| Breakthrough Core                      | +8       |
| Breakthrough Nascent Soul              | +15      |
| Breakthrough Soul Transformation       | +25      |
| Surviving Tribulation                  | tier × 5 |
| Dying to Heavenly intervention         | +10      |
| Defying fate (choice flagged `fate_defiance`) | +2 |
| Embracing the Mark (single choice)     | +20, one-time |

**Loss sources:**

| Event                                          | Δ Notice |
|------------------------------------------------|----------|
| Quiet life: died in Mortal or Body Tempering   | -1       |
| Using Suppression Technique (one per life)     | -5       |
| The Forgotten Path (anchor-exclusive, long)    | -1 / decade lived |
| Karmic upgrade "Faded Name"                    | -5 / -10 baseline reduction |

**Tier effects:**

| Tier         | Range   | Effects                                                                  |
|--------------|---------|--------------------------------------------------------------------------|
| Baseline     | 0–9     | 1 echo slot, no specials                                                 |
| Awakening    | 10–24   | 2 echo slots. Rare NPC "notices something" in conversation. Minor omens. |
| Noticed      | 25–49   | 3 echo slots. **Karmic Hunters** begin appearing (elite random events). Dreams pierce lives. |
| Marked       | 50–74   | 4 echo slots. Tribulation difficulty +1 tier. Prophecy events trigger. Demonic cultivators recognise the soul. |
| Watched      | 75–99   | 5 echo slots. Heavens intervene (divine weather, unwanted mentors). Prophecy-bound NPCs hunt. |
| Heir of Void | 100     | 6 echo slots. **Ascension attempt unlocked.** Tribulation IX becomes available.   |

**Karmic Hunters:** a meta-antagonist. Appear as scripted pillars once per life once tier ≥ Noticed. Always elite checks (difficulty 60+). Defeating one = massive karma. Losing = instant death.

### 7.6 Karmic Imprints (Bloodstains)

On every death, record:

```ts
interface KarmicImprint {
  id: string;                   // `${runId}.${deathIndex}`
  regionId: string;
  localeTag: string;            // finer-grained location within region
  year: number;
  age: number;
  realm: Realm;
  cause: DeathCause;
  droppedItems: ItemRef[];
  lastWords?: string;           // if the player chose a "dying words" event
}
```

Stored in `MetaState.imprints[]`.

**Encounter rule (next life onward):**

When the character enters a `locale` with one or more imprints:

```
encounterChance = 5
                + (imprintsHere × 8)
                + (Mind × 0.3)
                + (notice × 0.2)
                - (yearsSinceImprint × 0.5)
```

Clamped [0, 60]. Rolled once per first visit.

**Encounter types:**
- **Grave Treasure** — items remain. Stat check to recover (body check for physical; none for spirit items).
- **Memory Echo** — a pillar-event replay of the death, witnessed from outside. Grants +5 insight, possible memory upgrade.
- **Ghost Self** — an apparition of the past life. Dialogue tree. Can be helpful (grants echo upgrade), hostile (combat check), or transformative (merges a fragment of the past self → flag `ghostwalker`).

### 7.7 Lineage Log

Every completed life logs a **Lineage Entry**:

```ts
interface LineageEntry {
  lifeIndex: number;                    // 1-based
  name: string;
  anchor: AnchorId;
  years: [birth, death];
  realmReached: Realm;
  cause: DeathCause;
  summary: string;                      // composed prose, ~3 sentences
  highlights: string[];                 // ["Witnessed the fall of Moon Pavilion Sect"]
  karmaEarned: number;
  noticeDelta: number;
  echoesRevealed: string[];
}
```

Displayed in the Lineage screen (§11.7) as a scroll. Cross-life meta-puzzles and storylines derive from scanning lineage — a callback event in life 34 might reference lineage[12].highlight[2].

### 7.8 Cross-Life Mystery Threads (Puzzle Layer)

**This is what delivers the "puzzle, mind-bending" tone.** Separate from standard progression: a hand-authored set of **Threads** that span lives.

A **Thread** is a directed graph of pillar events tagged with preconditions that span lives. Example Thread "The Sevenfold Betrayal":

```
Life N:    ee_betrayal_witnessed       → thread_step = 1
Life N+k:  ee_betrayer_reborn          → thread_step = 2  (condition: prev.thread_step >= 1)
Life N+m:  ee_recognise_the_pattern    → thread_step = 3
...
Life N+z:  ee_seven_betrayals_resolved → thread complete, unlock "Severed Karma" echo
```

Threads run independently of main progression. Completing one grants special echoes and often narrative payoff (e.g. an NPC remembers you across lives — the cultivation equivalent of *"haven't I seen you before?"* but **they have actually met you, three lives ago, when you were someone else**).

**Target counts:**
- Phase 1: 0 threads.
- Phase 2: 2 threads.
- Phase 3: 6 threads.
- Phase 4: 15 threads.
- Phase 5: 30 threads + one grand Thread culminating in Ascension.

---

## 8. World & Era System

### 8.1 Regions

Six regions. Static geography; event pools + faction state rotate per era.

| ID                | Name              | Qi density | Starting vibe                                    |
|-------------------|-------------------|------------|--------------------------------------------------|
| `yellow_plains`   | Yellow Plains     | 0.4×       | Peasant farmland, war-torn, mortal-heavy         |
| `azure_peaks`     | Azure Peaks       | 1.5×       | Sect heartland, cultivators everywhere           |
| `bone_marshes`    | Bone Marshes      | 0.8×       | Demonic cult territory, corrupted qi             |
| `imperial_capital`| Imperial Capital  | 0.6×       | Political, resource-rich, mortal power           |
| `northern_wastes` | Northern Wastes   | 1.2×       | Survivalist, beast hunters, body cultivators     |
| `sunken_isles`    | Sunken Isles      | 1.8×       | Mystery, sea sects, forbidden lore               |

Each region has:

```ts
interface Region {
  id: string;
  name: string;
  qiDensity: number;
  climate: ClimateProfile;              // seasonal weights
  locales: Locale[];                    // sub-locations: "western hamlet", "wolf pass"
  factionSlots: FactionSlot[];          // 2–4 slots filled per era
  eventPool: string[];                  // event IDs whose region constraint matches
  pillarPool: string[];                 // pillar event IDs that can trigger here
  npcArchetypes: NpcArchetype[];
  namePool: RegionNamePool;             // place-name morpheme bank
}
```

**Phase 1 delivers:** Yellow Plains fully fleshed (50+ events).
**Phase 2 adds:** Azure Peaks.
**Phase 3 adds:** Bone Marshes.
**Phase 4 adds:** Imperial Capital + Northern Wastes.
**Phase 5 adds:** Sunken Isles.

### 8.2 Era Timeline

1,000-year span, decade granularity. Major events pre-seeded.

| Year  | Event                                 | World effect                                        |
|-------|---------------------------------------|-----------------------------------------------------|
| 0     | The Heavenly Dao Severed              | All qi densities × 0.7 for 50 years; Nascent Soul+ extinct |
| 100   | First Sect War                         | Azure Peaks faction churn intensifies               |
| 250   | The Drowning of the South             | Sunken Isles formed (Sunken Isles inaccessible before this) |
| 300   | Demonic Incursion                      | Bone Marshes cult gains power; Karmic Hunters +  |
| 500   | Imperial Founding                      | Imperial Capital era begins                         |
| 650   | The Plague of Stilled Breath           | Mortal lifespans capped at 50 for 30 years; disease events + |
| 700   | The Silent Century                     | Cultivator population drops by half; techniques lost → more Forbidden Memories harvestable |
| 900   | The Returning                          | Lost techniques resurface                           |
| 1,000 | Present (default player era)           | Baseline world state                                |

Each life lands in year `rollYear()` which defaults to `1000 ± d100` biased by anchor. The Returned anchor lets player pick exact year.

### 8.3 Factions

Factions are **era-local**: a faction that existed in year 300 may be gone by year 700.

```ts
interface Faction {
  id: string;
  name: string;
  type: FactionType;       // sect | cult | clan | government | rogue_band
  region: string;
  era: EraWindow;          // [startYear, endYear]
  power: number;           // 0–100
  state: "rising" | "dominant" | "declining" | "fallen";
  values: FactionValues;   // alignment on axes: order/chaos, light/dark, etc.
  relationships: FactionRelation[];
  eventHooks: string[];    // events keyed on this faction
}
```

Faction state affects NPC generation, event pool, and player options (join, challenge, betray). The player's actions in one life can affect faction state in later lives — e.g. killing an elder weakens the sect, pulling its "decline" date earlier.

**Phase 1:** hardcoded faction per region.
**Phase 2+:** faction state machine with cross-life persistence.

### 8.4 NPC System

NPCs are **archetype + instance**. Archetype is a template in `/content/npcs/`. Instance is a (seed, archetype, nameId) triple that gets promoted to a full NPC only when referenced.

Persistent NPCs (masters, recurring characters) live in `MetaState.npcs` with their memory of the character across lives. A master met in life 12 might recognise the character's *soul* in life 34 — trigger special dialogue.

---

## 9. Content Data Schemas

All content lives as JSON in `src/content/`. Schemas validated at build time via zod (recommended) or a hand-rolled validator.

### 9.1 Event

```ts
interface EventDef {
  id: string;                           // "EV_PEASANT_DROUGHT_001"
  category: string;                     // "life.peasant.hardship"
  version: 1;                           // schema version, for migration
  weight: number;                       // base weight for selector
  conditions: ConditionSet;
  timeCost: TimeCost;
  text: EventText;
  choices: Choice[];
  flags?: { set?: string[]; clear?: string[] };
  witnessMemory?: string;               // optional: log seen technique
  repeat: "once_per_life" | "once_ever" | "unlimited";
}
```

### 9.2 ConditionSet

```ts
interface ConditionSet {
  minAge?: number;
  maxAge?: number;
  regions?: RegionId[];
  locales?: string[];
  realms?: Realm[];
  seasons?: Season[];
  worldFlags?: { require?: string[]; exclude?: string[] };
  characterFlags?: { require?: string[]; exclude?: string[] };
  minStat?: Partial<Record<Stat, number>>;
  maxStat?: Partial<Record<Stat, number>>;
  minNotice?: number;
  maxNotice?: number;
  requiresEcho?: string[];
  excludesEcho?: string[];
  requiresMemory?: string[];
  requiresItem?: string[];
  era?: { minYear?: number; maxYear?: number };
  customPredicate?: string;             // id of registered predicate function
}
```

### 9.3 Choice & Outcome

```ts
interface Choice {
  id: string;
  label: string;
  subtext?: string;
  preconditions?: ConditionSet;
  cost?: {
    qi?: number;
    insight?: number;
    items?: { id: string; count: number }[];
    karmaDuringLife?: number;           // reduces karma counter mid-life
  };
  check?: {
    stats: Partial<Record<Stat, number>>;     // weights
    skills?: Partial<Record<string, number>>;
    base: number;
    difficulty: number;
    techniqueBonusCategory?: string;          // e.g. "fire" → any fire-element technique's bonus applies
  };
  timeCost: TimeCost;
  outcomes: OutcomeTable;
  moodDelta?: Partial<Record<Mood, number>>;
  flagDeltas?: { set?: string[]; clear?: string[] };
}

interface Outcome {
  narrativeKey: string | string[];            // key(s) into event.text or a separate pool
  stateDeltas?: StateDeltaList;
  eventQueue?: EventQueueOp[];                // chain into specific next events
  unlocks?: {
    echoes?: string[];
    memories?: string[];
    anchors?: string[];
    codex?: string[];
  };
  witnessMemory?: string;
  moodDelta?: Partial<Record<Mood, number>>;
  noticeDelta?: number;
  karmicImprintAdjustment?: { leaveItem?: ItemRef[] };
  deathCause?: DeathCause;                    // if set: death, transition to BARDO
}
```

### 9.4 Pillar Events

Pillar events are **hand-written**, higher-weight, setpiece. Schema identical to Event but with:

```ts
interface PillarEventDef extends EventDef {
  pillar: true;
  threadId?: string;                          // cross-life Thread membership
  threadStep?: number;
}
```

### 9.5 Technique

```ts
interface Technique {
  id: string;
  name: string;
  grade: "mortal" | "yellow" | "profound" | "earth" | "heaven" | "immortal";
  element: "metal" | "wood" | "water" | "fire" | "earth" | "none";
  coreAffinity: CorePathId[];
  requires: {
    realm?: Realm;
    meridians?: number[];                     // meridian IDs required
    openMeridianCount?: number;
  };
  qiCost: number;
  insightCost?: number;
  effects: TechniqueEffect[];
  description: string;                        // in-world manual text
  rankPath?: { novice: Effect; adept: Effect; master: Effect };
}

type TechniqueEffect =
  | { kind: "choice_bonus"; category: string; bonus: number }     // e.g. "fire strike" +15
  | { kind: "qi_regen"; amount: number }
  | { kind: "insight_gain_per_meditation"; amount: number }
  | { kind: "mood_modifier"; mood: Mood; delta: number }
  | { kind: "unlock_choice"; choiceId: string };
```

### 9.6 Item

```ts
interface Item {
  id: string;
  name: string;
  type: "pill" | "manual" | "weapon" | "armor" | "talisman" | "misc";
  grade: Grade;
  stackable: boolean;
  effects: ItemEffect[];
  description: string;
  weight?: number;
}
```

### 9.7 Manual

A manual is an item that teaches a technique:

```ts
interface Manual extends Item {
  type: "manual";
  teaches: string;                           // technique id
  completeness: 0.25 | 0.5 | 0.75 | 1.0;     // partial manuals give incomplete techniques
  readerRequires: { minMind?: number; minInsight?: number };
}
```

### 9.8 Soul Echo

Defined in §7.2.

### 9.9 Forbidden Memory

```ts
interface ForbiddenMemoryDef {
  id: string;                               // same id as the technique it encodes
  techniqueId: string;
  witnessesForFragment: number;             // default 1
  witnessesForPartial: number;              // default 3
  witnessesForComplete: number;             // default 7
  manifestationFlavor: string[];            // dream/recall text variants
}
```

### 9.10 Region, Era, Faction

Defined inline in §8.1 / §8.2 / §8.3.

### 9.11 NPC Archetype

```ts
interface NpcArchetype {
  id: string;
  name: string;                             // display archetype name
  role: "master" | "rival" | "merchant" | "commoner" | "hunter" | "bandit" | "elder";
  baseStats: Partial<Record<Stat, number>>;
  baseRealm: Realm;
  dialoguePool: string[];                   // snippet keys
  namePoolId: string;
  personaTags: string[];                    // drives mood interaction
}
```

### 9.12 Anchor

```ts
interface AnchorDef {
  id: string;
  name: string;
  unlock: ConditionSet | "default";
  spawn: {
    regions: { id: string; weight: number }[];
    era: { minYear: number; maxYear: number };
    age: { min: number; max: number };
    familyTier: "outcast" | "poor" | "commoner" | "merchant" | "minor_noble" | "noble" | "royal";
    attributeModifiers: Partial<Record<Stat, [number, number]>>;  // [min, max] adjust
    startingItems: ItemRef[];
    startingFlags: string[];
  };
  karmaMultiplier: number;
  description: string;
}
```

### 9.13 Snippet Library

```ts
// File: content/snippets/<category>.json
{
  "weather.drought.heavy": [
    { "text": "The sun hung like a bronze coin nailed to the sky.", "weight": 1, "tags": ["serious", "lyrical"] },
    { "text": "Three moons without rain.", "weight": 1, "tags": ["terse"] }
  ]
}
```

### 9.14 Name Pools

```ts
// content/names/family.json
{ "pool": ["Lin", "Wang", "Zhao", "Hua", "Mo", /* ... */] }

// content/names/given_syllables.json
{ "pool": ["Wei", "Min", "Shan", "Qing", "Yuan", /* ... */], "weights": [ ... ] }
```

### 9.15 Schema Versioning

Every schema has a `version: N`. A `Migrator` applies transforms for older versions when loading. Unknown versions reject with a loud error — never silently degrade.

---

## 10. Persistence Model

### 10.1 Storage Tiers

| Storage       | Use                          | Size budget |
|---------------|------------------------------|-------------|
| `localStorage`| RunState, MetaState, settings| ≤ 1 MB      |
| `IndexedDB`   | Codex (read logs, lineage, Karmic Imprints, NPC memory) | ≤ 50 MB |

MetaState stays in `localStorage` for fast boot; large append-only logs go to IndexedDB.

### 10.2 Storage Keys

| Key            | Contents                                    |
|----------------|---------------------------------------------|
| `wdr.settings` | UI settings (font size, raw-% toggle, etc.) |
| `wdr.run`      | Current in-progress run                     |
| `wdr.meta`     | All meta-progression                        |
| (IDB) `codex`  | Codex entries                               |
| (IDB) `lineage`| Lineage log                                 |
| (IDB) `imprints`| Karmic imprints                            |
| (IDB) `npcs`   | Persistent NPC memory                       |

### 10.3 Save Shape

```ts
interface SaveEnvelope<T> {
  schemaVersion: number;
  createdAt: string;                   // ISO
  updatedAt: string;
  gameVersion: string;                 // pulled from package.json
  data: T;
}
```

All writes go through `SaveManager.save(key, data)` which wraps in an envelope and writes atomically (write to `.tmp` key, then rename).

### 10.4 Migration

```ts
interface Migration<From, To> {
  from: number;
  to: number;
  transform: (old: From) => To;
}
```

Migrations chained: loading a v1 save with a v4 engine runs 1→2→3→4. Missing any step = loud error, do not boot.

### 10.5 Run Autosave Cadence

- Auto-save on every turn end.
- Auto-save on every BARDO arrival.
- No mid-event autosave (prevents half-state).
- Manual "Save and Quit" from title menu writes and clears active run key.

### 10.6 Codex, Lineage, Imprints

Append-only stores. Never edited, only appended. Enables safe concurrent writes without locking.

---

## 11. UI / UX Spec

### 11.1 Screens

| Screen           | Phase         | Purpose                                       |
|------------------|---------------|-----------------------------------------------|
| TitleScreen      | TITLE         | New / Continue / Codex / Lineage / Settings   |
| CreationScreen   | CREATION      | Anchor → Name → Spirit Root reveal → Echo reveal → Start |
| MainScreen       | PLAYING       | Existing layout (Sidebar + StoryPanel + Choices) |
| BardoScreen      | BARDO         | Life summary → karma reveal → memory/echo reveals → spend menu → reincarnate |
| CodexScreen      | CODEX         | Library browser (tabs: Memories, Echoes, Anchors, Regions, Factions, Threads) |
| LineageScreen    | (modal)       | Scroll of past lives                          |
| MapScreen        | (modal)       | Revealed-as-you-go world map                  |
| SettingsScreen   | (modal)       | Font, reveal-% toggle, save management        |

### 11.2 Reuse Existing Components

- `StatusPanel` — extend to show open meridians, realm progress bar, Heavenly Notice tier icon.
- `StoryPanel` — keep. Add interior-thought styling (italic, indented).
- `SetupScreen` — repurpose as `TitleScreen`; creation flow is new.
- Choice card — keep. Add subtext probability-qualifier (§5.5). Add cost icons.

### 11.3 New Components

| Component          | Notes                                                                 |
|--------------------|-----------------------------------------------------------------------|
| BardoPanel         | Full-screen ceremonial layout. Slow fade, typed text, karma counter tick animation. |
| SpiritRootReveal   | Creation-time ceremonial animation. Ink-unfurling effect.             |
| EchoReveal         | Bardo + creation moment. Each echo appears as a brush-stroke card.    |
| MeridianDiagram    | Torso silhouette with 12 meridian points. Clickable when openable.    |
| CultivationBar     | Realm progress meter with sub-layer tick marks.                       |
| CodexBrowser       | Tab nav + entry list + detail pane. Search.                           |
| LineageScroll      | Vertical scroll, each entry a parchment card.                         |
| WorldMap           | SVG or canvas, six regions, only revealed nodes visible.              |
| NoticeIndicator    | Icon in sidebar. Hover shows current tier and consequences.           |
| ChoiceCard         | Existing, extended. Show: label, subtext qualifier, cost icons, precondition greying. |

### 11.4 Probability Display

Per §5.5. Default mode: qualitative only. Setting `reveal_raw_probability = true` shows `(72%)` suffix on each choice's subtext.

### 11.5 Interior Thought Rendering

Interior beats (§6.5 / §6.6) render as:

```
[indent 2em]
[italic]
[text-parchment-400]
His understanding, suddenly, was of the weight of stones.
```

Visually distinct from narrative prose. Gives realm progression a *felt* feedback.

### 11.6 Bardo Flow (exact steps)

1. Screen fades to black over 1.5s.
2. Center text appears, typed effect:
   > *In the [YEAR]th year of the [EMPEROR], [NAME] died at the age of [AGE].*
3. Pause 1.2s.
4. Cause-of-death line appears.
5. Pause 1.2s.
6. `Realm reached:` line.
7. `Regrets: N` if any.
8. Pause 2s.
9. Karma counter animates from 0 → earned_total, ticking.
10. Echoes/memories unlocked this life appear one by one, card animation.
11. Fade in spend menu.
12. Player spends karma (or skips).
13. "The Wheel turns." button.
14. Transition to CREATION.

No skippable on first death ever. Skippable after that (setting).

### 11.7 Lineage Screen

Scroll layout. Each life = one card:

```
┌─────────────────────────────────────┐
│  III — Lin Wei (年 783 – 堯 812)    │
│  Anchor: Peasant Farmer             │
│  Realm: Body Tempering 4            │
│  Cause: Qi deviation                │
│  "He tried to breathe fire without  │
│   knowing his own lungs."           │
│  + Echo: Iron Body (unlocked)       │
└─────────────────────────────────────┘
```

Cross-life references (Thread step highlights) show as marginalia icons.

### 11.8 Codex Tabs

| Tab            | Contents                                                         |
|----------------|------------------------------------------------------------------|
| Memories       | Forbidden Memories (witnessed → recalled → manifested), grouped by element |
| Echoes         | All echoes: unlocked / locked, with hint conditions              |
| Anchors        | Available anchors + unlock conditions                            |
| Regions        | Explored regions, locales, famous places                         |
| Factions       | Known factions + current known state                             |
| Threads        | Active & resolved cross-life Threads                             |
| People         | Named NPCs met across all lives, with cross-life notes           |
| Techniques     | Learned & master-rank techniques                                 |
| Items          | Discovered items                                                 |

Locked entries show as silhouettes with hint text. Reading entries costs nothing but is gated behind *ever having seen* the item in-world.

### 11.9 Visual Style

Stays with the existing ink / parchment / jade palette. Extend:
- `parchment-*` for UI chrome
- `jade-*` for emphasis, breakthroughs, echoes
- `ink-*` for backgrounds
- **New:** `ash-*` for death, bardo, imprints
- **New:** `blood-*` for demonic path, cult content, karmic hunters
- **New:** `void-*` (deep blue-black) for late-game, heavenly notice high tier

Typography: keep serif for narrative, sans for chrome. Use interior-beat italic consistently. Realm-lens passages may use slightly larger line-height to feel "slower".

### 11.10 Accessibility

- Minimum font size toggle.
- Reduced-motion: disable typing animation.
- Colorblind-safe palette option for status indicators.
- All probability qualifiers also have icons (sword, shield, tear, etc.) for non-language signalling.

---

## 12. File & Module Architecture

### 12.1 Top-Level Structure

```
/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── engine/
│   ├── content/
│   ├── state/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── utils/
├── docs/
│   └── spec/
│       └── design.md     (this file)
└── tests/
    ├── unit/
    ├── fixtures/
    └── integration/
```

### 12.2 Engine Layout

```
src/engine/
├── core/
│   ├── GameLoop.ts            orchestrator: PLAYING turn loop
│   ├── StateMachine.ts        GamePhase transitions
│   ├── RNG.ts                 seeded PRNG (xorshift), seed derivation
│   ├── EventBus.ts            internal pub/sub for cross-module hooks
│   └── Types.ts               shared primitive types
├── character/
│   ├── Character.ts           RunState character slice
│   ├── SpiritRoot.ts          roll table + tier logic
│   ├── Meridian.ts            open/close, deviation check
│   ├── Attribute.ts           clamp, mod, derive
│   ├── CorePath.ts            detection from open meridians
│   └── Mood.ts                dominant mood computation
├── cultivation/
│   ├── Realm.ts               realm enum + metadata
│   ├── CultivationProgress.ts advance, cap, bucket math
│   ├── Breakthrough.ts        sub-layer + realm breakthrough
│   ├── Tribulation.ts         pillar wrapper for tribulation flows
│   └── Technique.ts           learn, rank up, bonus lookup
├── choices/
│   ├── ChoiceResolver.ts      §5.3 formula, implemented
│   ├── OutcomeResolver.ts     tier → Outcome selection
│   ├── OutcomeApplier.ts      state mutation from Outcome
│   └── StreakTracker.ts       §5.6 anti-frustration / anti-greed
├── events/
│   ├── EventSelector.ts       pool build + weighted pick
│   ├── EventScheduler.ts      handles eventQueue, forced sequences
│   ├── ConditionEvaluator.ts  ConditionSet matching
│   └── PredicateRegistry.ts   named custom predicates
├── narrative/
│   ├── Composer.ts            top-level orchestrator
│   ├── TemplateExpander.ts    event.text → intermediate
│   ├── SnippetLibrary.ts      dotted-key → string
│   ├── MoodFilter.ts          adjective/tag filter
│   ├── RealmLens.ts           interior observation injection
│   ├── NameRegistry.ts        stable NPC names per life
│   ├── NameGenerator.ts       generators per type (§6.7)
│   └── InteriorBeat.ts        post-pass reflective sentence injector
├── world/
│   ├── Region.ts              region definitions loader
│   ├── Era.ts                 era timeline + rollYear
│   ├── Faction.ts             faction state machine
│   ├── TimelineState.ts       per-life world state snapshot
│   └── NpcArchetype.ts        archetype resolver
├── meta/
│   ├── KarmicInsight.ts       earn rules + spend catalog
│   ├── SoulEcho.ts            roll, conflict resolve, apply
│   ├── ForbiddenMemory.ts     witness log, manifest roll
│   ├── Anchor.ts              select, apply to creation
│   ├── HeavenlyNotice.ts      delta tracker, tier effects
│   ├── KarmicImprint.ts       log on death, encounter roll
│   ├── Lineage.ts             log life summary, compose summary prose
│   ├── Thread.ts              cross-life Thread state machine
│   └── MetaDelta.ts           buffered deltas, commit at BARDO
├── persistence/
│   ├── SaveManager.ts         read/write envelopes
│   ├── Migrator.ts            chain migrations
│   ├── Serializer.ts          run/meta/codex serializers
│   └── schemaVersions.ts
├── bardo/
│   ├── BardoFlow.ts           orchestrates the sequence
│   ├── LifeSummary.ts         compose summary text
│   └── BardoPresenter.ts      push events to UI
└── index.ts                   engine public surface
```

### 12.3 Content Layout

```
src/content/
├── events/
│   ├── yellow_plains/
│   │   ├── peasant_life.json
│   │   ├── banditry.json
│   │   └── disease.json
│   └── shared/
│       ├── meditation.json
│       └── generic_travel.json
├── pillars/
│   ├── tribulation_1.json
│   ├── karmic_hunter.json
│   └── threads/
│       ├── sevenfold_betrayal.json
│       └── ...
├── snippets/
│   ├── weather.json
│   ├── terrain.json
│   ├── sensory.json
│   ├── emotion.json
│   ├── time.json
│   ├── person.json
│   ├── action.json
│   ├── dialogue.json
│   ├── reflection.json
│   ├── montage.json
│   └── death.json
├── techniques/
│   ├── fire.json
│   ├── water.json
│   ├── body.json
│   └── ...
├── items/
│   ├── pills.json
│   ├── weapons.json
│   ├── armor.json
│   └── talismans.json
├── manuals/
│   └── *.json
├── echoes/
│   └── echoes.json
├── memories/
│   └── memories.json
├── anchors/
│   └── anchors.json
├── regions/
│   └── *.json
├── factions/
│   └── by_era/
├── eras/
│   └── timeline.json
├── names/
│   ├── family.json
│   ├── given_syllables.json
│   ├── zi_prefixes.json
│   ├── sect_adjectives.json
│   └── ...
└── npcs/
    └── archetypes.json
```

### 12.4 State Layer

```
src/state/
├── gameStore.ts        zustand store for RunState (current life)
├── metaStore.ts        zustand store for MetaState
├── settingsStore.ts    UI settings
└── hooks.ts            typed selectors
```

Runtime enforcement: `metaStore` exposes only `read()` during PLAYING. Writes go through `MetaDelta.queue()` and are committed by `BardoFlow.commit()`. Attempting to write directly throws in dev mode.

### 12.5 Services Layer

Replaces `services/geminiService.ts`:

```
src/services/
├── engineBridge.ts       wraps engine into the shape App.tsx expects (initializeGame/sendAction)
└── index.ts
```

`engineBridge.initializeGame(anchorId, name)` → `TurnData`
`engineBridge.sendAction(choiceId)` → `TurnData`

`TurnData` shape extends the current one:

```ts
interface TurnData {
  narrative: string;
  status: CharacterStatus;
  choices: GameChoice[];
  // new:
  interior?: string;             // realm-lens / interior beat
  cultivation: { realm: Realm; layer?: number; progress: number };
  notice: { tier: NoticeTier; value: number };
  mood: Mood;
  openMeridians: number[];
  isDead?: boolean;
  deathCause?: DeathCause;
}
```

Existing `CharacterStatus` and `GameChoice` are kept compatible; new fields are additive.

### 12.6 Hooks

```
src/hooks/
├── useGameEngine.ts
├── useTurn.ts
├── useBardo.ts
├── useCodex.ts
└── useKeyboardChoice.ts   // numeric hotkeys for choices
```

### 12.7 Utils

```
src/utils/
├── rng.ts
├── weighted.ts           weighted-random pick
├── clamp.ts
├── hash.ts               for seed derivation
├── text.ts               title case, pluralize, etc.
└── assert.ts
```

### 12.8 Tests

TDD enforced per implementation plan (§13). Categories:

- `tests/unit/engine/choices/ChoiceResolver.test.ts` — the formula (§5.3), dozens of edge cases.
- `tests/unit/engine/character/SpiritRoot.test.ts` — distribution.
- `tests/unit/engine/narrative/Composer.test.ts` — determinism contract.
- `tests/unit/engine/meta/SoulEcho.test.ts` — conflict resolution, slot count.
- `tests/unit/engine/events/EventSelector.test.ts` — weighting, repetition penalty.
- `tests/integration/life_flow.test.ts` — birth → death → bardo full cycle with seeded state.
- `tests/integration/migration.test.ts` — v1 saves load into latest.
- `tests/fixtures/` — canonical seeded runs for regression.

Testing lib: **vitest** (Vite-native), plus zod (or similar) for schema validation at test boot.

### 12.9 Naming & Typing Conventions

- Types: PascalCase. Enums: PascalCase, members `UPPER_SNAKE`.
- Files: one exported thing per file when feasible. PascalCase for class-like exports, camelCase for utilities.
- JSON content keys: snake_case. IDs always `PREFIX_SNAKE_###` (e.g. `EV_PEASANT_DROUGHT_001`, `ECHO_IRON_BODY`).
- All engine modules export *pure* functions when possible. Side effects are isolated to stores, SaveManager, and BardoFlow.

### 12.10 Dependencies

Keep lean:

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "lucide-react": "^0.554.0",
    "zustand": "^4.5.0",
    "zod": "^3.23.0",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "jsdom": "^25.0.0"
  }
}
```

**Remove** `@google/genai`. No LLM in v2.

### 12.11 Engine Public Surface

The engine exposes a **minimal** API to React:

```ts
export interface Engine {
  // Lifecycle
  loadOrInit(): Promise<{ phase: GamePhase; turn?: TurnData }>;
  beginLife(anchorId: string, chosenName: string): Promise<TurnData>;
  chooseAction(choiceId: string): Promise<TurnData>;

  // Bardo
  beginBardo(): Promise<BardoPayload>;
  spendKarma(upgradeId: string): Promise<BardoPayload>;
  reincarnate(): Promise<CreationPayload>;

  // Codex
  getCodex(): CodexSnapshot;
  getLineage(): LineageEntry[];
  getMetaSummary(): MetaSnapshot;

  // Settings
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void;
}
```

React components talk to the engine through this interface only. Everything else is internal.

---

## 13. Implementation Phases

Each phase is a standalone milestone that produces a shippable build. Each should be planned (via `superpowers:writing-plans`) as its own implementation plan. This spec is the **source of truth** for those plans.

### Phase 0 — Foundation (~1 week)

**Deliverable:** Engine skeleton with no gameplay; foundations for everything else.

Tasks (map to writing-plans steps, not exhaustively listed here):
- Remove Gemini dependency.
- Install vitest, zod, zustand, idb.
- Scaffold directory structure per §12.
- Implement `RNG`, `EventBus`, `StateMachine`, `SaveManager` (envelope + tmp-write).
- Implement schema loaders with zod validation.
- Set up test harness + CI (GitHub Actions: `npm test` + `npm run build`).
- Write architectural smoke tests (load empty content, round-trip save).

**Exit criteria:** all tests green, `vite build` succeeds, app boots to empty TITLE screen.

### Phase 1 — The Mortal's Burden (~4 weeks)

**Deliverable:** Vertical slice. One region (Yellow Plains), one realm (Body Tempering), one anchor (Peasant Farmer), full inner loop.

- Character model: attributes, spirit root (full table), 12 meridians (structure only — opening risk simplified).
- Realms: Mortal + Body Tempering (sub-layers 1–9), sub-layer breakthrough only.
- Choice resolver (§5.3) full implementation.
- Event selector (§5.1) with conditions.
- Composer MVP: TemplateExpander + SnippetLibrary + NameRegistry (**MoodFilter and RealmLens stubbed**).
- Content: 50+ Yellow Plains events, 80 snippet leaves (§6.3 target).
- Simple bardo flow: life summary + 5 karmic upgrades + reincarnate.
- Karmic Insights (basic).
- 2 anchors: True Random, Peasant Farmer.
- Save/load: run + meta via `localStorage`.
- UI: TitleScreen, CreationScreen (minimal), reuse StoryPanel, basic BardoPanel.

**Explicitly OUT of Phase 1:** echoes, forbidden memories, heavenly notice, karmic imprints, tribulations, multiple regions, mood filter, realm lens.

**Exit criteria:**
- Player can: start → peasant life → die → bardo → spend karma → reborn → another life.
- At least 5 distinguishable deaths (starvation / disease / bandit / qi deviation / old age).
- Karma earned and spent affects the next life (provable by test).

### Phase 2 — The Wheel Turns (~4 weeks)

**Deliverable:** Meta-progression feels real. Two regions, more anchors, real reincarnation mechanics.

- Soul Echoes: 10 echoes, roll at birth, conflict resolution, effects applied.
- Forbidden Memories: 10 techniques, witness logging, manifestation roll (§7.3).
- Reincarnation Anchors: +3 (Martial Family, Scholar's Son, Outer Disciple).
- Realms: add Qi Sensing + Qi Condensation 1–9.
- Region: Azure Peaks.
- Techniques: 10 basic, integrated with choice resolver.
- Core Paths: detection + bonus application.
- MoodFilter (§6.4) implemented.
- RealmLens v1 (§6.5) for realms Mortal → Qi Condensation.
- Snippet library expands to 200 leaves.
- Codex screen: Memories, Echoes, Anchors tabs.
- Lineage screen.

**Exit criteria:**
- A Life N+1 character inherits echoes from Life N in a reproducible way.
- Forbidden Memory witnessed in Life N can manifest in Life N+5.
- Core Path detection affects at least 5 choice resolvers.

### Phase 3 — The Heavens Notice (~6 weeks)

**Deliverable:** Full soulslike stakes. Tribulations. Cross-life threads.

- Heavenly Notice (§7.5) full system.
- Karmic Imprints (§7.6).
- Karmic Hunters (pillar encounter).
- Tribulation system: Tribulation I + II scripted.
- Realms: Foundation 1–3, Core 1–9.
- Region: Bone Marshes.
- Pillar events: 50 hand-written.
- Cross-life Threads: 6 authored Threads (§7.8).
- Codex: add Regions, Factions, Threads tabs.
- World map.
- Full Mood/Realm lens (realm-extended).
- Snippet library: 450 leaves.

**Exit criteria:**
- Tribulation I survivable (and killable).
- A Thread seeded in one life can be advanced in a later life.
- Karmic Imprint encountered reproducibly from a prior death.
- World map reveals progressively across lives.

### Phase 4 — Mind Benders (~5 weeks)

**Deliverable:** Mystery/puzzle layer comes online. Remaining regions.

- Pillar puzzles: cryptic multi-life mysteries (15 Threads total).
- Memory manifestation mechanics refined (partial manuals, incomplete techniques).
- Regions: Imperial Capital, Northern Wastes.
- Realms: Nascent Soul 1–3, Soul Transformation 1–3, Tribulations III–IV.
- NPC persistence: named NPCs remember the character across lives.
- Faction state machine per-era.
- Snippet library: 700 leaves.
- Advanced interior beats, reflection system matures.

**Exit criteria:**
- At least 3 puzzles requiring information from ≥ 3 lives to solve.
- An NPC references a specific prior life accurately.
- Faction state changes persist across lives.

### Phase 5 — Ascension (~6 weeks)

**Deliverable:** Endgame. True endings.

- Region: Sunken Isles.
- Realms: Void Refinement 1–3, Immortal Ascension.
- Tribulations V, VI, VII, VIII, IX.
- Grand Thread culminating in Ascension choice.
- Multiple true endings: Ascend, Vanish, Refuse, Become the Cycle, Burn the Wheel.
- The Returned anchor.
- Secret Codex unlocks.
- Polish pass on all narrative.
- PWA packaging for offline play.

**Exit criteria:**
- All 9 realms reachable.
- All 5 true endings achievable.
- Full codex populated (some still locked behind hidden triggers — intentional).

### 13.1 Phase Handoff Rule

Each phase must ship with its full test suite passing. No phase advances until:
1. All unit tests green.
2. Integration test: full life cycle + reincarnation works.
3. Manual play-session: 3 lives back-to-back with no crash.
4. `vite build` produces a working bundle.

### 13.2 Content-Heaviness Budget

Phases 3+ are content-heavy. Two-track development recommended:
- **Engine track:** systems, resolvers, UI.
- **Content track:** event JSON, snippets, pillars, threads.

These tracks can parallelise. A content author works from this spec's §9 schemas; engine work doesn't block them after Phase 2.

---

## 14. Appendix

### 14.1 Sample Event JSON

```json
{
  "id": "EV_PEASANT_DROUGHT_001",
  "category": "life.peasant.hardship",
  "version": 1,
  "weight": 100,
  "conditions": {
    "minAge": 8,
    "maxAge": 50,
    "regions": ["yellow_plains"],
    "realms": ["mortal", "body_tempering"],
    "seasons": ["summer", "autumn"],
    "worldFlags": { "require": ["drought_active"] },
    "characterFlags": { "exclude": ["drought_survived_this_life"] }
  },
  "timeCost": "MEDIUM",
  "text": {
    "intro": [
      "$[weather.drought.heavy] $[sensory.oppressive.1]",
      "The seventh dry moon. $[terrain.yellow_plains.cracked_earth]"
    ],
    "body": [
      "[CHARACTER] had not eaten in two days. $[emotion.resignation.1]"
    ],
    "outro": [
      "A traveling [person.monk.descriptor] passes, carrying a sealed gourd of water. $[dialogue.monk.neutral_greeting]"
    ]
  },
  "choices": [
    {
      "id": "ch_beg",
      "label": "Beg the monk for water.",
      "subtext": "Charm · Grim consequence on failure",
      "timeCost": "INSTANT",
      "check": {
        "stats": { "Charm": 1.3, "Mind": 0.4 },
        "base": 35,
        "difficulty": 40
      },
      "outcomes": {
        "CRIT_SUCCESS": {
          "narrativeKey": "out.beg.crit",
          "stateDeltas": [{ "kind": "item_add", "id": "water_flask", "count": 1 }],
          "unlocks": { "codex": ["entry_traveling_monk"] }
        },
        "SUCCESS": {
          "narrativeKey": "out.beg.success",
          "stateDeltas": [{ "kind": "item_add", "id": "water_flask", "count": 1 }]
        },
        "PARTIAL": {
          "narrativeKey": "out.beg.partial",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -5 }]
        },
        "FAILURE": {
          "narrativeKey": "out.beg.failure",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -10 }]
        },
        "CRIT_FAILURE": {
          "narrativeKey": "out.beg.crit_fail",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -25 }, { "kind": "mood_delta", "mood": "sorrow", "amount": 5 }]
        }
      }
    },
    {
      "id": "ch_steal",
      "label": "Wait until dusk and take the gourd by force.",
      "subtext": "Agility · Body · High karmic cost",
      "timeCost": "SHORT",
      "check": {
        "stats": { "Agility": 1.2, "Body": 0.6 },
        "base": 30,
        "difficulty": 45
      },
      "moodDelta": { "resolve": -2, "paranoia": 3 },
      "outcomes": {
        "SUCCESS": {
          "narrativeKey": "out.steal.success",
          "stateDeltas": [
            { "kind": "item_add", "id": "water_flask", "count": 1 },
            { "kind": "flag_set", "flag": "stole_from_monk" },
            { "kind": "karma_delta", "amount": -10 }
          ]
        },
        "FAILURE": {
          "narrativeKey": "out.steal.failure",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -30 }, { "kind": "flag_set", "flag": "shamed_this_year" }]
        },
        "CRIT_FAILURE": {
          "narrativeKey": "out.steal.crit_fail",
          "deathCause": "combat_melee"
        }
      }
    },
    {
      "id": "ch_endure",
      "label": "Say nothing. Wait for the rain.",
      "subtext": "Body · Survival · Certain suffering",
      "timeCost": "LONG",
      "check": {
        "stats": { "Body": 0.9, "Luck": 0.5 },
        "base": 45,
        "difficulty": 35
      },
      "outcomes": {
        "SUCCESS": {
          "narrativeKey": "out.endure.success",
          "stateDeltas": [
            { "kind": "flag_set", "flag": "drought_survived_this_life" },
            { "kind": "insight_delta", "amount": 3 }
          ]
        },
        "FAILURE": {
          "narrativeKey": "out.endure.failure",
          "stateDeltas": [{ "kind": "hp_delta", "amount": -45 }]
        },
        "CRIT_FAILURE": {
          "narrativeKey": "out.endure.crit_fail",
          "deathCause": "starvation"
        }
      }
    }
  ],
  "repeat": "once_per_life"
}
```

### 14.2 Sample Snippet File

```json
{
  "weather.drought.heavy": [
    { "text": "The sun hung like a bronze coin nailed to the sky.", "tags": ["lyrical"] },
    { "text": "Three moons without rain. The earth had forgotten the taste of it.", "tags": ["lyrical"] },
    { "text": "The air itself felt burned.", "tags": ["terse"] },
    { "text": "Every breath tasted of dust.", "tags": ["terse"] },
    { "text": "The old farmers said the land was being punished. They did not say for what.", "tags": ["lyrical", "ominous"] }
  ],
  "sensory.oppressive.1": [
    { "text": "Even the crickets had gone quiet.", "tags": ["lyrical"] },
    { "text": "The heat was a hand pressed to the back of the neck.", "tags": ["lyrical"] },
    { "text": "There was no shade anywhere worth the walking to." }
  ]
}
```

### 14.3 Sample Technique

```json
{
  "id": "TECH_IRON_SHIRT_NOVICE",
  "name": "Iron Shirt",
  "grade": "mortal",
  "element": "none",
  "coreAffinity": ["iron_mountain"],
  "requires": { "openMeridianCount": 1 },
  "qiCost": 3,
  "effects": [
    { "kind": "choice_bonus", "category": "resist_physical", "bonus": 15 },
    { "kind": "choice_bonus", "category": "body_cultivation", "bonus": 8 }
  ],
  "description": "A breath held in the gut. A stance of the shoulder. The oldest defense a body remembers.",
  "rankPath": {
    "novice": { "bonuses": [["resist_physical", 15]] },
    "adept":  { "bonuses": [["resist_physical", 30], ["body_cultivation", 10]] },
    "master": { "bonuses": [["resist_physical", 50], ["body_cultivation", 15], ["hp_max", 30]] }
  }
}
```

### 14.4 Sample Echo Definition

```json
{
  "id": "ECHO_IRON_BODY",
  "name": "Iron Body",
  "tier": "full",
  "unlockCondition": {
    "kind": "milestone",
    "predicate": "reached_body_tempering",
    "layer": 5
  },
  "effects": [
    { "kind": "stat_add", "stat": "Body", "amount": 10 },
    { "kind": "hp_mult", "amount": 1.2 },
    { "kind": "cultivation_rate", "track": "body", "mult": 1.1 }
  ],
  "conflicts": ["ECHO_HOLLOW_VESSEL"],
  "reveal": "birth"
}
```

### 14.5 Canonical Resolver Tests

Test cases the ChoiceResolver must pass (non-exhaustive):

| Case                                      | Expected                                   |
|-------------------------------------------|--------------------------------------------|
| Body 0, Luck 0, base 30, diff 40          | ~0% but floor ≥ 5                          |
| Body 0, Luck 100, base 30, diff 40        | floor = 15, crit band = 0.45 × 15 → ~6.75  |
| Body 100, Luck 0, hard diff (100), base 30| clamped to ceiling 95                      |
| Same seed, same inputs                    | identical tier                              |
| Crit band reachable at Luck 100           | yes, CRIT_SUCCESS on roll ≤ floor × 0.45   |
| Fumble floor at Luck 0                    | 5% CRIT_FAILURE window                      |
| Fumble floor at Luck 100                  | 1% CRIT_FAILURE window                      |
| Streakbreak after 4 consecutive failures  | next check +10 (logged debug)               |
| Streak greed after 3 crits                | worldMalice += 3 for 5 turns                |

### 14.6 Death-Cause Taxonomy (Complete)

```
starvation
disease
old_age
combat_melee
combat_qi
poison
betrayal
tribulation
qi_deviation
cripple_wasting
suicide_ritual
heavenly_intervention
karmic_hunter
self_sacrifice
love_death
madness
drowning
childbirth          (for female-anchor NPC deaths; reserved)
beast
demonic_corruption
```

### 14.7 Edge Cases (Explicit)

| Case | Resolution |
|------|------------|
| Character dies before Age 10 | Bardo still runs. Karma is earned based on realm + cause. Echo reveals only if unlocked in this life. |
| Character has 0 meridians open and hits Qi Sensing threshold | Cannot progress further. `stalled` flag set. Mind + Insight gain continues. |
| Tribulation triggered with no techniques | Extra -15 to all tribulation checks. Game logs a unique echo candidate: `Bareblood Survivor` (unlock: survive a tribulation with 0 techniques). |
| Save loaded with unknown schema version | Hard error. Player offered: "Backup & reset" (not "silently drop"). |
| Spirit Root None + Heaven-Stealing Artifact | Can cultivate. Absorption mult = artifact-specific (usually 0.5× to 0.8×). Artifact consumed on Foundation breakthrough. |
| Two echoes that both modify the same stat | Stack additively for flat bonuses, multiplicatively for mults. Cap Body at 150 (soft cap; more exerts self-cultivation cost penalty). |
| Cross-life Thread whose NPC dies in a life | Thread advances to special step "Witness Lost". Some Threads branch; others abort. Authoring requirement: every Thread declares its failure branches. |
| Player uses "Suppression Technique" during a life with Heavenly Notice 0 | Still consumed. Notice goes to -5 (temporary floor 0). Used for Forgotten Path anchor synergy. |
| Bardo skip setting enabled, first death | Setting ignored on first death. Full ceremony plays. |
| Two concurrent reads of MetaState | Not possible. Everything runs on the main thread. If Web Worker added later, require a lock model. |

### 14.8 Probability Formula Canonical Reference

One place, for direct implementation reference:

```
function resolveCheck(check, character, world, seed): OutcomeTier {
  const rawChance =
      check.base
    + sumWeightedStats(check.stats, character.stats)
    + sumWeightedSkills(check.skills, character.skills)
    + techniqueBonus(check, character.techniques)
    + itemBonus(check, character.inventory)
    + echoBonus(check, character.echoes)
    + memoryBonus(check, character.memories)
    + moodBonus(check, character.mood)
    - check.difficulty
    - world.malice;

  const floor   = 5  + character.stats.Luck / 10;
  const ceiling = 95 - world.malice / 5;

  const clampedChance = clamp(rawChance, floor, ceiling);

  const critBand    = 0.15 + character.stats.Luck * 0.003;
  const fumbleFloor = Math.max(1, 5 - character.stats.Luck * 0.04);

  const roll = seededD100(seed);

  if (roll <= clampedChance * critBand)       return "CRIT_SUCCESS";
  if (roll <= clampedChance)                   return "SUCCESS";
  if (roll <= clampedChance + 15)              return "PARTIAL";
  if (roll >= 100 - fumbleFloor)               return "CRIT_FAILURE";
  return "FAILURE";
}
```

### 14.9 Glossary

| Term               | Meaning                                                                  |
|--------------------|--------------------------------------------------------------------------|
| **Life**           | One instance of a character from birth to death.                         |
| **Run**            | Equivalent to Life (roguelike terminology).                              |
| **RunState**       | Everything about the current life.                                       |
| **MetaState**      | Everything that persists across lives.                                   |
| **Realm**          | One of the 9 tiers of cultivation.                                       |
| **Meridian**       | One of 12 qi-conduits. Opened = unlocked.                                |
| **Core Path**      | Build identity locked by first 3 meridians opened.                       |
| **Spirit Root**    | Innate talent for cultivation. Tiered.                                   |
| **Bardo**          | The between-lives screen / phase. Buddhist term for the liminal state.   |
| **Karmic Insight** | Soft currency, spent at bardo for permanent upgrades.                    |
| **Soul Echo**      | Passive inherited trait, rolled at birth from unlocked pool.             |
| **Forbidden Memory** | Technique witnessed in a past life, may manifest in future.            |
| **Anchor**         | Spawn template chosen at creation.                                       |
| **Heavenly Notice**| The meta stat that scales risk *and* reward across lives.                |
| **Karmic Imprint** | A persistent "bloodstain" left at a death site.                          |
| **Tribulation**    | A scripted pillar event gating realm advancement.                        |
| **Thread**         | A cross-life authored storyline with sequenced steps.                    |
| **Pillar Event**   | Hand-written high-weight setpiece event.                                 |
| **Snippet**        | A leaf-level text fragment in the composition library.                   |
| **Interior Beat**  | A reflective sentence injected post-composition based on mood / realm.   |
| **Realm Lens**     | The perception-layer sentence a high-realm character adds to narrative.  |

### 14.10 Open Design Questions (Deferred)

These are **not blockers** for Phase 1. Resolve during Phase 2/3 authoring.

1. **Dual anchors after Nascent Soul.** Should the player be able to "nudge" rebirth location? Design lean: yes, but at a karma cost that scales with notice.
2. **Gender as mechanic.** Currently treated as narrative flavor only. Some sects / events may gate on gender (e.g. all-female sects). Decide if this is a mechanic or pure flavor during Phase 3 content authoring.
3. **Relationship carry-over.** Romantic partners across lives — should they be recognizable NPCs with persistent memory? Current spec says yes (via NPC persistence), but the *weight* of those relationships (do they drive dedicated Threads?) is under-specified. Revisit in Phase 4.
4. **Multiplayer dream-links.** Explicitly cut from v2. Keep the door open in save schema: reserve a `soulLinkId` field that's always null in v2 but could enable async-multiplayer in v3.
5. **Difficulty modes.** A "merciful" mode (higher karma, gentler tribulations) vs "genuine" mode. Design lean: a single slider `heavens_weight` (0.5–1.5) applied as `worldMalice` multiplier. Ship at Phase 3+.
6. **Ascension consequences.** When a character Ascends, what happens to their lineage? Proposal: lineage is sealed, a NewGame+ option unlocks "The Returned" anchor permanently. Author concrete content at Phase 5.

---

## Document Hygiene

- **Version:** 1.0
- **Author of this draft:** Claude (collaborative with project owner)
- **Next revision trigger:** end of Phase 1 playtest; expect v1.1 revisions to §5 (probability tuning) and §6 (snippet vocabulary) based on empirical feel.
- **Implementation plans:** each phase (§13) should be broken into its own `docs/superpowers/plans/YYYY-MM-DD-<phase>.md` via the `superpowers:writing-plans` skill before coding begins.
- **Treat this document as source of truth.** Any engine behavior that diverges from this spec is a bug or a spec revision — never a silent deviation.

— End of specification.
