const songs = require('../data/songs.json');
const Discord = require('discord.js');
const { Command } = require('./classes/command.js');

class Sing extends Command {
    constructor(client){
        super(client, "sing", "sing a song",
            [{
                name: "song",
                description: "song to sing",
                type: 3,
                required: true,
                choices: [
                    { name: "If I Can Stop One Heart From Breaking", value: "ifICanStopOneHeartFromBreaking" },
                    { name: "Unauthorized Access", value: "unauthorizedAccess" },
                    { name: "Fly Me To The Moon", value: "flyMeToTheMoon" },
                    { name: "Women cheat", value: "WomenCheat" }
                ]
            }]
        );
    }


    async run(interaction){
        if(this.client.singing){
            const embed = new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle('No.')
                .setDescription('Another song is in progress');
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        this.client.singing = true;

        const song = interaction.options.getString('song');
        const lyrics = songs[song];

        await interaction.editReply(lyrics[0]);

        for(let i = 1; i < lyrics.length; i++){
            await new Promise(wait => setTimeout(wait, 1000));
            await interaction.channel.send(lyrics[i]);
        }
        
        this.client.singing = false; 
    }
}

module.exports = Sing;