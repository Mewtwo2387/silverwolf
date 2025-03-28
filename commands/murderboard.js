const { Command } = require('./classes/command.js');
const LeaderboardMixin = require('./mixins/leaderboardMixin.js');

class MurderBoard extends LeaderboardMixin(Command) {
    constructor(client){
        super(client, 
            "murderboard", 
            "criminal records",
            "Murder Leaderboard",
            "murder_success",
            "Successful Murders",
            "No successful murders yet!"
        )
    }
}

module.exports = MurderBoard;