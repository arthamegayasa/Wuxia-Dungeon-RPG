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
    /** @deprecated superseded by targetRegion + spawnRegionFallback; retained for content-loader schema compatibility. */
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
    /** Meridians (1-12) opened at spawn. Applied via withOpenedMeridian after base construction. */
    startingMeridians: z.array(z.number().int().min(1).max(12)).optional(),
    /** Tier bias applied additively to the rolled spirit-root tier index (Phase 2B-3 application). */
    spiritRootTierBias: z.number().int().optional(),
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
  {
    id: 'martial_family',
    name: 'Martial Family',
    description: 'Born among fighters. Your first memories are of a straight back and a heavy fist.',
    unlock: 'reach_body_tempering_5',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],
      targetRegion: 'yellow_plains',
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 8, max: 8 },
      familyTier: 'commoner',
      attributeModifiers: {
        Body: [3, 10], Mind: [0, 4], Spirit: [0, 4],
        Agility: [2, 8], Charm: [0, 4], Luck: [0, 4],
      },
      startingItems: [],
      startingFlags: ['from_martial_family', 'parent_is_fighter'],
    },
    karmaMultiplier: 0.9,
  },
  {
    id: 'scholars_son',
    name: "Scholar's Son",
    description: 'Born into a house of books. Your fingers learn brush-grip before they learn to grip a fist.',
    unlock: 'read_ten_tomes_one_life',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],
      targetRegion: 'imperial_capital',
      spawnRegionFallback: 'yellow_plains',
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 10, max: 10 },
      familyTier: 'minor_noble',
      attributeModifiers: {
        Body: [0, 2], Mind: [4, 10], Spirit: [0, 4],
        Agility: [0, 4], Charm: [1, 6], Luck: [0, 4],
      },
      startingItems: [],
      startingFlags: ['literate', 'family_has_library'],
    },
    karmaMultiplier: 0.9,
  },
  {
    id: 'outer_disciple',
    name: 'Outer Disciple',
    description: 'Born poor, noticed by a sect. You sweep the halls of the stronger.',
    unlock: 'befriend_sect_disciple',
    spawn: {
      regions: [{ id: 'yellow_plains', weight: 1 }],
      targetRegion: 'azure_peaks',
      spawnRegionFallback: 'yellow_plains',
      era: { minYear: 900, maxYear: 1100 },
      age: { min: 15, max: 15 },
      familyTier: 'poor',
      attributeModifiers: {
        Body: [1, 5], Mind: [1, 5], Spirit: [1, 5],
        Agility: [0, 4], Charm: [0, 4], Luck: [2, 6],
      },
      startingItems: [],
      startingFlags: ['outer_sect_member', 'sect_id:placeholder_sect'],
    },
    karmaMultiplier: 0.8,
  },
  {
    id: 'sect_initiate',
    name: 'Sect Initiate',
    description: 'Born within the sect walls. Robes, peaks, and the smell of pill-smoke from the day you opened your eyes.',
    unlock: 'life_reached_qi_sensing',
    spawn: {
      regions: [{ id: 'azure_peaks', weight: 1 }],
      era: { minYear: 950, maxYear: 1050 },
      age: { min: 10, max: 10 },
      familyTier: 'commoner',
      attributeModifiers: {
        Body: [0, 4], Mind: [2, 6], Spirit: [2, 6],
        Agility: [0, 4], Charm: [0, 4], Luck: [0, 4],
      },
      startingItems: [{ id: 'inner_disciple_robe', count: 1 }],
      startingFlags: ['sect_disciple', 'outer_sect_roster'],
      targetRegion: 'azure_peaks',
      spawnRegionFallback: 'yellow_plains',
      startingMeridians: [7],
      spiritRootTierBias: 1,
    },
    karmaMultiplier: 0.85,
  },
];

export function getAnchorById(id: string): AnchorDef | undefined {
  return DEFAULT_ANCHORS.find((a) => a.id === id);
}
