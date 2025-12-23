const { Command } = require('./classes/command');
const wordlist = require('../data/words_dictionary.json');

class NWord extends Command {
  constructor(client) {
    super(client, 'nword', 'say an n-word', [], { blame: 'ei' });
  }

  async run(interaction) {
    const nwords = Object.keys(wordlist).filter((word) => word.startsWith('n'));
    const nword = nwords[Math.floor(Math.random() * nwords.length)];
    await interaction.editReply(nword);
  }
}

module.exports = NWord;
