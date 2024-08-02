const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

class Gamebang extends Command {
    constructor(client){
        super(client, "gamebang", "send an embed of peak", []);
    }

    async run(interaction){
        const embed = new EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('«« ━━ ✦・Gamebang Fanfics・✦ ━━ »»')
            .addFields({ name: "Gamebang's 2nd roleplay (Archived)", value: 'https://docs.google.com/document/d/11crS4bxfcR2Vs-1ybmRWum4B5YZeXq6y0zEva0IdBRw/edit?usp=sharing', inline: false })
            .addFields({ name: "1. Gamebang and the Shameful Voices", value: 'https://drive.google.com/file/d/1J1OcQbLrHiriEcjXpCnAz-Fx1pMD7Y0y/view?usp=sharing', inline: false })
            .addFields({ name: "2. Gamebang and the End of Femboys", value: 'https://drive.google.com/file/d/1Itpof3KKwiTFTdUWFTmvrxLfI-foqV_v/view?usp=sharing', inline: false })
            .addFields({ name: "3. Gamebang and the Last Salvation", value: 'https://drive.google.com/file/d/1J-EyRPiWMreLKfdlKJXmqVBZbuMsiRq0/view?usp=sharing', inline: false })
            .addFields({ name: "4. Gamebang and the Divorce", value: 'https://drive.google.com/file/d/1IrztknsmfVjHioFcQEHHK5iXr9HLmjm7/view?usp=sharing', inline: false })
            .addFields({ name: "5. Gamebang and the Kingdom of Atlantis", value: 'https://drive.google.com/file/d/1jtjdLCudVhr4bgmVrEVDDVEvA-SIzmOp/view?usp=sharing', inline: false })
            .addFields({ name: "6. Gamebang and the Collapse of Time", value: 'https://drive.google.com/file/d/1AnFo0qxfTDXHtt3bv5mt-MhrkBdG3D3R/view?usp=sharing', inline: false })
            .addFields({ name: "7. Gamebang and the Quiet Fallout", value: 'https://drive.google.com/file/d/11wOJRYpdvy3GJdMU-I4hmMBew-ZIp5yL/view?usp=sharing', inline: false })
            .addFields({ name: "8. Gamebang and the Divine Comedy", value: 'https://drive.google.com/file/d/1l9RhvGjPrJk9taOFJZ2DNCpvwFrazJ8Z/view?usp=sharing', inline: false })
            .addFields({ name: "9. Gamebang and the Purge", value: 'https://drive.google.com/file/d/1cMCH9ac4MhHU-LlkXirb2kOEqXTscptI/view?usp=sharing', inline: false })
            .addFields({ name: "10. Gamebang and the Revolution", value: 'https://drive.google.com/file/d/1f_rOcsTMusAzcDDKB2RpfmoAvUkqEGh0/view?usp=sharing', inline: false })
            .addFields({ name: "11. Gamebang and the Edge of Space", value: 'https://drive.google.com/file/d/1099FJ0jWI3QICLL1DJddcWGQX8hdwd_x/view?usp=sharing', inline: false })
            .addFields({ name: "12. Gamebang and the World's Silence", value: 'https://drive.google.com/file/d/16cflz99qGGRTfpZWiP6ujNg_OJ2dXLRa/view?usp=sharing', inline: false })
            .addFields({ name: "13. Gamebang and the Archon War", value: 'https://drive.google.com/file/d/1lqXnxMjvAHjiFyFyFnGbHFA0ghaFmjdr/view?usp=sharing', inline: false })
            .addFields({ name: "14. Gamebang and the Apocalypse", value: 'https://drive.google.com/file/d/1hY3j3tfDkZWFhddWby5nRf6ICT9h7OFk/view?usp=sharing', inline: false })
            .setFooter({ text: 'holy fuck' });
        interaction.editReply({embeds: [embed]});
        return;
    }
}

module.exports = Gamebang;