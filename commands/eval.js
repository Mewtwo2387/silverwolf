const { DevCommand } = require("./classes/devcommand.js");

class Eval extends DevCommand {
    constructor(client){
        super(client, "eval", "evaluate js code. most dangerous command???", [{
            name: "code",
            description: "js code",
            type: 3,
            required: true
        }]);
    }

    async run(interaction){
        const input = interaction.options.getString("code");
        try{
            interaction.editReply(eval(input)+'');
        }catch(error){
            interaction.editReply(`Error: ${error.message}`);
        }
    }
}

module.exports = Eval;