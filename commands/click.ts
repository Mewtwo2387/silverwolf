import { Command } from './classes/Command';

class Click extends Command {
  constructor(client: any) {
    super(client, 'click', 'send the link to the daily click thing', [], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    await interaction.editReply('https://arab.org/click-to-help/palestine/');
  }
}

export default Click;
