import { describe, it, expect } from 'vitest';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { createRng } from './RNG';
import { CorePathId, MeridianId } from '@/engine/core/Types';
import { EchoTracker } from '@/engine/meta/EchoTracker';
import { MemoryRegistry, EMPTY_MEMORY_REGISTRY } from '@/engine/meta/MemoryRegistry';
import { ForbiddenMemory } from '@/engine/meta/ForbiddenMemory';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { applyPostOutcomeHooks } from './PostOutcomeHooks';

const ATTRS = { Body: 20, Mind: 50, Spirit: 15, Agility: 25, Charm: 22, Luck: 42 };

function makeEvent(category: string): EventDef {
  return {
    id: `EV_${category.toUpperCase()}`,
    category,
    version: 1, weight: 100,
    conditions: { regions: ['yellow_plains'] },
    timeCost: 'SHORT',
    text: { intro: [''], body: [], outro: [] },
    choices: [{
      id: 'ch', label: 'go', timeCost: 'SHORT',
      outcomes: {
        SUCCESS: { narrativeKey: 'ok', stateDeltas: [] },
        FAILURE: { narrativeKey: 'fail', stateDeltas: [] },
      },
    }],
    repeat: 'unlimited',
  };
}

function baseRunState() {
  const character = createCharacter({
    name: 'T', attributes: ATTRS, rng: createRng(1),
  });
  return createRunState({
    character, runSeed: 42, region: 'yellow_plains', year: 900, birthYear: 900, season: 'spring',
  });
}

/** Build a Character with optional corePath / openMeridians overrides. */
function mkCharacter(overrides: { corePath?: CorePathId | null; openMeridians?: MeridianId[] } = {}) {
  const base = createCharacter({ name: 'T', attributes: ATTRS, rng: createRng(1) });
  return {
    ...base,
    corePath: overrides.corePath !== undefined ? overrides.corePath : base.corePath,
    openMeridians: overrides.openMeridians !== undefined ? overrides.openMeridians : base.openMeridians,
  };
}

/** Build a RunState with a given character override. */
function mkRunState(overrides: { character?: ReturnType<typeof mkCharacter> } = {}) {
  const character = overrides.character ?? mkCharacter();
  return createRunState({
    character, runSeed: 42, region: 'yellow_plains', year: 900, birthYear: 900, season: 'spring',
  });
}

function memory(id: string, insightBonus = 10): ForbiddenMemory {
  return {
    id, name: id, description: '', element: 'water',
    witnessFlavour: { fragment: 'a', partial: 'b', complete: 'c' },
    manifestFlavour: 'm',
    manifestInsightBonus: insightBonus,
    manifestFlag: `remembered_${id}`,
    requirements: {},
  };
}

describe('applyPostOutcomeHooks', () => {
  it('increments echoTracker with `choice_cat.<category>` on any event', () => {
    const event = makeEvent('life.training');
    const rs = baseRunState();
    const result = applyPostOutcomeHooks({
      preRunState: rs,
      runState: rs,
      event,
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: EMPTY_MEMORY_REGISTRY,
    });
    expect(result.echoTracker.get('choice_cat.life.training')).toBe(1);
  });

  it('returns empty manifested for non-meditation events', () => {
    const event = makeEvent('life.daily');
    const rs = baseRunState();
    const result = applyPostOutcomeHooks({
      preRunState: rs,
      runState: rs,
      event,
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: EMPTY_MEMORY_REGISTRY,
    });
    expect(result.manifested).toEqual([]);
    // Manifest counters stay zero on non-meditation events.
    expect(result.runState.manifestAttemptsThisLife).toBe(0);
  });

  it('runs MemoryManifestResolver only on meditation-category events', () => {
    const event = makeEvent('meditation');
    const reg = MemoryRegistry.fromList([memory('a', 10)]);
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { a: 10 },
      // Boost manifest chance so we observe either manifest OR at minimum the attempt counter bump.
      ownedUpgrades: ['student_of_the_wheel_1', 'student_of_the_wheel_2'],
    };
    const rs = baseRunState();
    const result = applyPostOutcomeHooks({
      preRunState: rs,
      runState: rs,
      event,
      meta,
      echoTracker: EchoTracker.empty(),
      memoryRegistry: reg,
    });
    // Meditation event always spends a manifest attempt (even if roll fails).
    expect(result.runState.manifestAttemptsThisLife).toBe(1);
    // Tracker increment still happens for meditation events.
    expect(result.echoTracker.get('choice_cat.meditation')).toBe(1);
  });

  it('does NOT call MemoryManifestResolver when category is not "meditation"', () => {
    // Even with witnessed memories in meta, a non-meditation event must not
    // consume a manifest attempt — that is Task 11's sole gate.
    const event = makeEvent('life.training');
    const reg = MemoryRegistry.fromList([memory('a', 10)]);
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { a: 10 },
      ownedUpgrades: ['student_of_the_wheel_1', 'student_of_the_wheel_2'],
    };
    const rs = baseRunState();
    const result = applyPostOutcomeHooks({
      preRunState: rs,
      runState: rs,
      event,
      meta,
      echoTracker: EchoTracker.empty(),
      memoryRegistry: reg,
    });
    expect(result.runState.manifestAttemptsThisLife).toBe(0);
    expect(result.manifested).toEqual([]);
  });

  it('is immutable: neither the input runState nor the input tracker is mutated', () => {
    const event = makeEvent('meditation');
    const reg = MemoryRegistry.fromList([memory('a', 10)]);
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { a: 5 },
    };
    const rs = baseRunState();
    const tracker = EchoTracker.empty();
    const rsBefore = structuredClone(rs);
    const metaBefore = structuredClone(meta);
    applyPostOutcomeHooks({
      preRunState: rs,
      runState: rs,
      event,
      meta,
      echoTracker: tracker,
      memoryRegistry: reg,
    });
    expect(rs).toEqual(rsBefore);
    expect(meta).toEqual(metaBefore);
    expect(tracker.get('choice_cat.meditation')).toBe(0);
  });

  it('is deterministic for fixed runState + event + meta', () => {
    const event = makeEvent('meditation');
    const reg = MemoryRegistry.fromList([memory('a', 10)]);
    const meta = {
      ...createEmptyMetaState(),
      memoriesWitnessed: { a: 10 },
      ownedUpgrades: ['student_of_the_wheel_1', 'student_of_the_wheel_2'],
    };
    const rs = { ...baseRunState(), runSeed: 77, turn: 5 };
    const r1 = applyPostOutcomeHooks({
      preRunState: rs, runState: rs, event, meta,
      echoTracker: EchoTracker.empty(), memoryRegistry: reg,
    });
    const r2 = applyPostOutcomeHooks({
      preRunState: rs, runState: rs, event, meta,
      echoTracker: EchoTracker.empty(), memoryRegistry: reg,
    });
    expect(r1.manifested).toEqual(r2.manifested);
    expect(r1.runState.character.insight).toBe(r2.runState.character.insight);
  });
});

describe('PostOutcomeHooks corePathRevealed signal (Phase 2B-1 Task 13)', () => {
  it('returns non-null corePathRevealed when transition null → iron_mountain', () => {
    const preCharacter = mkCharacter({ openMeridians: [3, 1], corePath: null });
    const postCharacter = mkCharacter({ openMeridians: [3, 1, 7], corePath: 'iron_mountain' });
    const preRs = mkRunState({ character: preCharacter });
    const postRs = mkRunState({ character: postCharacter });

    const result = applyPostOutcomeHooks({
      preRunState: preRs,
      runState: postRs,
      event: makeEvent('training'),
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: EMPTY_MEMORY_REGISTRY,
    });
    expect(result.corePathRevealed).toBe('iron_mountain');
  });

  it('returns null corePathRevealed on subsequent turns (path already revealed pre-turn)', () => {
    const preCharacter = mkCharacter({ openMeridians: [3, 1, 7], corePath: 'iron_mountain' });
    const postCharacter = mkCharacter({ openMeridians: [3, 1, 7, 5], corePath: 'iron_mountain' });
    const result = applyPostOutcomeHooks({
      preRunState: mkRunState({ character: preCharacter }),
      runState: mkRunState({ character: postCharacter }),
      event: makeEvent('training'),
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: EMPTY_MEMORY_REGISTRY,
    });
    expect(result.corePathRevealed).toBeNull();
  });

  it('returns null corePathRevealed when path stays null', () => {
    const preRs = mkRunState({ character: mkCharacter({ corePath: null }) });
    const postRs = mkRunState({ character: mkCharacter({ corePath: null }) });
    const result = applyPostOutcomeHooks({
      preRunState: preRs,
      runState: postRs,
      event: makeEvent('training'),
      meta: createEmptyMetaState(),
      echoTracker: EchoTracker.empty(),
      memoryRegistry: EMPTY_MEMORY_REGISTRY,
    });
    expect(result.corePathRevealed).toBeNull();
  });
});
