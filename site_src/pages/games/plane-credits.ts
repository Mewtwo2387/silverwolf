// Attribution for the third-party references the Plane Sim airframes are
// modelled after. Shared by the game's Credits tab and the model inspector's
// Credits panel so the two can never drift apart.
export interface ModelCredit {
  /** Aircraft as it appears in-game. */
  plane: string;
  /** Title of the source model, verbatim. */
  title: string;
  author: string;
  license: string;
  url: string;
}

export const MODEL_CREDITS: ModelCredit[] = [
  {
    plane: 'Spitfire',
    title: 'Supermarine Spitfire',
    author: 'Renafox',
    license: 'CC BY-NC',
    url: 'https://sketchfab.com/3d-models/supermarine-spitfire-8349f26e1e88455da75dd7352b02b794',
  },
  {
    plane: 'P-51',
    title: 'P51',
    author: 'manilov.ap',
    license: 'CC BY',
    url: 'https://sketchfab.com/3d-models/p51-11a78cd198c443969e8d741605d4e04f',
  },
  {
    plane: 'Zero',
    title: 'Mitsubishi A6M3 Zero',
    author: 'Mamoru_Morimoto',
    license: 'CC BY',
    url: 'https://sketchfab.com/3d-models/mitsubishi-a6m3-zero-cb9fa84167ac4efa9d8aebcab133f7f3',
  },
  {
    plane: 'Bomber',
    title: 'Light Carpet Bomber',
    author: 'Lagst',
    license: 'Sketchfab Standard',
    url: 'https://sketchfab.com/3d-models/light-carpet-bomber-f8e9e237592249d0ab56b9a61b727fad',
  },
];
