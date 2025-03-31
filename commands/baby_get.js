const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const { log } = require('../utils/log.js');

const PREGNANCY_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week

class BabyGet extends Command {
    constructor(client){
        super(client, "get", "get a list of babies from parents", [
            {
                name: "parent1",
                description: "The first parent of the baby",
                type: 6,
                required: true
            },
            {
                name: "parent2",
                description: "The second parent of the baby (default: you)",
                type: 6,
                required: false
            }
        ], {isSubcommandOf: "baby"});
    }

    async run(interaction){
        const parent1 = interaction.options.getUser("parent1");
        const parent2 = interaction.options.getUser("parent2") || interaction.user;

        const babies = await this.client.db.getBabies(parent1.id, parent2.id);
        log(`babies: ${JSON.stringify(babies)}`);

        if (babies.length == 0){
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('404 Baby Not Found')
                ]
            });
            return;
        }

        var result = "";

        for (const baby of babies){
            result += `**${baby.name}**\n`;
            result += `ID: ${baby.id}\n`;
            result += `Status: ${baby.status}\n`;
            switch (baby.job){
                case "nuggie_claimer":
                    result += `Nuggie Claimer - ${baby.nuggie_claimer_claims} claims, ${format(baby.nuggie_claimer_claimed)} nuggies claimed\n`;
                    break;
                case "gambler":
                    result += `Gambler - ${baby.gambler_games} games (${baby.gambler_wins} wins, ${baby.gambler_losses} losses), ${format(baby.gambler_credits_won - baby.gambler_credits_gambled)} net winnings (${format(baby.gambler_credits_won)} won, ${format(baby.gambler_credits_gambled)} gambled)\n`;
                    break;
                case "pinger":
                    result += `Pinger - ${baby.pinger_pings} pings\n`;
                    break;
                default:
                    result += `No job\n`;
                    break;
            }
            result += `Level: Lv ${baby.level}\n`;
            result += `Mother: <@${baby.mother_id}>\n`;
            result += `Father: <@${baby.father_id}>\n`;
            if (baby.status == "unborn"){
                const created = new Date(baby.created);
                const now = new Date();
                const diffTime = Math.abs(now - created);
                if (diffTime > PREGNANCY_DURATION){
                    result += "Can give birth now! Use /baby birth!\n";
                } else {
                    result += `Can give birth in ${format(Math.ceil((PREGNANCY_DURATION - diffTime) / (1000 * 60 * 60 * 24)), true)} days!\n`;
                }
            } else {
                result += `Born: ${baby.born}\n`;
            }
            result += "\n";
        }

        await interaction.editReply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`Babies of ${parent1.username} and ${parent2.username}`)
                    .setDescription(result)
            ]
        });
    }
}

module.exports = BabyGet;