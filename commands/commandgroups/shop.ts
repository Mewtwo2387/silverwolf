import { CommandGroup } from '../classes/commandGroup';

export default class Shop extends CommandGroup {
  constructor(client: any) {
    super(client, 'shop', 'shop commands', ['ascension', 'upgrades', 'upgradesdata', 'donation']);
  }
}
