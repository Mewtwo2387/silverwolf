import { CommandGroup } from '../classes/commandGroup';

export default class GameUID extends CommandGroup {
  constructor(client: any) {
    super(client, 'gameuid', 'Game UID commands', ['set', 'get', 'delete']);
  }
}
