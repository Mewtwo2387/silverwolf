const SHINY_CHANCE = 0.03;
const MYSTERY_CHANCE = 0.3;
const GUILD_MEMBER_CACHE_TTL_MS = 60 * 1000;

interface CachedGuildMembers {
  fetchedAt: number;
  members: any;
}

class Handler {
  private static guildMemberCache = new Map<string, CachedGuildMembers>();

  private async getGuildMembers(message: any): Promise<any> {
    const guildId = message.guild.id;
    const cachedMembers = Handler.guildMemberCache.get(guildId);
    const now = Date.now();

    if (cachedMembers && now - cachedMembers.fetchedAt < GUILD_MEMBER_CACHE_TTL_MS) {
      return cachedMembers.members;
    }

    const members = await message.guild.members.fetch();
    Handler.guildMemberCache.set(guildId, { fetchedAt: now, members });
    return members;
  }

  async summonPokemon(message: any, mode = 'normal'): Promise<void> {
    const allMembers = await this.getGuildMembers(message);
    const members = allMembers.filter((member: any) => !member.user.bot);
    const member = members.random();
    const { client } = message;

    const pfp = await member.user.displayAvatarURL({ extension: 'png', size: 512 });
    if (mode === 'shiny' || (mode === 'normal' && Math.random() < SHINY_CHANCE)) {
      await this.summonShinyPokemon(client, message, member, pfp);
    } else if (mode === 'mystery' || (mode === 'normal' && Math.random() < MYSTERY_CHANCE)) {
      await this.summonMysteryPokemon(client, message, member, pfp);
    } else {
      await this.summonNormalPokemon(client, message, member, pfp);
    }
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonShinyPokemon(_client: any, _message: any, _member: any, _pfp: string): Promise<void> {
    throw new Error('summonShinyPokemon method must be implemented by subclasses');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonMysteryPokemon(_client: any, _message: any, _member: any, _pfp: string): Promise<void> {
    throw new Error('summonMysteryPokemon method must be implemented by subclasses');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonNormalPokemon(_client: any, _message: any, _member: any, _pfp: string): Promise<void> {
    throw new Error('summonNormalPokemon method must be implemented by subclasses');
  }
}

export default Handler;
