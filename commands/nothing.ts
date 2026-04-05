import { Command } from './classes/Command';

class Nothing extends Command {
  constructor(client: any) {
    super(client, 'nothing', 'Does absolutely nothing', [], { ephemeral: false, skipDefer: true, blame: 'xei' });
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async run(_interaction: any): Promise<void> {
    // Intentionally do nothing
  }
}

export default Nothing;
