export enum Element {
  Fairy,
  Quantum,
  Imaginary,
  Physical,
  Anemo,
  Electro,
  Cryo,
  Pyro,
  Geo,
  Dendro,
  Hydro,
}

/** Every combat element (for random-element skills). */
export const ALL_ELEMENTS: readonly Element[] = [
  Element.Fairy,
  Element.Quantum,
  Element.Imaginary,
  Element.Physical,
  Element.Anemo,
  Element.Electro,
  Element.Cryo,
  Element.Pyro,
  Element.Geo,
  Element.Dendro,
  Element.Hydro,
];

export function randomElement(): Element {
  const idx = Math.floor(Math.random() * ALL_ELEMENTS.length);
  return ALL_ELEMENTS[idx];
}
