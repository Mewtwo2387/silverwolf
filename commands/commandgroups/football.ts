import { CommandGroup } from '../classes/commandGroup';

export default class Football extends CommandGroup {
  constructor(client: any) {
    super(client, 'football', 'World Cup football commands', ['channel', 'test', 'scores']);
  }
}
