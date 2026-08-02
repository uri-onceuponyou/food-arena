/**
 * Character registry.
 *
 * Each character gets its own module exporting a factory. Builders replace exactly
 * one entry here — that isolation is what lets 11 model agents work in parallel
 * without colliding.
 *
 * A character still mapped to `PlaceholderCharacter` has not been built yet.
 */

import { CHARACTERS, type CharacterId, type CharacterDef } from '../game/rules';
import type { CharacterModel } from './types';
import { PlaceholderCharacter } from './placeholder';
import { DonutCharacter } from './donut';
import { TacoCharacter } from './taco';
import { BurritoCharacter } from './burrito';
import { EggCharacter } from './egg';
import { LollipopCharacter } from './lollipop';
import { PizzaCharacter } from './pizza';
import { SushiCharacter } from './sushi';
import { SoupCharacter } from './soup';
import { WaterBottleCharacter } from './waterbottle';
import { HotDogCharacter } from './hotdog';
import { HamburgerCharacter } from './hamburger';

export type Factory = (def: CharacterDef) => CharacterModel;

const placeholder: Factory = (def) => new PlaceholderCharacter(def);

/**
 * id → factory. Swap an entry to a real implementation as each model is approved.
 * Keep the import list alphabetical to minimise merge friction between agents.
 */
export const CHARACTER_FACTORIES: Record<CharacterId, Factory> = {
  hamburger: (def) => new HamburgerCharacter(def),
  donut: (def) => new DonutCharacter(def),
  taco: (def) => new TacoCharacter(def),
  burrito: (def) => new BurritoCharacter(def),
  egg: (def) => new EggCharacter(def),
  lollipop: (def) => new LollipopCharacter(def),
  pizza: (def) => new PizzaCharacter(def),
  sushi: (def) => new SushiCharacter(def),
  soup: (def) => new SoupCharacter(def),
  waterbottle: (def) => new WaterBottleCharacter(def),
  hotdog: (def) => new HotDogCharacter(def),
};

export function createCharacter(id: CharacterId): CharacterModel {
  const def = CHARACTERS[id];
  if (!def) throw new Error(`Unknown character id: ${id}`);
  return (CHARACTER_FACTORIES[id] ?? placeholder)(def);
}

export function isPlaceholder(id: CharacterId): boolean {
  return CHARACTER_FACTORIES[id] === placeholder;
}
