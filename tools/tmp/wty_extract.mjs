#!/usr/bin/env node
/**
 * wty_extract — dump the weapon records and ability blurbs for one or more characters,
 * side by side, so a description can be checked against the record it claims to describe.
 *
 * WHY THIS EXISTS: `abilities[].desc` and `weapons[]` are two separate arrays in
 * `CharacterDef` with NO structural link between them — nothing in the type system, and
 * nothing in any gate, requires `abilities[i]` to describe `weapons[i]`, or to describe
 * any weapon at all. That is the whole defect class this audit is chasing, so the first
 * thing this tool prints is the JOIN, and whether the join is even well-formed.
 *
 *   node tools/tmp/wty_extract.mjs egg lollipop pizza sushi
 *   node tools/tmp/wty_extract.mjs --json egg
 *
 * Read-only. Touches nothing.
 */
import { CHARACTERS, REACH, SPEED, FLIGHT_MS, SLOW_DURATION_MS, SLOW_MOVE_MULTIPLIER,
         STUN_DURATION_MS, PLAYER_SIZE, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY,
         PUDDLE_SLOW_FACTOR, SPLAT_RADIUS, SPLAT_DURATION_MS, HOMING_TURN_RATE,
       } from '../../src/game/rules.ts';

const IS_MAIN = import.meta.url === `file://${process.argv[1]}`;

/** Invert the REACH / SPEED tables so a raw number can be named. */
function nameOf(table, v) {
  for (const [k, val] of Object.entries(table)) if (val === v) return k;
  return null;
}

export function describeWeapon(w) {
  const pellets = w.pellets ?? 1;
  const out = {
    key: w.key,
    name: w.name,
    type: w.type,
    range: w.range,
    rangeName: w.range === undefined ? null : nameOf(REACH, w.range),
    damagePerPellet: w.damage,
    pellets,
    // ⚠️ `damage` IS AUTHORED PER-PELLET. Both AI drivers once ranked on the raw field.
    burstDamage: w.comboParts
      ? w.comboParts.reduce((a, p) => a + p.damage, 0)
      : w.damage * pellets * (w.peckHits ?? 1),
    cooldown: w.cooldown,
    cone: w.cone,
    speed: w.speed,
    speedName: w.speed === undefined ? null : nameOf(SPEED, w.speed),
    effect: w.effect,
    // Every optional mechanic flag, present-or-absent, so a missing one is visible.
    spreadDeg: w.spreadDeg,
    // combat.ts: offset = (i - (n-1)/2) * spreadDeg  →  spreadDeg is the PER-PELLET STEP,
    // so the TOTAL fan is (pellets - 1) * spreadDeg. The interface comment calls it
    // "fanned across spreadDeg", which is a different (and smaller) quantity.
    totalFanDeg: pellets > 1 ? (pellets - 1) * (w.spreadDeg ?? 0) : 0,
    splatter: w.splatter ?? false,
    homing: w.homing ?? false,
    trailBoosted: w.trailBoosted ?? false,
    peckHits: w.peckHits,
    peckInterval: w.peckInterval,
    giantSlam: w.giantSlam ?? false,
    healAmount: w.healAmount,
    comboParts: w.comboParts ? w.comboParts.map((p) => ({ damage: p.damage, angle: p.angle })) : undefined,
    emoji: w.emoji,
    color: w.color,
  };
  return out;
}

export function extract(id) {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`no character '${id}'`);
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    stats: c.stats,
    hasTrail: c.hasTrail,
    weapons: c.weapons.map(describeWeapon),
    abilities: c.abilities.map((a) => ({ emoji: a.emoji, name: a.name, desc: a.desc })),
  };
}

/**
 * THE JOIN. There is no declared link between `weapons[i]` and `abilities[j]`, so the
 * only one available is by NAME. Report every ability that matches no weapon and every
 * weapon that matches no ability — both are silent today.
 */
export function join(c) {
  const rows = [];
  const usedW = new Set();
  for (const a of c.abilities) {
    const wi = c.weapons.findIndex((w) => w.name === a.name);
    if (wi >= 0) usedW.add(wi);
    rows.push({ ability: a.name, weaponIndex: wi, weapon: wi >= 0 ? c.weapons[wi] : null, desc: a.desc, emojiMatch: wi >= 0 ? c.weapons[wi].emoji === a.emoji : null });
  }
  const orphanWeapons = c.weapons.map((w, i) => ({ w, i })).filter(({ i }) => !usedW.has(i));
  return { rows, orphanWeapons };
}

if (IS_MAIN) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const ids = args.filter((a) => !a.startsWith('--'));
  const list = ids.length ? ids : Object.keys(CHARACTERS);
  const all = list.map(extract);
  if (asJson) {
    console.log(JSON.stringify(all, null, 2));
  } else {
    console.log('CONSTANTS: SLOW ' + SLOW_DURATION_MS + 'ms x' + SLOW_MOVE_MULTIPLIER +
      ' | STUN ' + STUN_DURATION_MS + 'ms | hitRadius vs player ' + HIT_RADIUS_VS_PLAYER +
      ' vs enemy ' + HIT_RADIUS_VS_ENEMY + ' | PLAYER_SIZE ' + PLAYER_SIZE +
      ' | splat r' + SPLAT_RADIUS + ' ' + SPLAT_DURATION_MS + 'ms x' + PUDDLE_SLOW_FACTOR +
      ' | homingTurn ' + HOMING_TURN_RATE);
    console.log('REACH ' + JSON.stringify(REACH) + '\nSPEED ' + JSON.stringify(SPEED) +
      '\nFLIGHT_MS ' + JSON.stringify(FLIGHT_MS) + '\n');
    for (const c of all) {
      console.log('='.repeat(78));
      console.log(`${c.id}  (${c.name}, ${c.rarity})  stats=${JSON.stringify(c.stats)} hasTrail=${c.hasTrail}`);
      const j = join(c);
      for (const r of j.rows) {
        console.log(`\n  ABILITY "${r.ability}"  -> weapon[${r.weaponIndex}]${r.weaponIndex < 0 ? '  *** NO MATCHING WEAPON ***' : ''}${r.emojiMatch === false ? '  *** EMOJI MISMATCH ***' : ''}`);
        console.log(`    desc: ${r.desc}`);
        if (r.weapon) console.log(`    rec : ${JSON.stringify(r.weapon)}`);
      }
      for (const { w, i } of j.orphanWeapons) {
        console.log(`\n  *** WEAPON[${i}] "${w.name}" HAS NO ABILITY BLURB ***\n    rec : ${JSON.stringify(w)}`);
      }
      console.log('');
    }
  }
}
