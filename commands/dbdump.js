const fs = require('fs');
const path = require('path');
const { DevCommand } = require('./classes/devcommand');
const { logError } = require('../utils/log');

class DBDump extends DevCommand {
  constructor(client) {
    super(client, 'dbdump', 'Output a specific database table or all tables.', [
      {
        name: 'table',
        description: 'Select the table to dump',
        type: 3, // String type
        required: true,
        choices: [
          { name: 'User Data', value: 'user' },
          { name: 'Pokemon Data', value: 'pokemon' },
          { name: 'Marriage Data', value: 'marriage' },
          { name: 'Baby Data', value: 'baby' },
          { name: 'Command Config Data', value: 'commandConfig' },
          { name: 'Server Roles Data', value: 'serverRoles' },
          { name: 'Chat History Data', value: 'chatHistory' },
          { name: 'Chat Session Data', value: 'chatSession' },
          { name: 'Global Config Data', value: 'globalConfig' },
          { name: 'Game UID Data', value: 'gameUID' },
          { name: 'All Data', value: 'all' },
        ],
      },
    ]);
  }

  async run(interaction) {
    const table = interaction.options.getString('table');

    try {
      // Determine which tables to dump based on the user's input
      const filesToDump = [];

      if (table === 'user' || table === 'all') {
        const userData = await this.client.db.dumpUser();
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

      if (table === 'baby' || table === 'all') {
        const babyData = await this.client.db.dumpBaby();
        const babyFilePath = this.createCSVFile('Baby_Data.csv', babyData);
        filesToDump.push({ attachment: babyFilePath, name: 'Baby_Data.csv' });
      }

      if (table === 'commandConfig' || table === 'all') {
        const commandConfigData = await this.client.db.dumpCommandConfig();
        const commandConfigFilePath = this.createCSVFile('Command_Config_Data.csv', commandConfigData);
        filesToDump.push({ attachment: commandConfigFilePath, name: 'Command_Config_Data.csv' });
      }

      if (table === 'serverRoles' || table === 'all') {
        const serverRolesData = await this.client.db.dumpServerRoles();
        const serverRolesFilePath = this.createCSVFile('Server_Roles_Data.csv', serverRolesData);
        filesToDump.push({ attachment: serverRolesFilePath, name: 'Server_Roles_Data.csv' });
      }

      if (table === 'chatHistory' || table === 'all') {
        const chatHistoryData = await this.client.db.dumpChatHistory();
        const chatHistoryFilePath = this.createCSVFile('Chat_History_Data.csv', chatHistoryData);
        filesToDump.push({ attachment: chatHistoryFilePath, name: 'Chat_History_Data.csv' });
      }

      if (table === 'chatSession' || table === 'all') {
        const chatSessionData = await this.client.db.dumpChatSession();
        const chatSessionFilePath = this.createCSVFile('Chat_Session_Data.csv', chatSessionData);
        filesToDump.push({ attachment: chatSessionFilePath, name: 'Chat_Session_Data.csv' });
      }

      if (table === 'globalConfig' || table === 'all') {
        const globalConfigData = await this.client.db.dumpGlobalConfig();
        const globalConfigFilePath = this.createCSVFile('Global_Config_Data.csv', globalConfigData);
        filesToDump.push({ attachment: globalConfigFilePath, name: 'Global_Config_Data.csv' });
      }

      if (table === 'gameUID' || table === 'all') {
        const gameUIDData = await this.client.db.dumpGameUID();
        const gameUIDFilePath = this.createCSVFile('Game_UID_Data.csv', gameUIDData);
        filesToDump.push({ attachment: gameUIDFilePath, name: 'Game_UID_Data.csv' });
      }

      // Send the selected files as attachments
      await interaction.editReply({
        content: 'Database dump files:',
        files: filesToDump,
      });

      // Clean up temporary files after sending
      filesToDump.forEach((file) => {
        this.cleanupFile(file.attachment);
      });

      const databasePath = path.join(__dirname, '../persistence/database.db');

      if (fs.existsSync(databasePath)) {
        interaction.followUp({
          content: 'database:',
          files: [{ attachment: databasePath, name: 'database.db' }],
        });
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
