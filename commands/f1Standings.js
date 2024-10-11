const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const axios = require('axios');
const xml2js = require('xml2js');

class F1Standings extends Command {
    constructor(client) {
        super(client, "f1_standings", "Fetch the current F1 standings (drivers or constructors)", [
            {
                name: 'type',
                description: 'Choose between driver or constructor standings',
                type: 3,  // String type
                required: true,
                choices: [
                    { name: 'Drivers', value: 'drivers' },
                    { name: 'Constructors', value: 'constructors' }
                ]
            }
        ]);
    }

    async run(interaction) {
        const type = interaction.options.getString('type');
        let apiUrl;

        // Determine the API URL based on the type selected
        if (type === 'drivers') {
            apiUrl = 'http://ergast.com/api/f1/current/driverStandings';
        } else if (type === 'constructors') {
            apiUrl = 'http://ergast.com/api/f1/current/constructorStandings';
        }

        try {
            // Fetch the F1 standings (driver or constructor) from the API
            const response = await axios.get(apiUrl);
            const xmlData = response.data;

            // Parse the XML to JSON
            xml2js.parseString(xmlData, (err, result) => {
                if (err) {
                    throw new Error('Error parsing F1 standings data.');
                }

                let standings;
                let description = '';
                let title;

                if (type === 'drivers') {
                    // Extract driver standings
                    standings = result.MRData.StandingsTable[0].StandingsList[0].DriverStanding;
                    title = 'Current F1 Driver Standings';
                    standings.slice(0, 10).forEach((driver) => {
                        description += `${driver.$.position}. **${driver.Driver[0].GivenName[0]} ${driver.Driver[0].FamilyName[0]}** - Points: ${driver.$.points}, Wins: ${driver.$.wins}\n`;
                    });
                } else if (type === 'constructors') {
                    // Extract constructor standings
                    standings = result.MRData.StandingsTable[0].StandingsList[0].ConstructorStanding;
                    title = 'Current F1 Constructor Standings';
                    standings.slice(0, 10).forEach((constructor) => {
                        description += `${constructor.$.position}. **${constructor.Constructor[0].Name[0]}** (${constructor.Constructor[0].Nationality[0]}) - Points: ${constructor.$.points}, Wins: ${constructor.$.wins}\n`;
                    });
                }

                // Create the embed
                const embed = new Discord.EmbedBuilder()
                    .setTitle(title)
                    .setColor('#FF0000')
                    .setDescription(description)
                    .setTimestamp()
                    .setThumbnail('https://logodownload.org/wp-content/uploads/2016/11/formula-1-logo-0.png')
                    .setFooter({ text: 'Data provided by Ergast API' });

                // Send the embed
                interaction.editReply({ embeds: [embed] });
            });

        } catch (error) {
            // Error handling if the request or parsing fails
            console.error('Error fetching F1 standings:', error);
            await interaction.editReply({ content: 'Sorry, I couldn’t fetch the F1 standings. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = F1Standings;
