const { Client, REST, Routes, EmbedBuilder, escapeMarkdown, AttachmentBuilder } = require("discord.js");
const { Database } = require("./database.js");
const fs = require("fs");
const path = require("path");
const BirthdayScheduler = require('./birthdayScheduler');
const Canvas = require('canvas');
const { log, logError } = require('../utils/log');
// const CharacterAI = require('node_characterai')
require('dotenv').config();
const seasonConfig = require('../data/config/skin/pokemon.json');
const { ChristmasHandler, NormalHandler, HalloweenHandler } = require('./seasonHandler.js');

const handlers = {
    ChristmasHandler,
    NormalHandler,
    HalloweenHandler
};

class Silverwolf extends Client {
    constructor(token, options){
        super(options);
        this.token = token;
        this.commands = new Map();
        this.keywords = {};
        this.deletedMessages = [];
        this.editedMessages = [];
        this.singing = false;
        this.db = new Database();
        this.currentPokemon = null;
        this.birthdayScheduler = new BirthdayScheduler(this);
        this.init();
        this.games = [];
        this.loadGames(); // Initialize the games list from the JSON file
        this.chat = null;
        // try{
        //     this.loadSilverwolfAI();
        // }catch(error){
        //     log("Error loading Silverwolf AI: ", error)
        // }
    }

    async init(){
        log("--------------------\nInitializing Silverwolf...\n--------------------");
        await this.loadCommands();
        await this.loadKeywords();
        await this.loadListeners();

        this.birthdayScheduler.start();

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

    async loadCommands(){
        log("--------------------\nLoading commands...\n--------------------");
        const commandDir = path.join(__dirname, "../commands");
        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith(".js"));

        for (const file of commandFiles) {
            const CommandClass = require(path.join(commandDir, file));
            // log(CommandClass);
            const command = new CommandClass(this);
            this.commands.set(command.name, command);
            log(`Command ${command.name} loaded. ${command.ephemeral ? "ephemeral" : ""} ${command.skipDefer ? "skipDefer" : ""} ${command.isSubcommand ? "isSubcommand" : ""}`);
        }
        log("Commands loaded.");
        
        log("--------------------\nLoading command groups...\n--------------------");
        const commandGroupDir = path.join(__dirname, "../commands/commandgroups");
        const commandGroupFiles = fs.readdirSync(commandGroupDir).filter(file => file.endsWith(".js"));
        for (const file of commandGroupFiles) {
            const CommandGroupClass = require(path.join(commandGroupDir, file));
            const commandGroup = new CommandGroupClass(this);
            this.commands.set(commandGroup.name, commandGroup);
            log(`Command group ${commandGroup.name} loaded.`);
        }
        log("Command groups loaded.");
    }

    async loadKeywords(){
        log("--------------------\nLoading keywords...\n--------------------");
        const keywordsFile = path.join(__dirname, "../data/keywords.json");
        const keywords = fs.readFileSync(keywordsFile, "utf8");
        this.keywords = JSON.parse(keywords);
        for (const [keyword, reply] of Object.entries(this.keywords)){
            // log(`Keyword: ${keyword} -> ${reply}`);
            log(`Keyword ${keyword} loaded.`);
        }
        log("Keywords loaded.");
    }

    async loadListeners(){
        log("--------------------\nLoading listeners...\n--------------------");
        this.on("ready", () => {
            log("Client ready.");
        });
        this.on("messageCreate", (message) => {
            this.processMessage(message);
        });
        this.on("interactionCreate", async (interaction) => {
            this.processInteraction(interaction);
        });
        this.on("messageDelete", (message) => {
            this.processDelete(message);
        });
        this.on("messageUpdate", (oldMessage, newMessage) => {
            this.processEdit(oldMessage, newMessage);
        });
        log("Listeners loaded.");
    }

    processInteraction(interaction){
        if(interaction.isCommand()){
            if(!interaction.guild){
                interaction.reply("commands can only be used in servers.");
                return;
            }
            const command = this.commands.get(interaction.commandName);
            if(!command) return;
            log(`Command ${command.name} executed by ${interaction.user.username} (${interaction.user.id}) in ${interaction.channel.name} (${interaction.channel.id}) in ${interaction.guild.name} (${interaction.guild.id})`);
            try{
                command.execute(interaction);
            }catch(error){
                logError(error);
            }
        }
    }

    async processMessage(message) {
        if (message.author.bot || !message.guild) return;
        log(`Message received from ${message.author.username} (${message.author.id}) in ${message.channel.name} (${message.channel.id}) in ${message.guild.name} (${message.guild.id}): ${message.content}`);
        
        if (Math.random() < 0.01 && message.channel.name !== "super-serious-secret-vent-rant-chat") {
            log("Summoning a pokemon...");
            const handler = await this.getHandler(); // Fetch the handler based on the current season
            await handler.summonPokemon(message);    // Use the season-specific summonPokemon method
        }

        if(message.author.id == '993614772354416673' && Math.random() < 0.1){
            const arlecchino = this.commands.get("arlecchino");
            const interaction = {
                editReply: async (content) => {
                    await message.reply(content);
                },
                followUp: async (content) => {
                    return
                }
            }
            arlecchino.run(interaction);
        }
    
        const msg = message.content.toLowerCase();
    
        // Check if the message mentions the bot and references another message
        if (message.mentions.has(this.user.id) && message.reference && message.content.includes(this.user.id)) {
            const referencedMessageId = message.reference.messageId;
            message.channel.messages.fetch(referencedMessageId).then(async referencedMessage => {
                const sentMessage = await message.reply({
                    content: "<a:quoteLoading:1290494754202583110> Generating...",
                });
                const guildMember = await message.guild.members.fetch(referencedMessage.author.id);
                const person = referencedMessage.author;
                const nickname = guildMember.nickname || person.username;
                const originalMessage = referencedMessage.content;
                const pfp = guildMember.displayAvatarURL({ extension: 'png', size: 512 });
                const hasBlackAndWhitePfp = msg.includes('b');
                const hasWhiteBackground = msg.includes('w');
                
                const background = hasWhiteBackground ? 'white' : 'black';
                const profileColor = hasBlackAndWhitePfp ? 'bw' : 'normal';
                const fakeQuoteCommand = this.commands.get("fakequote");
                if (fakeQuoteCommand) {
                    const interaction = {
                        options: {
                            getUser: (name) => ({ username: person.username, displayAvatarURL: () => pfp }),
                            getString: (name) => {
                                if (name === "message") return originalMessage;
                                if (name === "nickname") return nickname;
                                if (name === "background") return background;
                                if (name === "profile_color") return profileColor;
                                return "";
                            }
                        },
                        editReply: async (content) => {
                            if (content && content.files && content.files[0]) {                                
                                // After generating the quote or image...
                                await sentMessage.edit({ content: null, files: [content.files[0]] });                                                              
                            } else {
                                logError('No file or content to send in the reply.');
                            }
                        }
                    };            
                    // Run the fake quote generation
                    fakeQuoteCommand.run(interaction);
                }
            }).catch(console.error);            
            return;
        }
    
        for (const [keyword, reply] of Object.entries(this.keywords)) {
            if (msg.includes(keyword)) {
                message.reply(reply);
                return;
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
            repliedMessageAuthor
        });
    }

    processEdit(oldMessage, newMessage){
        log(`Message edited by ${oldMessage.author.username} (${oldMessage.author.id}) in ${oldMessage.channel.name} (${oldMessage.channel.id}) in ${oldMessage.guild.name} (${oldMessage.guild.id}): ${oldMessage.content} -> ${newMessage.content}`);
        this.editedMessages.unshift({old: oldMessage, new: newMessage});
    }

    async registerCommands(clientId) {
        const guildIds = process.env.GUILD_ID.split(','); // Split the GUILD_IDs into an array
        const rest = new REST({ version: "10" }).setToken(this.token);
    
        // Loop over each guild ID
        for (const guildId of guildIds) {
            try {
                // Retrieve blacklisted commands for the guild
                const blacklistedCommandsData = await this.db.getBlacklistedCommands(guildId);
                log(`Blacklisted commands for guild ${guildId}:`, blacklistedCommandsData);
    
                // Extract just the command names from the data
                const blacklistedCommands = blacklistedCommandsData.map(item => item.command_name);
    
                // Create a copy of the commands array
                const commandsArray = Array.from(this.commands.values()).map(command => command.toJSON()).filter(command => command !== null);
    
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
                    const filteredCommandsArray = commandsArray.filter(command => {
                        if (blacklistedCommands.includes(command.name)) {
                            log(`Excluding blacklisted command "${command.name}" for guild: ${guildId}`);
                            return false; // Exclude the command if blacklisted
                        } else if (!this.commands.has(command.name)) {
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
        }
    
        log("All commands registered successfully.");
        log("Successfully finished startup.");
        log("=======================================================")
    }

    setRandomGame(){
        const randomGame = this.games[Math.floor(Math.random() * this.games.length)];
        this.user.setPresence({
            activities: [{
                name: randomGame,
                type: 0 // 0 is for playing, 1 is for streaming, 2 is for listening, etc.
            }],
            status: 'online' // Modify this if you want different statuses like 'idle', 'dnd', etc.
        });

        // Log the game change and schedule the next one
        let randomInterval;
        if (randomGame == "on bed with Ei"){
            randomInterval = (Math.floor(Math.random() * 3) + 1) * 60 * 1000; // Random interval between 1 and 3 minutes
        }else{
            randomInterval = (Math.floor(Math.random() * 3) + 1) * 60 * 60 * 1000; // Random interval between 1 and 3 hours
        }
        log(`Setting status to "${randomGame}". Next change in ${randomInterval / 1000 / 60} minutes.`);

        setTimeout(() => this.setRandomGame(), randomInterval); // Schedule the next game change
    }

    loadGames(){
        const filePath = path.join(__dirname, "../data/status.json");
        try {
            const data = fs.readFileSync(filePath, "utf8");
            const json = JSON.parse(data);
            this.games = json.games || [];
            log("Games loaded from status.json:", this.games);
        } catch (error) {
            logError("Error loading games from status.json:", error);
        }
    }

    // async loadSilverwolfAI(){
    //     const silverwolf = new CharacterAI()

    //     await silverwolf.authenticateWithToken(process.env.CAI_TOKEN)

    //     const characterId = "rIY3dqqU-WwbHbjzJlac1f4aXYO1j7aYdri_5k4uDNM"

    //     this.chat = await silverwolf.createOrContinueChat(characterId)

    //     log("Silverwolf AI loaded.")
    // }

    async login(){
        await super.login(this.token);
        log(`Logged in as ${this.user.tag}`);
        this.setRandomGame(); // Start cycling through games after logging in
    }


    async getHandler() {
        const currentSeason = await this.db.getGlobalConfig("season") || "normal";
        const handlerClass = handlers[seasonConfig.seasons[currentSeason].handler];
        const settings = seasonConfig.seasons[currentSeason].settings || {};
        return new handlerClass(settings);
    }
}

module.exports = { Silverwolf };