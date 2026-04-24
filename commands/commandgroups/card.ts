import { CommandGroup } from '../classes/commandGroup';

export default class Card extends CommandGroup {
  constructor(client: any) {
    super(client, 'card', 'TCG card commands', ['custom', 'show']);
  }
}
