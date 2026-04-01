import { Command } from './classes/Command';

class PingRegular extends Command {
  constructor(client: any) {
    super(client, 'regular', 'pong', [], { isSubcommandOf: 'ping', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    await interaction.editReply('Pong!');
  }
}

export default PingRegular;
