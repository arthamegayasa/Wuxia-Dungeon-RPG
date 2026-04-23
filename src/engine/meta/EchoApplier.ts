// Apply rolled Soul Echo effects to a Character. Pure.

import { Character } from '@/engine/character/Character';
import { AttributeMap } from '@/engine/character/Attribute';
import { SoulEcho } from './SoulEcho';

function applyStatDelta(
  attrs: Readonly<AttributeMap>,
  stat: string,
  delta: number,
): AttributeMap {
  if (!(stat in attrs)) return { ...attrs };
  return { ...attrs, [stat as keyof AttributeMap]: (attrs as any)[stat] + delta };
}

export function applyEchoes(
  base: Character,
  echoes: ReadonlyArray<SoulEcho>,
  echoIds: ReadonlyArray<string>,
): Character {
  let attributes: AttributeMap = { ...base.attributes };
  let hpMult = 1;
  let insightCapBonus = 0;
  const extraFlags: string[] = [];

  for (const e of echoes) {
    for (const eff of e.effects) {
      switch (eff.kind) {
        case 'stat_mod':
          attributes = applyStatDelta(attributes, eff.stat, eff.delta);
          break;
        case 'hp_mult':
          hpMult *= eff.mult;
          break;
        case 'insight_cap_bonus':
          insightCapBonus += eff.bonus;
          break;
        case 'starting_flag':
          if (!extraFlags.includes(eff.flag)) extraFlags.push(eff.flag);
          break;
        default:
          break;
      }
    }
  }

  return {
    ...base,
    attributes,
    hp: base.hp * hpMult,
    hpMax: base.hpMax * hpMult,
    insightCap: base.insightCap + insightCapBonus,
    echoes: [...echoIds],
    flags: [...base.flags, ...extraFlags.filter((f) => !base.flags.includes(f))],
  };
}
