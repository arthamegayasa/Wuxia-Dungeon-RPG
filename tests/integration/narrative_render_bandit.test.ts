import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/core/RNG';
import { EventDef } from '@/content/schema';
import { createCharacter } from '@/engine/character/Character';
import { createRunState } from '@/engine/events/RunState';
import { renderEvent } from '@/engine/narrative/Composer';
import { createSnippetLibrary } from '@/engine/narrative/SnippetLibrary';
import { createNameRegistry, resolveName } from '@/engine/narrative/NameRegistry';
import { DEFAULT_NAME_POOLS, generatePersonalName } from '@/engine/narrative/NameGenerator';
import { computeDominantMood, zeroMoodInputs } from '@/engine/narrative/Mood';

const ATTRS = { Body: 28, Mind: 20, Spirit: 15, Agility: 35, Charm: 22, Luck: 42 };

const LIB = createSnippetLibrary({
  'road.open':     [{ text: 'The road was long and dry.' }],
  'sensory.dust':  [{ text: 'Dust rose with every step.' }],
  'person.bandit': [{ text: 'a bandit with a crooked grin' }],
});

const BANDIT_EVENT: EventDef = {
  id: 'EV_BANDIT',
  category: 'road.bandit',
  version: 1,
  weight: 100,
  conditions: { regions: ['yellow_plains'] },
  timeCost: 'SHORT',
  text: {
    intro: ['$[road.open] $[sensory.dust]'],
    body:  ['[CHARACTER] met [BANDIT_NAME] — $[person.bandit].'],
    outro: ['The road offered no shelter.'],
  },
  choices: [{
    id: 'ch_fight', label: 'Fight!', timeCost: 'SHORT',
    outcomes: { SUCCESS: { narrativeKey: 'a' }, FAILURE: { narrativeKey: 'b' } },
  }],
  repeat: 'unlimited',
};

describe('narrative render — bandit event end-to-end', () => {
  it('produces a paragraph containing all expected elements', () => {
    const c = createCharacter({ name: 'Lin Wei', attributes: ATTRS, rng: createRng(1) });
    const rs = createRunState({ character: c, runSeed: 42, region: 'yellow_plains', year: 1000, birthYear: 1000, season: 'summer' });

    // Pre-generate a bandit name via registry
    const rng = createRng(rs.runSeed + 1);
    const { name: banditName, registry } = resolveName(
      createNameRegistry(), 'bandit', 'road_A',
      (r) => generatePersonalName(DEFAULT_NAME_POOLS, r), rng,
    );

    const text = renderEvent(BANDIT_EVENT, {
      characterName: rs.character.name,
      region: rs.region,
      season: rs.season,
      realm: rs.character.realm,
      dominantMood: computeDominantMood(zeroMoodInputs()),
      turnIndex: rs.turn,
      runSeed: rs.runSeed,
      extraVariables: { BANDIT_NAME: banditName },
    }, LIB, registry, rng);

    expect(text).toContain('The road was long and dry.');
    expect(text).toContain('Dust rose');
    expect(text).toContain('Lin Wei');
    expect(text).toContain(banditName);
    expect(text).toContain('bandit with a crooked grin');
    expect(text).toContain('The road offered no shelter.');
  });

  it('name registry hit: same slot on re-render returns cached bandit name', () => {
    const rng1 = createRng(42);
    const { name: name1, registry: reg1 } = resolveName(
      createNameRegistry(), 'bandit', 'road_A',
      (r) => generatePersonalName(DEFAULT_NAME_POOLS, r), rng1,
    );
    const rng2 = createRng(9999);
    const { name: name2 } = resolveName(reg1, 'bandit', 'road_A',
      (r) => generatePersonalName(DEFAULT_NAME_POOLS, r), rng2,
    );
    expect(name2).toBe(name1); // cache hit even with different rng
  });

  it('mood bonus integrates with Phase 1B ChoiceResolver signature', async () => {
    // Sanity: computeMoodBonus returns a number that ChoiceResolver can consume.
    const { computeMoodBonus } = await import('@/engine/narrative/MoodBonus');
    const bonus = computeMoodBonus('rage', 'melee_skill');
    expect(typeof bonus).toBe('number');
    expect(bonus).toBeGreaterThan(0);
  });
});
