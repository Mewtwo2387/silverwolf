const { CommandGroup } = require("../classes/commandGroup.js");

class Ping extends CommandGroup {
    constructor(client){
        super(client, "ping", "pong", ["regular", "dev"]);
    }
}

module.exports = Ping;