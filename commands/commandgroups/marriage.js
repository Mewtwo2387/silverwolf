const { CommandGroup } = require('../classes/commandGroup.js');

class Marriage extends CommandGroup {
    constructor(client) {
        super(client, "marriage", "Marriage commands", ["divorce", "propose", "status"]);
    }
}

module.exports = Marriage;