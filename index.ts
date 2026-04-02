import { GatewayIntentBits } from 'discord.js';
import { log, logError } from './utils/log';
import { Silverwolf } from './classes/silverwolf';

// Note: Bun automatically reads .env files, no dotenv needed

if (!process.env.TOKEN) {
  logError('No token provided');
  throw new Error('No token provided');
}

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

log(`TOKEN: ${TOKEN}`);
log(`CLIENT_ID: ${CLIENT_ID}`);

const silverwolf = new Silverwolf(TOKEN, {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

silverwolf.login().then(() => silverwolf.registerCommands(CLIENT_ID));
