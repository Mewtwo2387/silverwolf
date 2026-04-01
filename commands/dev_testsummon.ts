import { DevCommand } from './classes/DevCommand';

const HOUR_LENGTH = 60 * 60 * 1000;
const MINUTE_LENGTH = 60 * 1000;

class DevTestSummon extends DevCommand {
  constructor(client: any) {
    super(client, 'testsummon', 'summon a pokemon at random intervals', [], { ephemeral: true, isSubcommandOf: 'dev', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    this.nextSummon(interaction);
  }

  async nextSummon(interaction: any): Promise<void> {
    const randomInterval = Math.floor(Math.random() * HOUR_LENGTH) + 20 * MINUTE_LENGTH;
    setTimeout(async () => {
      await this.client.summonPokemon(interaction);
      this.nextSummon(interaction);
    }, randomInterval);
  }
}

export default DevTestSummon;
