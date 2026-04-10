import path from 'path';
import { unlinkSync } from 'fs';
import { DevCommand } from './classes/DevCommand';
import { logError } from '../utils/log';

interface DumpDefinition {
  choiceName: string;
  value: string;
  tableName: string;
  fileName: string;
  formatUserIds: string[];
}

const DUMP_DEFINITIONS: DumpDefinition[] = [
  {
    choiceName: 'User Data',
    value: 'user',
    tableName: 'User',
    fileName: 'User_Data.csv',
    formatUserIds: ['id'],
  },
  {
    choiceName: 'Pokemon Data',
    value: 'pokemon',
    tableName: 'Pokemon',
    fileName: 'Pokemon_Data.csv',
    formatUserIds: ['user_id'],
  },
  {
    choiceName: 'Marriage Data',
    value: 'marriage',
    tableName: 'Marriage',
    fileName: 'Marriage_Data.csv',
    formatUserIds: ['user1_id', 'user2_id'],
  },
  {
    choiceName: 'Baby Data',
    value: 'baby',
    tableName: 'Baby',
    fileName: 'Baby_Data.csv',
    formatUserIds: ['mother_id', 'father_id'],
  },
  {
    choiceName: 'Command Config Data',
    value: 'commandConfig',
    tableName: 'CommandConfig',
    fileName: 'Command_Config_Data.csv',
    formatUserIds: [],
  },
  {
    choiceName: 'Server Roles Data',
    value: 'serverRoles',
    tableName: 'ServerRoles',
    fileName: 'Server_Roles_Data.csv',
    formatUserIds: [],
  },
  {
    choiceName: 'Chat History Data',
    value: 'chatHistory',
    tableName: 'ChatHistory',
    fileName: 'Chat_History_Data.csv',
    formatUserIds: [],
  },
  {
    choiceName: 'Chat Session Data',
    value: 'chatSession',
    tableName: 'ChatSession',
    fileName: 'Chat_Session_Data.csv',
    formatUserIds: ['started_by'],
  },
  {
    choiceName: 'Global Config Data',
    value: 'globalConfig',
    tableName: 'GlobalConfig',
    fileName: 'Global_Config_Data.csv',
    formatUserIds: [],
  },
  {
    choiceName: 'Game UID Data',
    value: 'gameUID',
    tableName: 'GameUID',
    fileName: 'Game_UID_Data.csv',
    formatUserIds: ['user_id'],
  },
  {
    choiceName: 'AI Chat History Data',
    value: 'aiChatHistory',
    tableName: 'AiChatHistory',
    fileName: 'AI_Chat_History_Data.csv',
    formatUserIds: [],
  },
  {
    choiceName: 'AI Chat Session Data',
    value: 'aiChatSession',
    tableName: 'AiChatSession',
    fileName: 'AI_Chat_Session_Data.csv',
    formatUserIds: ['user_id'],
  },
  {
    choiceName: 'Birthday Reminder Data',
    value: 'birthdayReminder',
    tableName: 'BirthdayReminder',
    fileName: 'Birthday_Reminder_Data.csv',
    formatUserIds: ['notifier_id', 'tracked_user_id'],
  },
  {
    choiceName: 'Poop Entry Data',
    value: 'poopEntry',
    tableName: 'PoopEntry',
    fileName: 'Poop_Entry_Data.csv',
    formatUserIds: ['user_id'],
  },
  {
    choiceName: 'Poop Profile Data',
    value: 'poopProfile',
    tableName: 'PoopProfile',
    fileName: 'Poop_Profile_Data.csv',
    formatUserIds: ['user_id'],
  },
];

class DBDump extends DevCommand {
  constructor(client: any) {
    super(client, 'dbdump', 'Output a specific database table or all tables.', [
      {
        name: 'table',
        description: 'Select the table to dump',
        type: 3,
        required: true,
        choices: [
          ...DUMP_DEFINITIONS.map((definition) => ({ name: definition.choiceName, value: definition.value })),
          { name: 'All Data', value: 'all' },
        ],
      },
    ], { blame: 'both' });
  }

  async run(interaction: any): Promise<void> {
    const table = interaction.options.getString('table');

    try {
      const filesToDump: { attachment: string; name: string }[] = [];
      const selectedDefinitions = table === 'all'
        ? DUMP_DEFINITIONS
        : DUMP_DEFINITIONS.filter((definition) => definition.value === table);

      for (const definition of selectedDefinitions) {
        const tableData = await this.client.db.dumpTable(definition.tableName, definition.formatUserIds);
        const filePath = await this.createCSVFile(definition.fileName, tableData);
        filesToDump.push({ attachment: filePath, name: definition.fileName });
      }

      if (filesToDump.length === 0) {
        await interaction.editReply({ content: 'No database dump files were generated.' });
      } else {
        const ATTACHMENTS_PER_MESSAGE = 10;
        for (let i = 0; i < filesToDump.length; i += ATTACHMENTS_PER_MESSAGE) {
          const chunk = filesToDump.slice(i, i + ATTACHMENTS_PER_MESSAGE);
          const content = i === 0 ? 'Database dump files:' : 'Additional database dump files:';

          if (i === 0) {
            await interaction.editReply({ content, files: chunk });
          } else {
            await interaction.followUp({ content, files: chunk });
          }
        }
      }

      filesToDump.forEach((file) => {
        this.cleanupFile(file.attachment);
      });

      const databasePath = path.join(import.meta.dir, '../persistence/database.db');

      if (await Bun.file(databasePath).exists()) {
        await interaction.followUp({
          content: 'database:',
          files: [{ attachment: databasePath, name: 'database.db' }],
        });
      }
    } catch (error) {
      logError('Error dumping database:', error);
      await interaction.followUp({ content: 'An error occurred while executing the command.', ephemeral: true });
    }
  }

  async createCSVFile(fileName: string, data: string): Promise<string> {
    const filePath = path.join(import.meta.dir, fileName);
    await Bun.write(filePath, data);
    return filePath;
  }

  cleanupFile(filePath: string): void {
    try {
      unlinkSync(filePath);
    } catch (err) {
      logError(`Failed to delete file ${filePath}:`, err);
    }
  }
}

export default DBDump;
