// Karmic upgrades spent at Bardo. Source: docs/spec/design.md §7.1.

export type UpgradeEffect =
  | { kind: 'spirit_root_reroll_boost'; probability: number }
  | { kind: 'insight_cap_boost'; amount: number };

export interface KarmicUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Other upgrade IDs that must already be owned before this can be purchased. */
  requires: ReadonlyArray<string>;
  effect: UpgradeEffect;
}

export const DEFAULT_UPGRADES: ReadonlyArray<KarmicUpgrade> = [
  {
    id: 'awakened_soul_1',
    name: 'Awakened Soul I',
    description: 'On low spirit-root rolls, the Heavens give the soul a second glance. 10% re-roll chance.',
    cost: 80,
    requires: [],
    effect: { kind: 'spirit_root_reroll_boost', probability: 0.10 },
  },
  {
    id: 'awakened_soul_2',
    name: 'Awakened Soul II',
    description: '20% re-roll chance on trash roots.',
    cost: 200,
    requires: ['awakened_soul_1'],
    effect: { kind: 'spirit_root_reroll_boost', probability: 0.20 },
  },
  {
    id: 'awakened_soul_3',
    name: 'Awakened Soul III',
    description: '35% re-roll chance on trash roots. The Heavens remember you.',
    cost: 500,
    requires: ['awakened_soul_2'],
    effect: { kind: 'spirit_root_reroll_boost', probability: 0.35 },
  },
  {
    id: 'heavenly_patience_1',
    name: 'Heavenly Patience I',
    description: 'Starting Insight cap +20.',
    cost: 100,
    requires: [],
    effect: { kind: 'insight_cap_boost', amount: 20 },
  },
  {
    id: 'heavenly_patience_2',
    name: 'Heavenly Patience II',
    description: 'Starting Insight cap +50.',
    cost: 300,
    requires: ['heavenly_patience_1'],
    effect: { kind: 'insight_cap_boost', amount: 50 },
  },
];

export function getUpgradeById(id: string): KarmicUpgrade | undefined {
  return DEFAULT_UPGRADES.find((u) => u.id === id);
}
