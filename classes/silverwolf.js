const { Client, REST, Routes } = require("discord.js");
const { Database } = require("./database.js");
const fs = require("fs");
const path = require("path");

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
        this.init();
    }

    async init(){
        await this.loadCommands();
        await this.loadKeywords();
        await this.loadListeners();
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
        console.log(`Message received from ${message.author.username}: ${message.content}`);
        const msg = message.content.toLowerCase();
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

    async login(){
        await super.login(this.token);
        console.log(`Logged in as ${this.user.tag}`);
    }
}

module.exports = { Silverwolf };