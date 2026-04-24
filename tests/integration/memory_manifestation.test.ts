// Phase 2A exit criterion #2: a Forbidden Memory witnessed in Life N can
// manifest in Life N+5. Source: docs/spec/design.md §7.3, §13.
//
// Scene: Life 1 witnesses `frost_palm_severing` (fragment level, 1 witness).
// Lives 2-4 only advance `lifeCount`. Life 5 runs 3 meditation-category
// manifest attempts against a Mind-50, insight-50 character with
// Student of the Wheel L2, and we expect at least one manifest across those
// attempts. Manifest chance per attempt at this setup:
//
//   2 + Mind*0.1 + insight*0.01 + memoryLevel*5 + sotwLevel*25
// = 2 + 50*0.1 + 50*0.01 + 1*5 + 2*25
// = 2 + 5   + 0.5 + 5 + 50
// = 62.5  → clamp [1, 60] → 60
//
// Pr(at least one manifest across 3 attempts) = 1 - 0.4^3 ≈ 93.6%.
// The rollManifest RNG is seeded from (runSeed, turn); at runSeed=5 with
// turns 1/2/3 the sequence produces at least one hit, so this is deterministic.

import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { createEmptyMetaState } from '@/engine/meta/MetaState';
import { commitWitnesses } from '@/engine/meta/MemoryWitnessLogger';
import { rollManifest, MANIFEST_ATTEMPTS_PER_LIFE } from '@/engine/meta/MemoryManifestResolver';
import { MemoryRegistry } from '@/engine/meta/MemoryRegistry';
import { ForbiddenMemory } from '@/engine/meta/ForbiddenMemory';
import { loadMemories } from '@/content/memories/loader';
import memPack from '@/content/memories/memories.json';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';

describe('memory manifestation Life N → Life N+5', () => {
  it('frost_palm_severing witnessed Life 1 can manifest in Life 5', () => {
    const memories = loadMemories(memPack);
    const registry = MemoryRegistry.fromList(memories as ReadonlyArray<ForbiddenMemory>);
    let meta = createEmptyMetaState();

    // --- Life 1: witness frost_palm_severing once, commit to meta.
    meta = commitWitnesses(meta, ['frost_palm_severing']);
    expect(meta.memoriesWitnessed.frost_palm_severing).toBe(1);

    // --- Lives 2-4: lifeCount advances but no relevant witnesses accrue.
    meta = { ...meta, lifeCount: meta.lifeCount + 3 };

    // --- Life 5: boosted character + Student of the Wheel L2.
    meta = {
      ...meta,
      ownedUpgrades: ['student_of_the_wheel_1', 'student_of_the_wheel_2'],
    };

    const character = createCharacter({
      name: 'Test Life 5',
      attributes: { Body: 10, Mind: 50, Spirit: 10, Agility: 10, Charm: 10, Luck: 10 },
      rng: createRng(5),
    });
    let runState = createRunState({
      character,
      runSeed: 5,
      region: 'yellow_plains',
      year: 1050,
      birthYear: 1050,
      season: 'autumn',
    });
    // Pump insight up to 50 (fresh characters start at 0, and insight
    // feeds the manifest formula at 0.01 per point).
    runState = {
      ...runState,
      character: { ...runState.character, insight: 50 },
    };

    // Simulate 3 meditation events. Each bumps the turn (post-outcome hooks
    // would do this in-game) and then calls rollManifest.
    let manifestedAny = false;
    for (let attempt = 0; attempt < MANIFEST_ATTEMPTS_PER_LIFE; attempt += 1) {
      runState = { ...runState, turn: runState.turn + 1 };
      const result = rollManifest({ runState, meta, registry });
      runState = result.runState;
      if (result.manifested.includes('frost_palm_severing')) {
        manifestedAny = true;
      }
    }

    expect(manifestedAny).toBe(true);
    expect(runState.character.flags).toContain('remembered_frost_palm_severing');
    expect(runState.memoriesManifestedThisLife).toContain('frost_palm_severing');
    // All 3 attempts consumed.
    expect(runState.manifestAttemptsThisLife).toBe(MANIFEST_ATTEMPTS_PER_LIFE);
  });
});
