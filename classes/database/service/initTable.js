// Import all schema definitions
const user = require('../schemas/user');
const pokemon = require('../schemas/pokemon');
const marriage = require('../schemas/marriage');
const serverRoles = require('../schemas/serverRoles');
const gameUID = require('../schemas/gameUid');
const commandConfig = require('../schemas/commandConfig');
const globalConfig = require('../schemas/globalConfig');
const baby = require('../schemas/baby');
const chatSession = require('../schemas/chatSession');
const chatHistory = require('../schemas/chatHistory'); 

const schemas = [
    user,
    pokemon,
    marriage,
    serverRoles,
    gameUID,
    commandConfig,
    globalConfig,
    baby,
    chatSession,
    chatHistory
];

// Initialize all tables using the provided CoreDatabase instance
async function initializeTables(coreDbInstance) {
    for (const schema of schemas) {
        await coreDbInstance.createTable(schema);  // <- use coreDbInstance
    }

    for (const schema of schemas) {
        await coreDbInstance.updateTable(schema);  // <- use coreDbInstance
    }
}

module.exports = { initializeTables };
