import {
  Client, REST, Routes, type ClientOptions, type Message, type Interaction,
} from 'discord.js';
import path from 'path';
import { createRequire } from 'node:module';
import Database from '../database/Database';
import BirthdayScheduler from './birthdayScheduler';
import BabyScheduler from './babyScheduler';
import { log, logError } from '../utils/log';
// Note: Bun automatically reads .env files
import seasonConfig from '../data/config/skin/pokemon.json';
import keywordsJson from '../data/keywords.json';
import statusJson from '../data/status.json';
import {
  ChristmasHandler, NormalHandler, HalloweenHandler, AprilFoolsHandler,
} from './handlers/index';
import scriptHandlers from './handlers/keywordsBehaviorHandler';
import quoteDefault from '../utils/quote';
import { loadAllowedServers } from '../utils/accessControl';

const FONT_INDEX: string[] = (quoteDefault as any).FONT_INDEX;
const MAX_MESSAGE_HISTORY = 100;

const handlers: Record<string, any> = {
  ChristmasHandler,
  NormalHandler,
  HalloweenHandler,
  AprilFoolsHandler,
};

const SERIOUS_CHANNELS = ['1262239871758766221'];

/** Given a list of .ts and .js filenames, prefer .ts; only keep a .js file when no .ts counterpart exists. */
function preferTsOverJs(files: string[]): string[] {
  const tsBasenames = new Set(files.filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')));
  return files.filter((file) => {
    if (file.endsWith('.ts')) return true;
    if (file.endsWith('.js')) return !tsBasenames.has(file.replace(/\.js$/, ''));
    return false;
  });
}

class Silverwolf extends Client {
  declare token: string;
  commands: Map<string, any>;
  keywords: any[];
  deletedMessages: any[];
  editedMessages: any[];
  singing: boolean;
  db: any;
  currentPokemon: string | null;
  birthdayScheduler: BirthdayScheduler;
  babyScheduler: BabyScheduler;
  games: string[];
  chat: any;
  sexSessions: any[];

  constructor(token: string, options: ClientOptions) {
    super(options);
    this.token = token;
    this.commands = new Map();
    this.keywords = [];
    this.deletedMessages = [];
    this.editedMessages = [];
    this.singing = false;
    this.db = new Database('./persistence/database.db');
    this.currentPokemon = null;
    this.birthdayScheduler = new BirthdayScheduler(this);
    this.babyScheduler = new BabyScheduler(this);
    this.init();
    this.games = [];
    this.loadGames(); // Initialize the games list from the JSON file
    this.chat = null;
    this.sexSessions = [];
  }

  async init(): Promise<void> {
    log('--------------------\nInitializing Silverwolf...\n--------------------');
    await this.loadCommands();
    await this.loadKeywords();
    await this.loadListeners();
    await this.db.ready;

    await loadAllowedServers(this.db);
    log('Allowed servers loaded from DB.');

    this.birthdayScheduler.start();
    log('Birthday scheduler started.');
    this.babyScheduler.start();
    log('Baby scheduler started.');

    log(`Silverwolf initialized.
----------------------------------------------
____  _ _                              _  __
/ ___|(_) |_   _____ _ ____      _____ | |/ _|
\\___ \\| | \\ \\ / / _ \\ '__\\ \\ /\\ / / _ \\| | |_
 ___) | | |\\ V /  __/ |   \\ V  V / (_) | |  _|
|____/|_|_| \\_/ \\___|_|    \\_/\\_/ \\___/|_|_|
----------------------------------------------
Product of Silverwolf™ Corp.
All wrongs reserved.
----------------------------------------------`);
  }

  async loadCommands(): Promise<void> {
    log('--------------------\nLoading commands...\n--------------------');
    const commandDir = path.join(import.meta.dir, '../commands');
    // Prefer .ts files; only fall back to .js if no .ts version exists
    const allFiles = [...new Bun.Glob('*.{ts,js}').scanSync(commandDir)];
    const commandFiles = preferTsOverJs(allFiles);
    // Use createRequire so CJS command files load correctly (avoids ESM circular-dep issues with some deps)
    const _require = createRequire(import.meta.url);

    let commandCount = 0;
    for (const file of commandFiles) {
      const mod = _require(path.join(commandDir, file));
      const CommandClass = mod.default ?? mod;
      const command = new CommandClass(this);
      if (command.isSubcommandOf === null) {
        this.commands.set(command.name, command);
        log(`Command ${command.name} loaded. ${command.ephemeral ? 'ephemeral' : ''} ${command.skipDefer ? 'skipDefer' : ''} ${command.isSubcommand ? 'isSubcommand' : ''}`);
      } else {
        this.commands.set(`${command.isSubcommandOf}.${command.name}`, command);
        log(`Command ${command.isSubcommandOf}.${command.name} loaded. ${command.ephemeral ? 'ephemeral' : ''} ${command.skipDefer ? 'skipDefer' : ''} ${command.isSubcommand ? 'isSubcommand' : ''}`);
      }
      commandCount += 1;
    }
    log(`${commandCount} commands loaded.`);

    log('--------------------\nLoading command groups...\n--------------------');
    const commandGroupDir = path.join(import.meta.dir, '../commands/commandgroups');
    const allGroupFiles = [...new Bun.Glob('*.{ts,js}').scanSync(commandGroupDir)];
    const commandGroupFiles = preferTsOverJs(allGroupFiles);

    let commandGroupCount = 0;
    for (const file of commandGroupFiles) {
      const mod = _require(path.join(commandGroupDir, file));
      const CommandGroupClass = mod.default ?? mod;
      const commandGroup = new CommandGroupClass(this);
      this.commands.set(commandGroup.name, commandGroup);
      log(`Command group ${commandGroup.name} loaded.`);
      commandGroupCount += 1;
    }
    log(`${commandGroupCount} command groups loaded.`);
  }

  async loadKeywords(): Promise<void> {
    log('--------------------\nLoading keywords...\n--------------------');
    if (!Array.isArray(keywordsJson)) {
      log('Warning: keywordsJson is not an array, defaulting to empty keywords list.');
      this.keywords = [];
      return;
    }
    const raw = keywordsJson as any[];
    this.keywords = raw.filter((entry: any, i: number) => {
      if (!entry || typeof entry !== 'object') {
        log(`Warning: skipping keywords entry at index ${i} (not an object).`);
        return false;
      }
      if (!Array.isArray(entry.triggers) || entry.triggers.length === 0) {
        log(`Warning: skipping keywords entry at index ${i} (missing or empty triggers).`);
        return false;
      }
      if (!entry.triggers.every((t: any) => typeof t === 'string')) {
        log(`Warning: skipping keywords entry at index ${i} (triggers contains non-string).`);
        return false;
      }
      return true;
    });

    this.keywords.forEach((entry: any) => {
      log(`Keyword(s) [${entry.triggers.join(', ')}] loaded.`);
    });

    log('ALL Keywords loaded.');
  }

  async loadListeners(): Promise<void> {
    log('--------------------\nLoading listeners...\n--------------------');
    this.on('clientReady', () => {
      log('Client ready.');
    });
    this.on('messageCreate', (message: Message) => {
      this.processMessage(message);
    });
    this.on('interactionCreate', async (interaction: Interaction) => {
      this.processInteraction(interaction);
    });
    this.on('messageDelete', (message: any) => {
      this.processDelete(message);
    });
    this.on('messageUpdate', (oldMessage: any, newMessage: any) => {
      this.processEdit(oldMessage, newMessage);
    });
    log('Listeners loaded.');
  }

  async processInteraction(interaction: any): Promise<void> {
    if (interaction.isCommand()) {
      if (!interaction.guild) {
        await interaction.reply('commands can only be used in servers.');
        return;
      }
      const command = this.commands.get(interaction.commandName);
      if (!command) return;
      log(`> Command ${command.name} executed by ${interaction.user.username} (${interaction.user.id}) in ${interaction.channel.name} (${interaction.channel.id}) in ${interaction.guild.name} (${interaction.guild.id})`);
      try {
        await command.execute(interaction);
      } catch (error) {
        logError('Error processing interaction:', error);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('del_girlcockx_')) {
        const targetUserId = interaction.customId.replace('del_girlcockx_', '');
        if (interaction.user.id !== targetUserId) {
          await interaction.reply({ content: 'You can only delete your own messages.', ephemeral: true });
          return;
        }
        try {
          await interaction.message.delete();
        } catch (err) {
          logError('Error deleting girlcockx webhook message:', err);
          await interaction.reply({ content: 'Failed to delete message.', ephemeral: true });
        }
      }
    }
  }

  async processMessage(message: any): Promise<void> {
    if (!message.guild) {
      log(`> Message received from ${message.author.username} (${message.author.id}) in DM: ${message.content}`);
      return;
    }

    if (message.author.bot) {
      log(`Bot message received from ${message.author.username} (${message.author.id}) in ${message.channel.name} (${message.channel.id}) in ${message.guild.name} (${message.guild.id}): ${message.content}`);
      return;
    }

    log(`> Message received from ${message.author.username} (${message.author.id}) in ${message.channel.name} (${message.channel.id}) in ${message.guild.name} (${message.guild.id}): ${message.content}`);

    if (Math.random() < 0.01 && !SERIOUS_CHANNELS.includes(message.channel.id)) {
      log('Summoning a pokemon...');
      const handler = await this.getHandler(); // Fetch the handler based on the current season
      await handler.summonPokemon(message); // Use the season-specific summonPokemon method
    }

    if (message.author.id === '993614772354416673' && Math.random() < 0.1) {
      const arlecchino = this.commands.get('arlecchino');
      const interaction = {
        editReply: async (content: any) => {
          await message.reply(content);
        },
        // eslint-disable-next-line no-unused-vars
        followUp: async (_content: any) => {

        },
      };
      arlecchino.run(interaction);
    }

    const msg = message.content.toLowerCase();

    // Check if the message mentions the bot and references another message
    if (message.mentions.has(this.user!.id) && message.reference && message.content.includes(this.user!.id)) {
      const referencedMessageId = message.reference.messageId;
      message.channel.messages.fetch(referencedMessageId).then(async (referencedMessage: any) => {
        const sentMessage = await message.reply({
          content: '<a:quoteLoading:1290494754202583110> Generating...',
        });

        // ── Parse parameters from message content ──────────────────────────
        // Strip the bot mention to get raw parameter text
        const paramText = message.content.replace(/<@!?\d+>/g, '').trim();

        // Parse key:value pairs (no brackets needed)
        const getParam = (key: string): string | null => {
          const re = new RegExp(`(?:^|\\s)${key}:(\\S+)`, 'i');
          const match = re.exec(paramText);
          return match ? match[1].trim() : null;
        };

        // bg:b or bg:w → background colour
        const bgParam = getParam('bg');
        let background = 'black';
        if (bgParam === 'w') background = 'white';
        // 'b' or anything else stays black (default)

        // pfp:server or pfp:global → avatar source
        const pfpParam = getParam('pfp');
        let avatarSource = 'server';
        if (pfpParam === 'global') avatarSource = 'global';

        // pfpc:normal/bw/inverted/sepia/nightmare → profile colour filter
        const pfpcParam = getParam('pfpc');
        const validPfpc = ['normal', 'bw', 'inverted', 'sepia', 'nightmare'];
        const profileColor = (pfpcParam && validPfpc.includes(pfpcParam)) ? pfpcParam : 'normal';

        // font:1-13 → font style (mapped via FONT_INDEX)
        const fontParam = getParam('font');
        let fontStyle = 'sans-serif';
        if (fontParam) {
          const fontNum = parseInt(fontParam, 10);
          if (!Number.isNaN(fontNum) && fontNum >= 1 && fontNum <= FONT_INDEX.length) {
            fontStyle = FONT_INDEX[fontNum - 1]; // 1-indexed for users
          }
        }

        // txt:#hex → text colour
        const txtParam = getParam('txt');
        let textColor = null;
        if (txtParam) {
          // Accept with or without '#' prefix
          const hexTest = /^#?([0-9A-Fa-f]{6})$/.exec(txtParam);
          if (hexTest) textColor = `#${hexTest[1]}`;
        }

        const person = referencedMessage.author;
        let nickname: string;
        if (referencedMessage.webhookId) {
          nickname = referencedMessage.author.username;
        } else {
          const guildMember = await message.guild.members.fetch(referencedMessage.author.id).catch(() => null);
          nickname = guildMember?.nickname || person.username;
        }
        const originalMessage = referencedMessage.content;

        log(`original message: ${originalMessage}`);
        log(`quote params: ${JSON.stringify({
          background, avatarSource, profileColor, fontStyle, textColor,
        })}`);

        const result = await (quoteDefault as any)(
          message.guild,
          person,
          nickname,
          originalMessage,
          background,
          textColor,
          profileColor,
          avatarSource,
          fontStyle,
        );

        await sentMessage.edit({ content: null, files: [result] });
      }).catch(console.error);
      return;
    }

    const matchedEntries = this.keywords.filter((entry: any) => entry.triggers.some((trigger: string) => {
      if (trigger.startsWith('/') && trigger.endsWith('/g')) {
        const regex = new RegExp(trigger.slice(1, -2), 'g');
        return regex.test(msg);
      }
      return msg.includes(trigger);
    }));

    if (matchedEntries.length > 0) {
      const promises = matchedEntries.map(async (matchedEntry: any) => {
        if (matchedEntry.excludeSerious && SERIOUS_CHANNELS.includes(message.channel.id)) {
          return;
        }

        if (matchedEntry.reply) {
          await message.reply(matchedEntry.reply);
        }

        if (matchedEntry.script) {
          const handler = (scriptHandlers as any)[matchedEntry.script];
          if (typeof handler === 'function') {
            try {
              await handler(message);
            } catch (err) {
              logError(`Error running script ${matchedEntry.script}:`, err);
            }
          } else {
            logError(`Script "${matchedEntry.script}" not found.`);
          }
        }
      });

      await Promise.all(promises);
    }
  }

  processDelete(message: any): void {
    const logMsg = `Message deleted by ${message.author.username} (${message.author.id}) in ${message.channel.name} (${message.channel.id}) in ${message.guild.name} (${message.guild.id}): ${message.content}`;
    log(logMsg);

    const replyReference = message.reference?.messageId;
    let repliedMessageContent = null;
    let repliedMessageAuthor = null;

    if (replyReference) {
      // Try to fetch the replied message
      const repliedMessage = message.channel.messages.cache.get(replyReference);
      if (repliedMessage) {
        repliedMessageContent = repliedMessage.content;
        repliedMessageAuthor = repliedMessage.author;
      }
    }

    // Add the deleted message and replied message details
    this.deletedMessages.unshift({
      message,
      repliedMessageContent,
      repliedMessageAuthor,
    });
    if (this.deletedMessages.length > MAX_MESSAGE_HISTORY) this.deletedMessages.length = MAX_MESSAGE_HISTORY;
  }

  processEdit(oldMessage: any, newMessage: any): void {
    if (!oldMessage.guild) {
      log(`> Message edited by ${oldMessage.author.username} (${oldMessage.author.id}) in DM: ${oldMessage.content} -> ${newMessage.content}`);
      return;
    }

    if (oldMessage.author.bot) {
      log(`Bot message edited by ${oldMessage.author.username} (${oldMessage.author.id}) in ${oldMessage.channel.name} (${oldMessage.channel.id}) in ${oldMessage.guild.name} (${oldMessage.guild.id}): ${oldMessage.content} -> ${newMessage.content}`);
      return;
    }

    log(`> Message edited by ${oldMessage.author.username} (${oldMessage.author.id}) in ${oldMessage.channel.name} (${oldMessage.channel.id}) in ${oldMessage.guild.name} (${oldMessage.guild.id}): ${oldMessage.content} -> ${newMessage.content}`);
    this.editedMessages.unshift({ old: oldMessage, new: newMessage });
    if (this.editedMessages.length > MAX_MESSAGE_HISTORY) this.editedMessages.length = MAX_MESSAGE_HISTORY;
  }

  async registerCommands(clientId: string | undefined): Promise<void> {
    const dbServers = await this.db.globalConfig.getGlobalConfig('allowed_servers');
    const rest = new REST({ version: '10' }).setToken(this.token);

    // Build the full command list
    const commandValues = Array.from(this.commands.values());
    const validCommands = commandValues.filter((command: any) => command !== null && command.isSubcommandOf === null);
    const allCommandsArray = validCommands.map((command: any) => command.toJSON());

    if (!dbServers) {
      // No servers registered yet — only register /server globally so /server register is available
      const serverCommand = allCommandsArray.find((cmd: any) => cmd.name === 'server');
      const globalCommands = serverCommand ? [serverCommand] : [];
      log('No allowed_servers in DB. Registering /server command globally.');
      await rest.put(Routes.applicationCommands(clientId!), { body: globalCommands });
      log(`Registered ${globalCommands.length} command(s) globally.`);
      return;
    }

    const guildIds = dbServers.split(',');

    // Servers exist — keep /server globally, register everything else per-guild
    const serverCommand = allCommandsArray.find((cmd: any) => cmd.name === 'server');
    const globalCommands = serverCommand ? [serverCommand] : [];
    await rest.put(Routes.applicationCommands(clientId!), { body: globalCommands });
    log(`Registered ${globalCommands.length} global command(s) (keeping /server).`);

    // Loop over each guild ID
    await Promise.all(guildIds.map(async (guildId: string) => {
      try {
        // Retrieve blacklisted commands for the guild
        const blacklistedCommandsData = await this.db.commandConfig.getBlacklistedCommands(guildId);
        log(`Blacklisted commands for guild ${guildId}: ${blacklistedCommandsData}`);

        // Extract just the command names from the data
        const blacklistedCommands = blacklistedCommandsData.map((item: any) => item.commandName);

        // Create a copy of the commands array
        const commandValues = Array.from(this.commands.values());
        // eslint-disable-next-line max-len
        const validCommands = commandValues.filter((command: any) => command !== null && command.isSubcommandOf === null);
        const commandsArray = validCommands.map((command: any) => command.toJSON());

        // If there are no blacklisted commands, register all commands
        if (blacklistedCommands.length === 0) {
          log(`No blacklisted commands for guild ${guildId}. Registering all commands.`);
          await rest.put(
            Routes.applicationGuildCommands(clientId!, guildId),
            { body: commandsArray },
          );

          log(`Successfully registered ${commandsArray.length} commands for guild ${guildId}.`);
        } else {
          // Remove blacklisted commands from the array
          const filteredCommandsArray = commandsArray.filter((command: any) => {
            if (blacklistedCommands.includes(command.name)) {
              log(`Excluding blacklisted command "${command.name}" for guild: ${guildId}`);
              return false; // Exclude the command if blacklisted
            } if (!this.commands.has(command.name)) {
              console.warn(`Warning: Command "${command.name}" not found in the registered commands for guild: ${guildId}. It may have been misspelled.`);
            }
            return true; // Include non-blacklisted commands
          });

          // Register the filtered commands for this guild
          log(`Registering commands for guild: ${guildId}`);
          await rest.put(
            Routes.applicationGuildCommands(clientId!, guildId),
            { body: filteredCommandsArray },
          );

          log(`Successfully registered ${filteredCommandsArray.length} commands for guild ${guildId}.`);
        }
      } catch (error) {
        logError(`Error registering commands for guild ${guildId}:`, error);
      }
    }));

    log('All commands registered successfully.');
    log('Successfully finished startup.');
    log('=======================================================');
  }

  setRandomGame(): void {
    if (!this.games || this.games.length === 0) return;
    const randomGame = this.games[Math.floor(Math.random() * this.games.length)];
    this.user!.setPresence({
      activities: [{
        name: randomGame,
        type: 0, // 0 is for playing, 1 is for streaming, 2 is for listening, etc.
      }],
      status: 'online', // Modify this if you want different statuses like 'idle', 'dnd', etc.
    });

    // Log the game change and schedule the next one
    let randomInterval: number;
    if (randomGame === 'on bed with Ei') {
      randomInterval = (Math.floor(Math.random() * 3) + 1) * 60 * 1000; // Random interval between 1 and 3 minutes
    } else {
      randomInterval = (Math.floor(Math.random() * 3) + 1) * 60 * 60 * 1000; // Random interval between 1 and 3 hours
    }
    log(`Setting status to "${randomGame}". Next change in ${randomInterval / 1000 / 60} minutes.`);

    setTimeout(() => this.setRandomGame(), randomInterval); // Schedule the next game change
  }

  loadGames(): void {
    try {
      const games = (statusJson as any).games;
      if (games && Array.isArray(games) && games.length > 0) {
        this.games = games.filter((g: unknown) => typeof g === 'string' && g.trim().length > 0);
      }
      log(`Games loaded from status.json: ${this.games}`);
    } catch (error) {
      logError('Error loading games from status.json:', error);
    }
  }

  async login(): Promise<string> {
    await super.login(this.token);
    log(`Logged in as ${this.user!.tag}`);
    this.setRandomGame(); // Start cycling through games after logging in
    return this.token;
  }

  async getHandler(): Promise<any> {
    const currentSeason = await this.db.globalConfig.getGlobalConfig('season') || 'normal';
    const seasons = (seasonConfig as any).seasons;
    const resolvedSeason = seasons[currentSeason] ? currentSeason : 'normal';
    const HandlerClass = handlers[seasons[resolvedSeason].handler];
    const settings = seasons[resolvedSeason].settings || {};
    return new HandlerClass(settings);
  }

  setCurrentPokemon(pokemon: string): void {
    this.currentPokemon = pokemon;
  }
}

export { Silverwolf };
