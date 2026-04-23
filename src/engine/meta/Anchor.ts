// Anchor = spawn template. Source: docs/spec/design.md §7.4.

import { z } from 'zod';

const STAT_STRINGS = ['Body', 'Mind', 'Spirit', 'Agility', 'Charm', 'Luck'] as const;

const FAMILY_TIER_STRINGS = [
  'outcast', 'poor', 'commoner', 'merchant', 'minor_noble', 'noble', 'royal',
] as const;

export const AnchorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  unlock: z.union([z.literal('default'), z.string()]),
  spawn: z.object({
    regions: z.array(z.object({
      id: z.string(),
      weight: z.number().positive(),
    })).min(1),
    era: z.object({
      minYear: z.number().int(),
      maxYear: z.number().int(),
    }),
    age: z.object({
      min: z.number().int().nonnegative(),
      max: z.number().int().nonnegative(),
    }),
    familyTier: z.enum(FAMILY_TIER_STRINGS),
    /** Per-stat [min, max] additive modifier range applied to base. */
    attributeModifiers: z.record(z.enum(STAT_STRINGS), z.tuple([z.number(), z.number()]).optional()),
    startingItems: z.array(z.object({
      id: z.string(),
      count: z.number().int().positive(),
    })),
    startingFlags: z.array(z.string()),
    /** The region this anchor *targets* once it ships. */
    targetRegion: z.string().min(1),
    /** Fallback region while targetRegion is not loaded (Phase 2A-2/2B bridge). */
    spawnRegionFallback: z.string().min(1).optional(),
  }),
  karmaMultiplier: z.number().positive(),
});

export type AnchorDef = z.infer<typeof AnchorSchema>;

export const DEFAULT_ANCHORS: ReadonlyArray<AnchorDef> = [
  {
    id: 'true_random',
    name: 'True Random',
    description: 'Let the Heavens decide. Maximum karma gain.',
    unlock: 'default',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],
      era: { minYear: 950, maxYear: 1050 },
      age: { min: 8, max: 16 },
      familyTier: 'poor',
      attributeModifiers: {
        Body: [-5, 5], Mind: [-5, 5], Spirit: [-5, 5],
        Agility: [-5, 5], Charm: [-5, 5], Luck: [-5, 5],
      },
      startingItems: [],
      startingFlags: [],
      targetRegion: 'yellow_plains',
    },
    karmaMultiplier: 1.5,
  },
  {
    id: 'peasant_farmer',
    name: 'Peasant Farmer',
    description: 'Born into the Yellow Plains, a child of the soil. Default reincarnation path.',
    unlock: 'default',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 10, max: 14 },
      familyTier: 'poor',
      attributeModifiers: {
        Body: [0, 10], Mind: [0, 6], Spirit: [0, 4],
        Agility: [0, 6], Charm: [0, 6], Luck: [0, 8],
      },
      startingItems: [],
      startingFlags: ['peasant_birth'],
      targetRegion: 'yellow_plains',
    },
    karmaMultiplier: 1.0,
  },
];

export function getAnchorById(id: string): AnchorDef | undefined {
  return DEFAULT_ANCHORS.find((a) => a.id === id);
}
