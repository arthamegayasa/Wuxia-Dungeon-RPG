import { describe, it, expect } from 'vitest';
import { runTribulationIPillar, TRIBULATION_I } from './TribulationI';
import { createCharacter } from '@/engine/character/Character';
import { createRng } from '@/engine/core/RNG';
import { Realm } from '@/engine/core/Types';

function qcNine() {
  return {
    ...createCharacter({
      name: 'x',
      attributes: { Body: 20, Mind: 20, Spirit: 20, Agility: 10, Charm: 10, Luck: 10 },
      rng: createRng(1),
    }),
    realm: Realm.QI_CONDENSATION,
    qiCondensationLayer: 9,
    cultivationProgress: 100,
  };
}

describe('runTribulationIPillar', () => {
  it('has 4 phases per spec §4.5', () => {
    expect(TRIBULATION_I.phases).toHaveLength(4);
  });

  it('non_fatal mode: 3rd thunder failure does NOT kill', () => {
    const weak = { ...qcNine(), attributes: { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 } };
    const r = runTribulationIPillar(weak, {
      rng: createRng(1),
      tribulationMode: 'non_fatal',
    });
    expect(r.deathCause).toBeUndefined();
  });

  it('fatal mode: 3rd thunder failure SETS deathCause', () => {
    const weak = { ...qcNine(), attributes: { Body: 1, Mind: 1, Spirit: 1, Agility: 1, Charm: 1, Luck: 1 } };
    for (let seed = 1; seed < 500; seed++) {
      const r = runTribulationIPillar(weak, {
        rng: createRng(seed),
        tribulationMode: 'fatal',
      });
      if (r.deathCause === 'tribulation') return;
    }
    throw new Error('no fatal outcome observed in 500 seeds');
  });

  it('all 4 phases resolved + ordered', () => {
    const strong = qcNine();
    const r = runTribulationIPillar(strong, {
      rng: createRng(1), tribulationMode: 'non_fatal',
    });
    expect(r.phaseResults).toHaveLength(4);
    expect(r.phaseResults.map(p => p.phaseId)).toEqual([
      'heart_demon', 'first_thunder', 'second_thunder', 'third_thunder',
    ]);
  });

  it('deterministic: same seed → same results', () => {
    const c = qcNine();
    const r1 = runTribulationIPillar(c, { rng: createRng(42), tribulationMode: 'non_fatal' });
    const r2 = runTribulationIPillar(c, { rng: createRng(42), tribulationMode: 'non_fatal' });
    expect(r1.phaseResults).toEqual(r2.phaseResults);
  });
});
