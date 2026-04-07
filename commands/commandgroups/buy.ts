import { CommandGroup } from '../classes/commandGroup';

export default class Buy extends CommandGroup {
  constructor(client: any) {
    super(client, 'buy', 'Buy commands', ['upgrades', 'ascension', 'donation']);
  }
}
