import { Command } from './classes/Command';
import { isAllowedServer } from '../utils/accessControl';

const cooldowns = new Map<string, number>();

const DAY_LENGTH = 24 * 60 * 60 * 1000;

class Fart extends Command {
  constructor(client: any) {
    super(client, 'fart', 'Let out a big... one?', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const { user } = interaction;
    const userId = user.id;
    const now = Date.now();
    const cooldownAmount = DAY_LENGTH;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId)! + cooldownAmount;

      if (now < expirationTime) {
        await interaction.editReply('you shat yourself.');
        await interaction.channel.send('https://tenor.com/view/laughing-cat-catlaughing-laughingcat-point-gif-7577620470218150413');
        return;
      }
    }

    cooldowns.set(userId, now);

    if (isAllowedServer(interaction)) {
      await interaction.editReply({
        content: `# @everyone ${user} has farted! 💨`,
        allowedMentions: { parse: ['roles', 'everyone'] },
      });
    } else {
      await interaction.editReply(`${user} has farted! 💨`);
    }
  }
}

export default Fart;
