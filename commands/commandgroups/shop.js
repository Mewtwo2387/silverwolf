const { CommandGroup } = require("../classes/commandGroup.js");

class Shop extends CommandGroup {
    constructor(client){
        super(client, "shop", "shop commands", ["ascension", "upgrades", "upgradesdata", "donation"]);
    }
}

module.exports = Shop;