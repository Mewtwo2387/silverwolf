import { DevCommand } from './classes/DevCommand';
import { handleSuccessfulClaim } from '../utils/claim';

class ForceClaim extends DevCommand {
  constructor(client: any) {
    super(client, 'forceclaim', 'claim dinonuggies ignoring cooldown', [], { isSubcommandOf: 'dev', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    await handleSuccessfulClaim(this.client, interaction);
  }
}

export default ForceClaim;
