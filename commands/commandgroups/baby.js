const { CommandGroup } = require("../classes/commandGroup.js");

class Baby extends CommandGroup {
    constructor(client){
        super(client, "baby", "Baby commands", ["get", "name"]);
    }
}

module.exports = Baby;
