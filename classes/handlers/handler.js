const SHINY_CHANCE = 0.03;
const MYSTERY_CHANCE = 0.3;

class Handler {
  async summonPokemon(message, mode = 'normal') {
    const allMembers = await message.guild.members.fetch();
    const members = allMembers.filter((member) => !member.user.bot);
    const member = members.random();
    const { client } = message;

    const pfp = await member.user.displayAvatarURL({ extension: 'png', size: 512 });
    if (mode === 'shiny' || (mode === 'normal' && Math.random() < SHINY_CHANCE)) {
      this.summonShinyPokemon(client, message, member, pfp);
    } else if (mode === 'mystery' || (mode === 'normal' && Math.random() < MYSTERY_CHANCE)) {
      this.summonMysteryPokemon(client, message, member, pfp);
    } else {
      this.summonNormalPokemon(client, message, member, pfp);
    }
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonShinyPokemon(_client, _message, _member, _pfp) {
    throw new Error('summonShinyPokemon method must be implemented by subclasses');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonMysteryPokemon(_client, _message, _member, _pfp) {
    throw new Error('summonMysteryPokemon method must be implemented by subclasses');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonNormalPokemon(_client, _message, _member, _pfp) {
    throw new Error('summonNormalPokemon method must be implemented by subclasses');
  }
}

module.exports = Handler;
