import { CommandGroup } from '../classes/commandGroup';

export default class Tcgbattle extends CommandGroup {
  constructor(client: any) {
    super(client, 'tcgbattle', 'TCG battle: pick teams, then fight (same rules as the CLI battle example)', [
      'start',
      'accept',
      'status',
      'use',
      'end',
      'cancel',
      'debug',
    ]);
  }
}
