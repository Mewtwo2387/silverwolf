import { raw } from 'hono/html';
import type { Character } from '../../../tcg/character';
import { elementDisplayName } from '../../../tcg/element';
import { rosterValueForCharacter } from '../../../tcg/characterRoster';
import { formatSkillCategory } from '../labels';
import { loadTcgHtml, tcgScriptAssets } from '../html';

/** Serializable character preview for team-picking / roster browsers. */
export interface CharacterCatalogEntry {
  value: string;
  name: string;
  slug: string;
  hp: number;
  element: string;
  title: string;
  description: string;
  skills: {
    name: string;
    description: string;
    category: string;
    damageText: string;
  }[];
  abilities: { name: string; description: string }[];
}

export function buildCharacterCatalog(characters: Character[]): CharacterCatalogEntry[] {
  return characters.map((c) => ({
    value: rosterValueForCharacter(c),
    name: c.name,
    slug: c.slug,
    hp: c.hp,
    element: elementDisplayName(c.element),
    title: c.titleDesc.title,
    description: c.titleDesc.description,
    skills: c.skills.map((s) => ({
      name: s.name,
      description: s.description,
      category: formatSkillCategory(s.battleCost.kind),
      damageText: s.damageDisplayText,
    })),
    abilities: c.abilities.map((a) => ({
      name: a.name,
      description: a.description,
    })),
  }));
}

/** Modal shell + cloneable templates from html/tcg-detail-modal.html. Include once per TCG page. */
export function tcgDetailModalShell() {
  return raw(loadTcgHtml('tcg-detail-modal.html'));
}

/** Optional catalog data island + deferred tcg-detail.js. */
export function tcgDetailAssets(nonce: string, catalog?: CharacterCatalogEntry[]) {
  return tcgScriptAssets('tcg-detail', nonce, catalog
    ? { id: 'tcg-detail-data', payload: { catalog } }
    : undefined);
}
