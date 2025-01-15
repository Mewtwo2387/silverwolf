const { CommandGroup } = require("../classes/commandGroup.js");

class Dev extends CommandGroup {
    constructor(client){
        super(client, "dev", "Developer commands", ["add", "set", "forcesummon", "testsummon"]);
    }
}

module.exports = Dev;