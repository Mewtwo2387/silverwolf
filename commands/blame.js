const { Command } = require('./classes/command.js');

class Blame extends Command {
    constructor(client) {
        super(client, "blame", "spam ping the author of a command", [
            {
                name: 'command',
                description: 'the name of the command to blame',
                type: 3,
                required: true
            }
        ]);
    }

    async run(interaction) {
        let commandName = interaction.options.getString('command');
        commandName = commandName.toLowerCase();

        const ei = [
            '2022',
            'add',
            'ascend',
            'ascensionupgrade',
            'balance',
            'blackjack',
            'blame',
            'buy',
            'buyascension',
            'buybitcoin',
            'catch',
            'claim',
            'click',
            'dbdump',
            'donate',
            'dping',
            'eat',
            'eatmultiple',
            'esnipe',
            'eval',
            'execute',
            'fakequote',
            'flip',
            'forcesummon',
            'gamebang',
            'hello',
            'lore',
            'nuggieboard',
            'nword',
            'ping',
            'pokemon',
            'roll',
            'roulette',
            'sacrifice',
            'say',
            'sing',
            'slots',
            'snipe',
            'testsummon',
            'transfer',
            'upgrade',
            'upgradedata'
        ];

        const xei = [
            '8ball',
            'eightball',
            'avatar',
            'spotify-playlist',
            'get_birthday',
            'set_birthday',
            'bitcoin-price',
            'cat-fact',
            'say-dm',
            'fortune',
            'ask-silverwolf-ai',
            'grab_emoji',
            'randomjoke',
            'love_calculator',
            'misfortune',
            'pfp_match_req',
            'rnr',
            'russian_roulette',
            'discord_timestamp',
        ]

        if (ei.includes(commandName)) {
            await interaction.editReply({ content: `blame <@595491647132008469> for ${commandName}` });
            for (let i = 1; i <= 5; i++) {
                setTimeout(()=>{
                    interaction.followUp({ content: `<@595491647132008469>` });
                }, i * 1000);
            }
        }else if (xei.includes(commandName)) {
            await interaction.editReply({ content: `blame <@964521557823197184> for ${commandName}` });
            for (let i = 1; i <= 5; i++) {
                setTimeout(()=>{
                    interaction.followUp({ content: `<@964521557823197184>` });
                }, i * 1000);
            }
        }else{
            await interaction.editReply({ content: `command not found` });
        }
    }
}

module.exports = Blame;