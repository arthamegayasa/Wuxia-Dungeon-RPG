// Phase 1D-2 play-testing fixture. Phase 1D-3 will replace this with a real
// JSON-backed corpus of ~50 Yellow Plains events.
//
// Three minimal events so the play loop can actually exercise:
//   1. A benign "work the field" event (insight +1 / hp -2 on fail).
//   2. A training event (stat check, reward on success).
//   3. A dangerous encounter that can kill the character.

import { Choice, EventDef } from '@/content/schema';

// Zod v4 quirk (see CLAUDE.md): `z.record(enum, value.optional())` infers all
// six stat keys as required. Runtime treats missing keys as undefined; the cast
// keeps the fixture authoring terse. Mirrors `partialStats` in ChoiceResolver.test.ts.
type CheckStats = NonNullable<Choice['check']>['stats'];
const stats = (s: Partial<Record<string, number>>): CheckStats => s as CheckStats;

export const FIXTURE_EVENTS: ReadonlyArray<EventDef> = [
  {
    id: 'FX_BENIGN_DAY',
    category: 'life.daily',
    version: 1,
    weight: 100,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'SHORT',
    text: {
      intro: ['Another dawn over the plains. $[CHAR_NAME] tends the millet.'],
      body: [],
      outro: [],
    },
    choices: [{
      id: 'ch_work',
      label: 'Work the field.',
      timeCost: 'SHORT',
      outcomes: {
        SUCCESS: { narrativeKey: 'ok', stateDeltas: [{ kind: 'insight_delta', amount: 1 }] },
        FAILURE: { narrativeKey: 'tired', stateDeltas: [{ kind: 'hp_delta', amount: -2 }] },
      },
    }],
    repeat: 'unlimited',
  },
  {
    id: 'FX_TRAIN_BODY',
    category: 'training.body',
    version: 1,
    weight: 40,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'MEDIUM',
    text: {
      intro: ['$[CHAR_NAME] finds a crude stone and lifts it, again and again.'],
      body: [],
      outro: [],
    },
    choices: [{
      id: 'ch_train',
      label: 'Push through the burn.',
      timeCost: 'MEDIUM',
      check: { base: 20, stats: stats({ Body: 1 }), difficulty: 40 },
      outcomes: {
        CRIT_SUCCESS: { narrativeKey: 'peak', stateDeltas: [{ kind: 'attribute_delta', stat: 'Body', amount: 2 }] },
        SUCCESS: { narrativeKey: 'solid', stateDeltas: [{ kind: 'attribute_delta', stat: 'Body', amount: 1 }] },
        PARTIAL: { narrativeKey: 'sore', stateDeltas: [] },
        FAILURE: { narrativeKey: 'strain', stateDeltas: [{ kind: 'hp_delta', amount: -3 }] },
        CRIT_FAILURE: { narrativeKey: 'injury', stateDeltas: [{ kind: 'hp_delta', amount: -8 }] },
      },
    }],
    repeat: 'unlimited',
  },
  {
    id: 'FX_BANDIT',
    category: 'life.danger',
    version: 1,
    weight: 10,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'INSTANT',
    text: {
      intro: ['A bandit steps from the millet with a knife. No time to think.'],
      body: [],
      outro: [],
    },
    choices: [{
      id: 'ch_fight',
      label: 'Fight back.',
      timeCost: 'INSTANT',
      check: { base: 20, stats: stats({ Body: 1 }), difficulty: 75 },
      outcomes: {
        SUCCESS: { narrativeKey: 'escape', stateDeltas: [{ kind: 'hp_delta', amount: -2 }] },
        FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
        CRIT_FAILURE: { narrativeKey: 'killed', deathCause: 'combat_melee' },
      },
    }],
    repeat: 'unlimited',
  },
];
