import { CommandGroup } from '../classes/commandGroup';

export default class Baby extends CommandGroup {
  constructor(client: any) {
    super(client, 'baby', 'Baby commands', ['get', 'name', 'birth', 'enslave', 'murder']);
  }
}
