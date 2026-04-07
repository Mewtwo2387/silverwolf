import { Command } from './classes/Command';
import { logError } from '../utils/log';

class PoopLog extends Command {
  constructor(client: any) {
    super(
      client,
      'log',
      'Record a bathroom visit 💩',
      [
        {
          name: 'colour',
          description: 'The colour of your poop',
          type: 3,
          required: false,
          choices: [
            { name: 'Brown', value: 'brown' },
            { name: 'Dark Brown', value: 'dark-brown' },
            { name: 'Yellow', value: 'yellow' },
            { name: 'Green', value: 'green' },
            { name: 'Black', value: 'black' },
            { name: 'Red', value: 'red' },
          ],
        },
        {
          name: 'size',
          description: 'The size of your poop',
          type: 3,
          required: false,
          choices: [
            { name: 'Small', value: 'small' },
            { name: 'Medium', value: 'medium' },
            { name: 'Large', value: 'large' },
          ],
        },
        {
          name: 'type',
          description: 'The consistency of your poop',
          type: 3,
          required: false,
          choices: [
            { name: 'Liquid', value: 'liquid' },
            { name: 'Soft', value: 'soft' },
            { name: 'Normal', value: 'normal' },
            { name: 'Hard', value: 'hard' },
            { name: 'Pellet', value: 'pellet' },
          ],
        },
        {
          name: 'duration',
          description: 'How long you were on the throne (minutes)',
          type: 4,
          required: false,
          min_value: 1,
          max_value: 120,
        },
      ],
      { isSubcommandOf: 'poop', blame: 'ei' },
    );
  }

  async run(interaction: any): Promise<void> {
    try {
      const userId = interaction.user.id;
      const colour = interaction.options.getString('colour');
      const size = interaction.options.getString('size');
      const type = interaction.options.getString('type');
      const duration = interaction.options.getInteger('duration');

      const count = await this.client.db.poop.logPoop(userId, colour, size, type, duration);

      await interaction.editReply(`flushed🚽! This is poop number **${count}**, keep poopin'! 💩`);
    } catch (error) {
      logError('Failed to log poop:', error);
      await interaction.editReply('Failed to record your poop. Please try again.');
    }
  }
}

export default PoopLog;
