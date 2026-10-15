#!/usr/bin/env node
// bh_combat_dump — print every weapon's combat-relevant fields from rules.ts (read-only).
// Usage: node tools/tmp/bh_combat_dump.mjs [--root /private/tmp/fa-rv-head]
const i = process.argv.indexOf('--root');
const ROOT = i >= 0 ? process.argv[i + 1] : '/private/tmp/fa-rv-head';
const R = await import(`${ROOT}/src/game/rules.ts`);
const keys = ['key','name','type','damage','cooldown','range','speed','cone','pellets','spreadDeg','effect','castMs','knockback','lure','selfLaunch','homing','peckHits','peckInterval','healAmount','trailBoosted','splatter','comboParts'];
for (const [cid, def] of Object.entries(R.CHARACTERS)) {
  console.log(`== ${cid}  health=${def.stats?.health} speed=${def.stats?.speed} hasTrail=${!!def.hasTrail}`);
  def.weapons.forEach((w, idx) => {
    const o = {};
    for (const k of keys) if (w[k] !== undefined) o[k] = k === 'comboParts' ? w[k].map(p => `${p.angle}:${p.damage}`).join(',') : w[k];
    console.log(`  [${idx}] ` + JSON.stringify(o));
  });
}
console.log('PLAYER_SIZE', R.PLAYER_SIZE, 'ENEMY_SIZE', R.ENEMY_SIZE, 'HIT_RADIUS_VS_PLAYER', R.HIT_RADIUS_VS_PLAYER, 'HIT_RADIUS_VS_ENEMY', R.HIT_RADIUS_VS_ENEMY);
console.log('PLAYER_SPEED', R.PLAYER_SPEED, 'STUN', R.STUN_DURATION_MS, 'STUN_GRACE', R.STUN_GRACE_MS, 'SLOW', R.SLOW_DURATION_MS, 'SLOW_GRACE', R.SLOW_GRACE_MS, 'DR', R.STATUS_DR_SCALES, R.STATUS_DR_WINDOW_MS);
console.log('TRAIL', JSON.stringify(R.TRAIL));
console.log('MEDIKIT', JSON.stringify(R.MEDIKIT));
console.log('ITEM_TUNING', JSON.stringify(R.ITEM_TUNING, null, 0));
console.log('ITEMS', JSON.stringify(Object.fromEntries(Object.entries(R.ITEMS).map(([k,v]) => [k, {kind: v.kind, cooldownMs: v.cooldownMs, minAlive: v.minAlive}]))));
console.log('LEVEL', R.LEVEL_MIN, R.LEVEL_MAX, 'dmgMul@max', R.levelDamageMultiplier?.(R.LEVEL_MAX), 'hpMul@max', R.levelHealthMultiplier?.(R.LEVEL_MAX));
console.log('REGEN', R.REGEN_AMOUNT, R.REGEN_DELAY_MS, R.REGEN_TICK_MS, 'FOG', R.FOG_DAMAGE, R.FOG_TICK_MS, 'HOMING_TURN_RATE', R.HOMING_TURN_RATE);
console.log('MATCH_DURATION_MS', R.MATCH_DURATION_MS, 'SUDDEN_DEATH_REMAINING_MS', R.SUDDEN_DEATH_REMAINING_MS, 'GUARANTEED_VISIBLE_RADIUS', R.GUARANTEED_VISIBLE_RADIUS);
