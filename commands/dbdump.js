const { DevCommand } = require("./classes/devcommand.js");
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');

class DBDump extends DevCommand {
    constructor(client) {
        super(client, "dbdump", "output whole db", []);
    }

    async run(interaction) {
        try {
            // Dump data for all tables
            const userData = await this.client.db.dump();
            const pokemonData = await this.client.db.dumpPokemon();
            const marriageData = await this.client.db.dumpMarriage();

            // Create temporary files
            const userFilePath = this.createCSVFile('User_Data.csv', userData);
            const pokemonFilePath = this.createCSVFile('Pokemon_Data.csv', pokemonData);
            const marriageFilePath = this.createCSVFile('Marriage_Data.csv', marriageData);

            // Send the files as attachments
            await interaction.editReply({
                content: 'Database dump files:',
                files: [
                    { attachment: userFilePath, name: 'User_Data.csv' },
                    { attachment: pokemonFilePath, name: 'Pokemon_Data.csv' },
                    { attachment: marriageFilePath, name: 'Marriage_Data.csv' }
                ]
            });

            // Clean up temporary files after sending
            this.cleanupFile(userFilePath);
            this.cleanupFile(pokemonFilePath);
            this.cleanupFile(marriageFilePath);
        } catch (error) {
            console.error(error);
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
            console.error(`Failed to delete file ${filePath}:`, err);
        }
    }
}

module.exports = DBDump;