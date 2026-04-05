import { CommandGroup } from '../classes/commandGroup';

export default class Birthday extends CommandGroup {
  constructor(client: any) {
    super(client, 'birthday', 'Birthday commands', ['get', 'set', 'test', 'notify', 'unnotify', 'testreminder']);
  }
}
