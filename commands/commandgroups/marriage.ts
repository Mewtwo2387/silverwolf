import { CommandGroup } from '../classes/commandGroup';

export default class Marriage extends CommandGroup {
  constructor(client: any) {
    super(client, 'marriage', 'Marriage commands', ['divorce', 'propose', 'status']);
  }
}
