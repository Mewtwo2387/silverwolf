import { CommandGroup } from '../classes/commandGroup';

export default class Quote extends CommandGroup {
  constructor(client: any) {
    super(client, 'quote', 'Make it a quote', ['fake', 'settings', 'help']);
  }
}
