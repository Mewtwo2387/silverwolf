import { Command } from './classes/Command';

class Hello extends Command {
  constructor(client: any) {
    super(client, 'hello', 'hello', [], { blame: 'both' });
  }

  async run(interaction: any): Promise<void> {
    await interaction.editReply(`Hello ${interaction.user.username}!`);
  }
}

export default Hello;
