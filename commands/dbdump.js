const { DevCommand } = require("./classes/devcommand.js");
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logError } = require('../utils/log');

class DBDump extends DevCommand {
    constructor(client) {
        super(client, "dbdump", "Output a specific database table or all tables.", [
            {
                name: 'table',
                description: 'Select the table to dump',
                type: 3, // String type
                required: true,
                choices: [
                    { name: 'User Data', value: 'user' },
                    { name: 'Pokemon Data', value: 'pokemon' },
                    { name: 'Marriage Data', value: 'marriage' },
                    { name: 'All Data', value: 'all' }
                ]
            }
        ]);
    }

    async run(interaction) {
        const table = interaction.options.getString('table');

        try {
            // Determine which tables to dump based on the user's input
            const filesToDump = [];

            if (table === 'user' || table === 'all') {
                const userData = await this.client.db.dump();
                const userFilePath = this.createCSVFile('User_Data.csv', userData);
                filesToDump.push({ attachment: userFilePath, name: 'User_Data.csv' });
            }

            if (table === 'pokemon' || table === 'all') {
                const pokemonData = await this.client.db.dumpPokemon();
                const pokemonFilePath = this.createCSVFile('Pokemon_Data.csv', pokemonData);
                filesToDump.push({ attachment: pokemonFilePath, name: 'Pokemon_Data.csv' });
            }

            if (table === 'marriage' || table === 'all') {
                const marriageData = await this.client.db.dumpMarriage();
                const marriageFilePath = this.createCSVFile('Marriage_Data.csv', marriageData);
                filesToDump.push({ attachment: marriageFilePath, name: 'Marriage_Data.csv' });
            }

            // Send the selected files as attachments
            await interaction.editReply({
                content: 'Database dump files:',
                files: filesToDump
            });

            // Clean up temporary files after sending
            for (const file of filesToDump) {
                this.cleanupFile(file.attachment);
            }
        } catch (error) {
            logError(error);
            await interaction.followUp({ content: 'An error occurred while executing the command.', ephemeral: true });
        }
    }

    createCSVFile(fileName, data) {
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, data, 'utf8');
        return filePath;
    }

    cleanupFile(filePath) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            logError(`Failed to delete file ${filePath}:`, err);
        }
    }
}

module.exports = DBDump;