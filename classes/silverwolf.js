const {
  Client, REST, Routes,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('../database/Database');
const BirthdayScheduler = require('./birthdayScheduler');
const BabyScheduler = require('./babyScheduler');
const { log, logError } = require('../utils/log');
require('dotenv').config();
const seasonConfig = require('../data/config/skin/pokemon.json');
const {
  ChristmasHandler, NormalHandler, HalloweenHandler, AprilFoolsHandler,
} = require('./handlers/index');
const scriptHandlers = require('./handlers/keywordsBehaviorHandler');
const quote = require('../utils/quote');

const handlers = {
  ChristmasHandler,
  NormalHandler,
  HalloweenHandler,
  AprilFoolsHandler,
};

class Silverwolf extends Client {
  constructor(token, options) {
    super(options);
    this.token = token;
    this.commands = new Map();
    this.keywords = {};
    this.deletedMessages = [];
    this.editedMessages = [];
    this.singing = false;
    this.db = new Database('./database.db');
    this.currentPokemon = null;
    this.birthdayScheduler = new BirthdayScheduler(this);
    this.babyScheduler = new BabyScheduler(this);
    this.init();
    this.games = [];
    this.loadGames(); // Initialize the games list from the JSON file
    this.chat = null;
    this.sexSessions = [];
  }

  async init() {
    log('--------------------\nInitializing Silverwolf...\n--------------------');
    await this.loadCommands();
    await this.loadKeywords();
    await this.loadListeners();
    await this.db.ready;

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

  async loadCommands() {
    log('--------------------\nLoading commands...\n--------------------');
    const commandDir = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandDir).filter((file) => file.endsWith('.js'));

    const commandCount = await commandFiles.reduce(async (countPromise, file) => {
      const count = await countPromise;
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const CommandClass = require(path.join(commandDir, file));
      const command = new CommandClass(this);
      if (command.isSubcommandOf === null) {
        this.commands.set(command.name, command);
        log(`Command ${command.name} loaded. ${command.ephemeral ? 'ephemeral' : ''} ${command.skipDefer ? 'skipDefer' : ''} ${command.isSubcommand ? 'isSubcommand' : ''}`);
      } else {
        this.commands.set(`${command.isSubcommandOf}.${command.name}`, command);
        log(`Command ${command.isSubcommandOf}.${command.name} loaded. ${command.ephemeral ? 'ephemeral' : ''} ${command.skipDefer ? 'skipDefer' : ''} ${command.isSubcommand ? 'isSubcommand' : ''}`);
      }
      return count + 1;
    }, 0);
    log(`${commandCount} commands loaded.`);

    log('--------------------\nLoading command groups...\n--------------------');
    const commandGroupDir = path.join(__dirname, '../commands/commandgroups');
    const commandGroupFiles = fs.readdirSync(commandGroupDir).filter((file) => file.endsWith('.js'));

    const commandGroupCount = commandGroupFiles.reduce((count, file) => {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const CommandGroupClass = require(path.join(commandGroupDir, file));
      const commandGroup = new CommandGroupClass(this);
      this.commands.set(commandGroup.name, commandGroup);
      log(`Command group ${commandGroup.name} loaded.`);
      return count + 1;
    }, 0);
    log(`${commandGroupCount} command groups loaded.`);
  }

  async loadKeywords() {
    log('--------------------\nLoading keywords...\n--------------------');
    const keywordsFile = path.join(__dirname, '../data/keywords.json');
    const keywordsRaw = fs.readFileSync(keywordsFile, 'utf8');
    this.keywords = JSON.parse(keywordsRaw);

    this.keywords.forEach((entry) => {
      log(`Keyword(s) [${entry.triggers.join(', ')}] loaded.`);
    });

    log('ALL Keywords loaded.');
  }

  async loadListeners() {
    log('--------------------\nLoading listeners...\n--------------------');
    this.on('ready', () => {
      log('Client ready.');
    });
    this.on('messageCreate', (message) => {
      this.processMessage(message);
    });
    this.on('interactionCreate', async (interaction) => {
      this.processInteraction(interaction);
    });
    this.on('messageDelete', (message) => {
      this.processDelete(message);
    });
    this.on('messageUpdate', (oldMessage, newMessage) => {
      this.processEdit(oldMessage, newMessage);
    });
    log('Listeners loaded.');
  }

  processInteraction(interaction) {
    if (interaction.isCommand()) {
      if (!interaction.guild) {
        interaction.reply('commands can only be used in servers.');
        return;
      }
      const command = this.commands.get(interaction.commandName);
      if (!command) return;
      log(`> Command ${command.name} executed by ${interaction.user.username} (${interaction.user.id}) in ${interaction.channel.name} (${interaction.channel.id}) in ${interaction.guild.name} (${interaction.guild.id})`);
      try {
        command.execute(interaction);
      } catch (error) {
        logError(error);
      }
    }
  }

  async processMessage(message) {
    if (!message.guild) {
      log(`> Message received from ${message.author.username} (${message.author.id}) in DM: ${message.content}`);
      return;
    }

    if (message.author.bot) {
      log(`Bot message received from ${message.author.username} (${message.author.id}) in ${message.channel.name} (${message.channel.id}) in ${message.guild.name} (${message.guild.id}): ${message.content}`);
      return;
    }

    log(`> Message received from ${message.author.username} (${message.author.id}) in ${message.channel.name} (${message.channel.id}) in ${message.guild.name} (${message.guild.id}): ${message.content}`);

    if (Math.random() < 0.01 && message.channel.name !== 'super-serious-secret-vent-rant-chat') {
      log('Summoning a pokemon...');
      const handler = await this.getHandler(); // Fetch the handler based on the current season
      await handler.summonPokemon(message); // Use the season-specific summonPokemon method
    }

    if (message.author.id === '993614772354416673' && Math.random() < 0.1) {
      const arlecchino = this.commands.get('arlecchino');
      const interaction = {
        editReply: async (content) => {
          await message.reply(content);
        },
        // eslint-disable-next-line no-unused-vars
        followUp: async (_content) => {

        },
      };
      arlecchino.run(interaction);
    }

    const msg = message.content.toLowerCase();

    // Check if the message mentions the bot and references another message
    if (message.mentions.has(this.user.id) && message.reference && message.content.includes(this.user.id)) {
      const referencedMessageId = message.reference.messageId;
      message.channel.messages.fetch(referencedMessageId).then(async (referencedMessage) => {
        const sentMessage = await message.reply({
          content: '<a:quoteLoading:1290494754202583110> Generating...',
        });
        const guildMember = await message.guild.members.fetch(referencedMessage.author.id);
        const person = referencedMessage.author;
        const nickname = guildMember.nickname || person.username;
        const originalMessage = referencedMessage.content;
        const hasBlackAndWhitePfp = msg.includes('b');
        const hasWhiteBackground = msg.includes('w');

        const background = hasWhiteBackground ? 'white' : 'black';
        const profileColor = hasBlackAndWhitePfp ? 'bw' : 'normal';
        const avatarSource = 'server';

        const result = await quote(
          message.guild,
          person,
          nickname,
          originalMessage,
          background,
          profileColor,
          avatarSource,
        );

        await sentMessage.edit({ content: null, files: [result] });
      }).catch(console.error);
      return;
    }

    const matchedEntry = this.keywords.find((entry) => entry.triggers.some((trigger) => {
      if (trigger.startsWith('/') && trigger.endsWith('/g')) {
        const regex = new RegExp(trigger.slice(1, -2), 'g');
        return regex.test(msg);
      }
      return msg.includes(trigger);
    }));

    if (matchedEntry) {
      if (matchedEntry.reply) {
        await message.reply(matchedEntry.reply);
      }

      if (matchedEntry.script) {
        const handler = scriptHandlers[matchedEntry.script];
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
    }
  }

  processDelete(message) {
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
  }

  processEdit(oldMessage, newMessage) {
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
  }

  async registerCommands(clientId) {
    const guildIds = process.env.GUILD_ID.split(','); // Split the GUILD_IDs into an array
    const rest = new REST({ version: '10' }).setToken(this.token);

    // Loop over each guild ID
    await Promise.all(guildIds.map(async (guildId) => {
      try {
        // Retrieve blacklisted commands for the guild
        const blacklistedCommandsData = await this.db.commandConfig.getBlacklistedCommands(guildId);
        log(`Blacklisted commands for guild ${guildId}:`, blacklistedCommandsData);

        // Extract just the command names from the data
        const blacklistedCommands = blacklistedCommandsData.map((item) => item.commandName);

        // Create a copy of the commands array
        const commandValues = Array.from(this.commands.values());
        const validCommands = commandValues.filter((command) => command !== null && command.isSubcommandOf === null);
        const commandsArray = validCommands.map((command) => command.toJSON());

        console.log(JSON.stringify(commandsArray, null, 2));

        // If there are no blacklisted commands, register all commands
        if (blacklistedCommands.length === 0) {
          log(`No blacklisted commands for guild ${guildId}. Registering all commands.`);
          const response = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commandsArray },
          );

          log(`Successfully registered commands for guild ${guildId}:`, response);
        } else {
          // Remove blacklisted commands from the array
          const filteredCommandsArray = commandsArray.filter((command) => {
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
          const response = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: filteredCommandsArray },
          );

          log(`Successfully registered commands for guild ${guildId}:`, response);
        }
      } catch (error) {
        logError(`Error registering commands for guild ${guildId}:`, error);
      }
    }));

    log('All commands registered successfully.');
    log('Successfully finished startup.');
    log('=======================================================');
  }

  setRandomGame() {
    const randomGame = this.games[Math.floor(Math.random() * this.games.length)];
    this.user.setPresence({
      activities: [{
        name: randomGame,
        type: 0, // 0 is for playing, 1 is for streaming, 2 is for listening, etc.
      }],
      status: 'online', // Modify this if you want different statuses like 'idle', 'dnd', etc.
    });

    // Log the game change and schedule the next one
    let randomInterval;
    if (randomGame === 'on bed with Ei') {
      randomInterval = (Math.floor(Math.random() * 3) + 1) * 60 * 1000; // Random interval between 1 and 3 minutes
    } else {
      randomInterval = (Math.floor(Math.random() * 3) + 1) * 60 * 60 * 1000; // Random interval between 1 and 3 hours
    }
    log(`Setting status to "${randomGame}". Next change in ${randomInterval / 1000 / 60} minutes.`);

    setTimeout(() => this.setRandomGame(), randomInterval); // Schedule the next game change
  }

  loadGames() {
    const filePath = path.join(__dirname, '../data/status.json');
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(data);
      this.games = json.games || [];
      log('Games loaded from status.json:', this.games);
    } catch (error) {
      logError('Error loading games from status.json:', error);
    }
  }

  async login() {
    await super.login(this.token);
    log(`Logged in as ${this.user.tag}`);
    this.setRandomGame(); // Start cycling through games after logging in
  }

  async getHandler() {
    const currentSeason = await this.db.globalConfig.getGlobalConfig('season') || 'normal';
    const HandlerClass = handlers[seasonConfig.seasons[currentSeason].handler];
    const settings = seasonConfig.seasons[currentSeason].settings || {};
    return new HandlerClass(settings);
  }

  setCurrentPokemon(pokemon) {
    this.currentPokemon = pokemon;
  }
}

module.exports = { Silverwolf };
