const { CommandGroup } = require('../classes/commandGroup.js');

class Blacklist extends CommandGroup {
    constructor(client) {
        super(client, "blacklist", "Blacklist commands", ["configure", "view"]);
    }
}

module.exports = Blacklist;