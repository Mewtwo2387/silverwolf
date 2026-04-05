import { CommandGroup } from '../classes/commandGroup';

export default class Sex extends CommandGroup {
  constructor(client: any) {
    super(client, 'sex', 'Sex commands', ['start', 'thrust', 'status']);
  }
}
