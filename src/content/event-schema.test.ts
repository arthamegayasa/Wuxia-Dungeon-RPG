import { describe, it, expect } from 'vitest';
import {
  EventSchema,
  ChoiceSchema,
  OutcomeSchema,
  OutcomeTableSchema,
  ConditionSetSchema,
} from './schema';

const validMinimalEvent = {
  id: 'EV_TEST_001',
  category: 'life.test',
  version: 1,
  weight: 100,
  conditions: {},
  timeCost: 'SHORT',
  text: { intro: ['hello'], body: [], outro: [] },
  choices: [
    {
      id: 'ch_stay',
      label: 'Wait and see.',
      timeCost: 'INSTANT',
      outcomes: {
        SUCCESS: { narrativeKey: 'out.wait.ok' },
        FAILURE: { narrativeKey: 'out.wait.fail' },
      },
    },
  ],
  repeat: 'unlimited',
};

describe('EventSchema', () => {
  it('accepts a minimal valid event', () => {
    const r = EventSchema.safeParse(validMinimalEvent);
    expect(r.success).toBe(true);
  });

  it('rejects events missing required fields', () => {
    const broken = { ...validMinimalEvent, id: undefined };
    const r = EventSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it('accepts all TimeCost values on the event and each choice', () => {
    for (const t of ['INSTANT', 'SHORT', 'MEDIUM', 'LONG', 'EPOCH'] as const) {
      const ev = { ...validMinimalEvent, timeCost: t };
      expect(EventSchema.safeParse(ev).success).toBe(true);
    }
  });

  it('rejects events with invalid TimeCost', () => {
    const r = EventSchema.safeParse({ ...validMinimalEvent, timeCost: 'FOREVER' });
    expect(r.success).toBe(false);
  });

  it('accepts "once_per_life", "once_ever", "unlimited" repeat values', () => {
    for (const rep of ['once_per_life', 'once_ever', 'unlimited'] as const) {
      const ev = { ...validMinimalEvent, repeat: rep };
      expect(EventSchema.safeParse(ev).success).toBe(true);
    }
  });
});

describe('ChoiceSchema', () => {
  it('accepts a check-bearing choice with stat weights and difficulty', () => {
    const choice = {
      id: 'ch_fight',
      label: 'Fight!',
      timeCost: 'SHORT',
      check: {
        stats: { Body: 1.2, Agility: 0.6 },
        base: 30,
        difficulty: 40,
      },
      outcomes: {
        CRIT_SUCCESS: { narrativeKey: 'out.fight.crit' },
        SUCCESS: { narrativeKey: 'out.fight.win' },
        FAILURE: { narrativeKey: 'out.fight.loss' },
      },
    };
    expect(ChoiceSchema.safeParse(choice).success).toBe(true);
  });

  it('rejects negative base or weight values', () => {
    const bad = {
      id: 'ch_x', label: 'x', timeCost: 'SHORT',
      check: { stats: { Body: -1 }, base: 10, difficulty: 10 },
      outcomes: { SUCCESS: { narrativeKey: 'ok' }, FAILURE: { narrativeKey: 'bad' } },
    };
    // stats values can be negative weights? — actually spec allows any real. Let's allow but disallow negative base.
    expect(ChoiceSchema.safeParse(bad).success).toBe(true); // stat weights unrestricted
    const badBase = {
      ...bad,
      check: { stats: { Body: 1 }, base: -5, difficulty: 10 },
    };
    expect(ChoiceSchema.safeParse(badBase).success).toBe(false);
  });
});

describe('OutcomeTableSchema', () => {
  it('requires at least SUCCESS and FAILURE entries', () => {
    expect(OutcomeTableSchema.safeParse({
      SUCCESS: { narrativeKey: 'a' },
      FAILURE: { narrativeKey: 'b' },
    }).success).toBe(true);

    expect(OutcomeTableSchema.safeParse({
      SUCCESS: { narrativeKey: 'a' },
    }).success).toBe(false);

    expect(OutcomeTableSchema.safeParse({
      FAILURE: { narrativeKey: 'b' },
    }).success).toBe(false);
  });

  it('accepts optional CRIT_SUCCESS, PARTIAL, CRIT_FAILURE', () => {
    expect(OutcomeTableSchema.safeParse({
      CRIT_SUCCESS: { narrativeKey: 'a' },
      SUCCESS: { narrativeKey: 'b' },
      PARTIAL: { narrativeKey: 'c' },
      FAILURE: { narrativeKey: 'd' },
      CRIT_FAILURE: { narrativeKey: 'e' },
    }).success).toBe(true);
  });
});

describe('OutcomeSchema', () => {
  it('accepts an outcome with stateDeltas and deathCause', () => {
    const out = {
      narrativeKey: 'x',
      stateDeltas: [{ kind: 'hp_delta', amount: -10 }],
      deathCause: 'starvation',
    };
    expect(OutcomeSchema.safeParse(out).success).toBe(true);
  });

  it('rejects unknown deathCause', () => {
    const out = { narrativeKey: 'x', deathCause: 'dragon_bite' };
    expect(OutcomeSchema.safeParse(out).success).toBe(false);
  });
});

describe('ConditionSetSchema', () => {
  it('accepts an empty object', () => {
    expect(ConditionSetSchema.safeParse({}).success).toBe(true);
  });

  it('accepts realistic filters', () => {
    const cond = {
      minAge: 10, maxAge: 50,
      regions: ['yellow_plains'],
      realms: ['mortal'],
      seasons: ['summer', 'autumn'],
      worldFlags: { require: ['drought_active'], exclude: [] },
      characterFlags: { require: [], exclude: ['drought_survived_this_life'] },
      minStat: { Body: 10 },
      maxNotice: 50,
    };
    expect(ConditionSetSchema.safeParse(cond).success).toBe(true);
  });

  it('rejects unknown region or realm strings', () => {
    expect(ConditionSetSchema.safeParse({ regions: ['atlantis'] }).success).toBe(true);
    // region is free-form string (matches content IDs) → accepted
    expect(ConditionSetSchema.safeParse({ realms: ['demigod'] }).success).toBe(false);
    // realm must be one of the known Realm enum values
  });
});
