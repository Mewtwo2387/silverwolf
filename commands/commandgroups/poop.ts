import { CommandGroup } from '../classes/commandGroup';

export default class Poop extends CommandGroup {
  constructor(client: any) {
    super(client, 'poop', 'April Fools poop tracker 💩', ['profile-create', 'log', 'stats']);
  }
}
