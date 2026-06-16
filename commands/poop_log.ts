import { Command } from './classes/Command';
import { logError } from '../utils/log';
import {
  POOP_COLOURS,
  POOP_SIZES,
  POOP_TYPES,
  POOP_DURATION_MIN,
  POOP_DURATION_MAX,
  poopChoices,
} from '../utils/poop';

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
          choices: poopChoices(POOP_COLOURS),
        },
        {
          name: 'size',
          description: 'The size of your poop',
          type: 3,
          required: false,
          choices: poopChoices(POOP_SIZES),
        },
        {
          name: 'type',
          description: 'The consistency of your poop',
          type: 3,
          required: false,
          choices: poopChoices(POOP_TYPES),
        },
        {
          name: 'duration',
          description: 'How long you were on the throne (minutes)',
          type: 4,
          required: false,
          min_value: POOP_DURATION_MIN,
          max_value: POOP_DURATION_MAX,
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

      if (count === null) {
        await interaction.editReply('Toilet has been choked! are you okay? might wanna check on that gut');
        return;
      }

      await interaction.editReply(`flushed🚽! This is poop number **${count}**, keep poopin'! 💩`);
    } catch (error) {
      logError('Failed to log poop:', error);
      await interaction.editReply('Failed to record your poop. Please try again.');
    }
  }
}

export default PoopLog;
