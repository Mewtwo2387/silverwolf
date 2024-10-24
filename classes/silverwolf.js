const { Client, REST, Routes, EmbedBuilder, escapeMarkdown, AttachmentBuilder } = require("discord.js");
const { Database } = require("./database.js");
const fs = require("fs");
const path = require("path");
const BirthdayScheduler = require('./birthdayScheduler');
const Canvas = require('canvas');
// const CharacterAI = require('node_characterai')

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
        //     console.log("Error loading Silverwolf AI: ", error)
        // }
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

    processMessage(message) {
        if (message.author.bot) return;
        if (!message.guild) return;
        console.log(`Message received from ${message.author.username}: ${message.content}`);
    
        if (Math.random() < 0.01 && !(message.channel.name == "super-serious-secret-vent-rant-chat")) {
            console.log("Summoning a pokemon...");
            this.summonPokemon(message);
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
                                console.error('No file or content to send in the reply.');
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
        console.log("successfully finished startup")
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

    // async loadSilverwolfAI(){
    //     const silverwolf = new CharacterAI()

    //     await silverwolf.authenticateWithToken(process.env.CAI_TOKEN)

    //     const characterId = "rIY3dqqU-WwbHbjzJlac1f4aXYO1j7aYdri_5k4uDNM"

    //     this.chat = await silverwolf.createOrContinueChat(characterId)

    //     console.log("Silverwolf AI loaded.")
    // }

    async login(){
        await super.login(this.token);
        console.log(`Logged in as ${this.user.tag}`);
        this.setRandomGame(); // Start cycling through games after logging in
    }

    async summonPokemon(message, mode = "normal"){
        const allMembers = await message.guild.members.fetch();
        const members = allMembers.filter(member => !member.user.bot);
        const member = members.random();
        //console.log(member)
        const pfp = await member.user.displayAvatarURL({ extension: 'png', size: 512 });
        if (mode == "shiny" || (mode == "normal" && Math.random() < 0.03)){
            const canvas = Canvas.createCanvas(512, 512);
            const ctx = canvas.getContext("2d");
            const img = await Canvas.loadImage(pfp);
            ctx.drawImage(img, 0, 0, 512, 512);
            const imageData = ctx.getImageData(0, 0, 512, 512);
            const data = imageData.data;

            // Invert colors
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];       // Red
                data[i + 1] = 255 - data[i + 1]; // Green
                data[i + 2] = 255 - data[i + 2]; // Blue
                // Alpha (data[i + 3]) remains unchanged
            }

            ctx.putImageData(imageData, 0, 0);

            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'shiny.png' });
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A shiny ${escapeMarkdown(member.user.username)} appeared!`)
                .setImage('attachment://shiny.png')
                .setColor("#00FF00")
                .setFooter({ text: "catch them with /catch [username] shiny!" })
            ], files: [attachment]})
            this.currentPokemon = member.user.username + " shiny";
        }else if (mode == "mystery" || (mode == "normal" && Math.random() < 0.3)){
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A wild ??? appeared!`)
                .setImage(pfp)
                .setColor("#00FF00")
                .setFooter({ text: "guess the username and catch with /catch [username]!" })
            ]})
            this.currentPokemon = member.user.username;
        }else{
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A wild ${escapeMarkdown(member.user.username)} appeared!`)
                .setImage(pfp)
                .setColor("#00FF00")
                .setFooter({ text: "catch them with /catch [username]!" })
            ]})
            this.currentPokemon = member.user.username;
        }
    }
}

module.exports = { Silverwolf };