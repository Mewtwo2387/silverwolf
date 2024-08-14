const { DevCommand } = require("./classes/devcommand.js");
const Discord = require('discord.js');

class DBDump extends DevCommand {
    constructor(client){
        super(client, "dbdump", "output whole db", []);
    }

    async run(interaction){
        const data = await this.client.db.dump();
        await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Data')
            .setDescription(data)
        ]});
    }
}

module.exports = DBDump;