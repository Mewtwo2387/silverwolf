const { CommandGroup } = require('../classes/commandGroup');

class Ai extends CommandGroup {
    constructor(client) {
        super(client, 'ai', 'Manage your AI chat sessions', ['view', 'chatswitch', 'chatdelete']);
    }
}

module.exports = Ai;
