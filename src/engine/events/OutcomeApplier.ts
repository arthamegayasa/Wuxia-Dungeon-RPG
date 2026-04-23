// Apply a resolved Outcome's StateDeltas to the current RunState.
// Pure; returns a new state.

import { Outcome } from '@/content/schema';
import { applyHp, applyQi, applyInsight, ageDays, withFlag, Character } from '@/engine/character/Character';
import { advanceCultivation } from '@/engine/cultivation/CultivationProgress';
import { RunState } from './RunState';
import { StateDelta } from './StateDelta';
import { addAttribute } from '@/engine/character/Attribute';
import { logWitness } from '@/engine/meta/MemoryWitnessLogger';

function removeFlag(c: Character, flag: string): Character {
  if (!c.flags.includes(flag)) return c;
  return { ...c, flags: c.flags.filter((f) => f !== flag) };
}

function applyDeltaToState(rs: RunState, delta: StateDelta): RunState {
  switch (delta.kind) {
    case 'hp_delta':
      return { ...rs, character: applyHp(rs.character, delta.amount) };
    case 'qi_delta':
      return { ...rs, character: applyQi(rs.character, delta.amount) };
    case 'insight_delta':
      return { ...rs, character: applyInsight(rs.character, delta.amount) };
    case 'attribute_delta': {
      const nextValue = addAttribute((rs.character.attributes as Record<string, number>)[delta.stat] ?? 0, delta.amount);
      return {
        ...rs,
        character: {
          ...rs.character,
          attributes: { ...rs.character.attributes, [delta.stat]: nextValue },
        },
      };
    }
    case 'flag_set':
      return { ...rs, character: withFlag(rs.character, delta.flag) };
    case 'flag_clear':
      return { ...rs, character: removeFlag(rs.character, delta.flag) };
    case 'world_flag_set':
      if (rs.worldFlags.includes(delta.flag)) return rs;
      return { ...rs, worldFlags: [...rs.worldFlags, delta.flag] };
    case 'world_flag_clear':
      if (!rs.worldFlags.includes(delta.flag)) return rs;
      return { ...rs, worldFlags: rs.worldFlags.filter((f) => f !== delta.flag) };
    case 'cultivation_progress_delta':
      if (delta.amount < 0) {
        const cp = Math.max(0, rs.character.cultivationProgress + delta.amount);
        return { ...rs, character: { ...rs.character, cultivationProgress: cp } };
      }
      return { ...rs, character: advanceCultivation(rs.character, delta.amount) };
    case 'item_add': {
      const idx = rs.inventory.findIndex((i) => i.id === delta.id);
      if (idx === -1) {
        return { ...rs, inventory: [...rs.inventory, { id: delta.id, count: delta.count }] };
      }
      const next = [...rs.inventory];
      next[idx] = { id: delta.id, count: next[idx]!.count + delta.count };
      return { ...rs, inventory: next };
    }
    case 'item_remove': {
      const idx = rs.inventory.findIndex((i) => i.id === delta.id);
      if (idx === -1) return rs;
      const existing = rs.inventory[idx]!;
      const nextCount = existing.count - delta.count;
      const next = [...rs.inventory];
      if (nextCount <= 0) next.splice(idx, 1);
      else next[idx] = { id: delta.id, count: nextCount };
      return { ...rs, inventory: next };
    }
    case 'technique_learn':
      if (rs.learnedTechniques.includes(delta.id)) return rs;
      return { ...rs, learnedTechniques: [...rs.learnedTechniques, delta.id] };
    case 'meridian_open':
      // Delegated to the character module in a later phase (actual opening + deviation flow).
      // For Phase 1B, simply add the id if not present.
      if (rs.character.openMeridians.includes(delta.id)) return rs;
      return {
        ...rs,
        character: {
          ...rs.character,
          openMeridians: [...rs.character.openMeridians, delta.id],
        },
      };
    case 'karma_delta':
      return { ...rs, karmaEarnedBuffer: rs.karmaEarnedBuffer + delta.amount };
    case 'notice_delta': {
      const nextN = Math.max(0, Math.min(100, rs.heavenlyNotice + delta.amount));
      return { ...rs, heavenlyNotice: nextN };
    }
    case 'age_delta_days':
      return { ...rs, character: ageDays(rs.character, delta.amount) };
  }
}

export function applyOutcome(rs: RunState, outcome: Outcome): RunState {
  let next = rs;
  for (const delta of outcome.stateDeltas ?? []) {
    next = applyDeltaToState(next, delta as StateDelta);
  }
  if (outcome.noticeDelta !== undefined) {
    const n = Math.max(0, Math.min(100, next.heavenlyNotice + outcome.noticeDelta));
    next = { ...next, heavenlyNotice: n };
  }
  if (outcome.deathCause !== undefined) {
    next = { ...next, deathCause: outcome.deathCause };
  }
  if (outcome.witnessMemory !== undefined) {
    next = logWitness(next, outcome.witnessMemory);
  }
  return next;
}
