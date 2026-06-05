import { ImagePanel, ImagePanelMode } from '../imagePanel';
import { itemImagePath } from '../assetPaths';
import { round2 } from '../../utils/math';
import type { CharacterInBattle } from '../characterInBattle';

export function itemImagePanel(itemId: string, options?: { whiteBackground?: boolean }): ImagePanel {
  return new ImagePanel(itemImagePath(itemId), {
    mode: ImagePanelMode.Background,
    backgroundColor: options?.whiteBackground ? '#ffffff' : 'transparent',
  });
}

/** Heal `percent` of the target's max HP (0–1) plus a flat amount. */
export function healPercentOfMaxPlusFlat(target: CharacterInBattle, percent: number, flat: number): void {
  target.heal(round2(target.character.hp * percent + flat));
}
