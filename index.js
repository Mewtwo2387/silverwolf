const { GatewayIntentBits } = require('discord.js');
const { config } = require('dotenv');
const { log, logError } = require('./utils/log');
const { Silverwolf } = require('./classes/silverwolf');

config();

if (!process.env.TOKEN) {
  logError('No token provided');
  process.exit(1);
}

const { TOKEN } = process.env;
const { CLIENT_ID } = process.env;

log('TOKEN: ', TOKEN);
log('CLIENT_ID: ', CLIENT_ID);

const silverwolf = new Silverwolf(TOKEN, {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

silverwolf.login().then(() => {
  silverwolf.registerCommands(CLIENT_ID);
});
