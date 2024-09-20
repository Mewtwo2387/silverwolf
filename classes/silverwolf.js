const { Client, REST, Routes, EmbedBuilder } = require("discord.js");
const { Database } = require("./database.js");
const fs = require("fs");
const path = require("path");
const BirthdayScheduler = require('./birthdayScheduler');

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
        this.birthdayScheduler = new BirthdayScheduler(this);
        this.init();
        this.games = [];
        this.loadGames(); // Initialize the games list from the JSON file
    }

    async init(){
        await this.loadCommands();
        await this.loadKeywords();
        await this.loadListeners();
        
        this.birthdayScheduler.start();

        console.log("Silverwolf initialized.");
    }

    async loadCommands(){
        const commandDir = path.join(__dirname, "../commands");
        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith(".js"));

        for (const file of commandFiles) {
            const CommandClass = require(path.join(commandDir, file));
            console.log(CommandClass);
            const command = new CommandClass(this);
            this.commands.set(command.name, command);
            console.log(`Command ${command.name} loaded.`);
        }
        console.log("Commands loaded.");
    }

    async loadKeywords(){
        const keywordsFile = path.join(__dirname, "../data/keywords.json");
        const keywords = fs.readFileSync(keywordsFile, "utf8");
        this.keywords = JSON.parse(keywords);
        for (const [keyword, reply] of Object.entries(this.keywords)){
            console.log(`Keyword: ${keyword} -> ${reply}`);
        }
        console.log("Keywords loaded.");
    }

    async loadListeners(){
        this.on("ready", () => {
            console.log("uwu ready");
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
        console.log("Listeners loaded.");
    }

    processInteraction(interaction){
        if(interaction.isCommand()){
            if(!interaction.guild){
                interaction.reply("commands can only be used in servers.");
                return;
            }
            const command = this.commands.get(interaction.commandName);
            if(!command) return;
            console.log(`Command ${command.name} executed by ${interaction.user.tag}`);
            try{
                command.execute(interaction);
            }catch(error){
                console.error(error);
            }
        }
    }

    processMessage(message){
        if(message.author.bot) return;
        if(!message.guild) return;
        console.log(`Message received from ${message.author.username}: ${message.content}`);

        if(Math.random() < 0.01 && !(message.channel.name == "super-serious-secret-vent-rant-chat")){
            console.log("Summoning a pokemon...");
            this.summonPokemon(message);
        }

        const msg = message.content.toLowerCase();

        if (message.mentions.has(this.user.id) && message.reference && message.content.includes(this.user.id)) {
            const referencedMessageId = message.reference.messageId;
            message.channel.messages.fetch(referencedMessageId).then(async referencedMessage => {
                const guildMember = await message.guild.members.fetch(referencedMessage.author.id);
                const person = referencedMessage.author;
                const nickname = guildMember.nickname || person.username;
                const originalMessage = referencedMessage.content;
                const pfp = guildMember.displayAvatarURL({ extension: 'png', size: 512 });
    
                // Find the "fakequote" command and execute it
                const fakeQuoteCommand = this.commands.get("fakequote");
                if (fakeQuoteCommand) {
                    const interaction = {
                        options: {
                            getUser: (name) => ({ username: person.username, displayAvatarURL: () => pfp }),
                            getString: (name) => {
                                if (name === "message") return originalMessage;
                                if (name === "nickname") return nickname;
                                return "";
                            }
                        },
                        editReply: async (content) => {
                            // Simulate sending the image in the reply
                            message.reply({ files: [content.files[0]] });
                        }
                    };
                    
                    fakeQuoteCommand.run(interaction);
                }
            }).catch(console.error);
            return;
        }

        for (const [keyword, reply] of Object.entries(this.keywords)){
            if(msg.includes(keyword)){
                message.reply(reply);
                return;
            }
        }
    }

    processDelete(message){
        console.log(`Message deleted by ${message.author.username}: ${message.content}`);
        this.deletedMessages.unshift(message);
    }

    processEdit(oldMessage, newMessage){
        console.log(`Message edited by ${oldMessage.author.username}: ${oldMessage.content} -> ${newMessage.content}`);
        this.editedMessages.unshift({old: oldMessage, new: newMessage});
    }

    async registerCommands(clientId){
        const commandsArray = Array.from(this.commands.values()).map(command => ({
            name: command.name,
            description: command.description,
            options: command.options
        }));
        console.log(commandsArray);
        const rest = new REST({ version: "10" }).setToken(this.token);
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commandsArray },
        );
        console.log("Commands registered.");
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
        const randomInterval = (Math.floor(Math.random() * 3) + 1) * 60 * 60 * 1000; // Random interval between 1 and 3 hours
        console.log(`Setting status to "${randomGame}". Next change in ${randomInterval / 1000 / 60} minutes.`);

        setTimeout(() => this.setRandomGame(), randomInterval); // Schedule the next game change
    }

    loadGames(){
        const filePath = path.join(__dirname, "../data/status.json");
        try {
            const data = fs.readFileSync(filePath, "utf8");
            const json = JSON.parse(data);
            this.games = json.games || [];
            console.log("Games loaded from status.json:", this.games);
        } catch (error) {
            console.error("Error loading games from status.json:", error);
        }
    }

    async login(){
        await super.login(this.token);
        console.log(`Logged in as ${this.user.tag}`);
        this.setRandomGame(); // Start cycling through games after logging in
    }

    async summonPokemon(message){
        const allMembers = await message.guild.members.fetch();
        const members = allMembers.filter(member => !member.user.bot);
        const member = members.random();
        //console.log(member)
        const pfp = member.user.displayAvatarURL({ format: "png", size: 512 });
        message.channel.send({ embeds:[ new EmbedBuilder()
            .setTitle(`A wild ${member.user.username} appeared!`)
            .setImage(pfp)
            .setColor("#00FF00")
            .setFooter({ text: "catch them with /catch [username]!" })
        ]})
    }
}

module.exports = { Silverwolf };