const { log, logError } = require('./utils/log');

const { GatewayIntentBits } = require("discord.js");
const { config } = require("dotenv");
const { Silverwolf } = require("./classes/silverwolf");


config();

if(!process.env.TOKEN) {
    logError("No token provided");
    process.exit(1);
}

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

log("TOKEN: ", TOKEN);
log("CLIENT_ID: ", CLIENT_ID);

const silverwolf = new Silverwolf(TOKEN, {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
})

silverwolf.login().then(() => {
    silverwolf.registerCommands(CLIENT_ID);
})


