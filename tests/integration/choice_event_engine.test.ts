import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { selectEvent } from '@/engine/events/EventSelector';
import { resolveCheck } from '@/engine/choices/ChoiceResolver';
import { resolveOutcome } from '@/engine/choices/OutcomeResolver';
import { applyOutcome } from '@/engine/events/OutcomeApplier';
import { advanceTurn } from '@/engine/events/AgeTick';
import {
  createStreakState, recordOutcome, computeStreakBonus, computeWorldMaliceBuff, tickBuff,
} from '@/engine/choices/StreakTracker';
import { resolveTechniqueBonus } from '@/engine/cultivation/Technique';

const ATTRS = { Body: 28, Mind: 20, Spirit: 15, Agility: 35, Charm: 22, Luck: 42 };

const BANDIT_EVENT: EventDef = {
  id: 'EV_BANDIT_001',
  category: 'road.bandit',
  version: 1,
  weight: 100,
  conditions: { regions: ['yellow_plains'] },
  timeCost: 'SHORT',
  text: { intro: ['A bandit blocks your path.'] },
  choices: [
    {
      id: 'ch_fight',
      label: 'Fight!',
      timeCost: 'SHORT',
      check: {
        stats: { Body: 1.2, Agility: 0.6 } as any,
        base: 30,
        difficulty: 40,
      },
      outcomes: {
        CRIT_SUCCESS: { narrativeKey: 'out.fight.crit', stateDeltas: [{ kind: 'item_add', id: 'bandit_purse', count: 1 }] },
        SUCCESS:      { narrativeKey: 'out.fight.success', stateDeltas: [{ kind: 'hp_delta', amount: -5 }, { kind: 'item_add', id: 'bandit_purse', count: 1 }] },
        PARTIAL:      { narrativeKey: 'out.fight.partial', stateDeltas: [{ kind: 'hp_delta', amount: -15 }] },
        FAILURE:      { narrativeKey: 'out.fight.fail', stateDeltas: [{ kind: 'hp_delta', amount: -30 }] },
        CRIT_FAILURE: { narrativeKey: 'out.fight.crit_fail', deathCause: 'combat_melee' },
      },
    },
  ],
  repeat: 'unlimited',
};

describe('choice-event engine — full turn cycle', () => {
  it('resolves a Bandit event end-to-end without crashing', () => {
    const c = createCharacter({ name: 'Lin Wei', attributes: ATTRS, rng: createRng(1) });
    let rs = createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' });
    let streak = createStreakState();
    const turnRng = createRng(100);

    // 1. Select event
    const ev = selectEvent([BANDIT_EVENT], {
      character: rs.character,
      worldFlags: rs.worldFlags,
      region: rs.region,
      locale: rs.locale,
      year: rs.year,
      season: rs.season as any,
      heavenlyNotice: rs.heavenlyNotice,
      ageYears: Math.floor(rs.character.ageDays / 365),
    }, [], rs.thisLifeSeenEvents, turnRng);
    expect(ev).not.toBeNull();
    expect(ev!.id).toBe('EV_BANDIT_001');

    // 2. Resolve the fight choice
    const choice = ev!.choices[0]!;
    const result = resolveCheck({
      check: choice.check,
      characterStats: rs.character.attributes,
      characterSkills: {},
      techniqueBonus: resolveTechniqueBonus([], 'melee_skill'),
      itemBonus: 0, echoBonus: 0, memoryBonus: 0, moodBonus: 0,
      worldMalice: computeWorldMaliceBuff(streak),
      streakBonus: computeStreakBonus(streak),
      rng: turnRng,
    });
    expect(['CRIT_SUCCESS','SUCCESS','PARTIAL','FAILURE','CRIT_FAILURE']).toContain(result.tier);

    // 3. Pick outcome
    const outcome = resolveOutcome(choice.outcomes, result.tier);
    expect(outcome.narrativeKey).toBeDefined();

    // 4. Apply deltas
    rs = applyOutcome(rs, outcome);
    rs = { ...rs, thisLifeSeenEvents: [...rs.thisLifeSeenEvents, ev!.id] };

    // 5. Update streak + tick buff + advance turn
    streak = recordOutcome(streak, result.tier);
    streak = tickBuff(streak);
    rs = advanceTurn(rs, choice.timeCost, turnRng);

    expect(rs.turn).toBe(1);
    expect(rs.thisLifeSeenEvents).toContain(ev!.id);
  });

  it('after 4 consecutive FAILUREs, streak bonus is active', () => {
    let streak = createStreakState();
    for (let i = 0; i < 4; i++) streak = recordOutcome(streak, 'FAILURE');
    expect(computeStreakBonus(streak)).toBe(10);
  });

  it('after 3 consecutive CRIT_SUCCESSes, world malice buff kicks in', () => {
    let streak = createStreakState();
    for (let i = 0; i < 3; i++) streak = recordOutcome(streak, 'CRIT_SUCCESS');
    expect(computeWorldMaliceBuff(streak)).toBe(3);
  });

  it('a CRIT_FAILURE outcome with deathCause sets runState.deathCause', () => {
    const c = createCharacter({ name: 't', attributes: ATTRS, rng: createRng(1) });
    let rs = createRunState({ character: c, runSeed: 1, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' });
    const choice = BANDIT_EVENT.choices[0]!;
    const outcome = resolveOutcome(choice.outcomes, 'CRIT_FAILURE');
    rs = applyOutcome(rs, outcome);
    expect(rs.deathCause).toBe('combat_melee');
  });
});
