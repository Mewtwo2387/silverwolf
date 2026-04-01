import { CommandGroup } from '../classes/commandGroup';

export default class RussianRoulette extends CommandGroup {
  constructor(client: any) {
    super(client, 'russianroulette', 'Russian Roulette commands', ['regular', 'singleplayer']);
  }
}
