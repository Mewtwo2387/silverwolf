const { Command } = require('./classes/command.js');

class BabyEnslave extends Command {
    constructor(client){
        super(client, "enslave", "enslave a baby", [
            {
                name: "id",
                description: "The id of the baby",
                type: 4,
                required: true
            },
            {
                name: "job",
                description: "The job to force the baby to do",
                type: 3,
                required: true,
                choices: [
                    {
                        name: "Nuggie Claimer",
                        value: "nuggie_claimer",
                        description: "Auto claim nuggies"
                    },
                    {
                        name: "Gambler",
                        value: "gambler",
                        description: "Auto play slots"
                    }
                ]
            }
        ], { isSubcommandOf: "baby" });
    }

    async run(interaction){
      const babyId = interaction.options.get("id").value;
      const job = interaction.options.get("job").value;

      const baby = await this.client.db.getBabyFromId(babyId);

      if (!baby){
          await interaction.editReply({
              content: "Invalid baby id!"
          });
          return;
      }

      if (baby.mother_id != interaction.user.id && baby.father_id != interaction.user.id){
          await interaction.editReply({
              content: "This is not your baby smh smh"
          });
          return;
      }

      if (baby.status == "unborn"){
        await interaction.editReply({
            content: "This baby is not born yet!"
        });
        return;
      }

      if (baby.status == "dead"){
        await interaction.editReply({
            content: "This baby is dead!"
        });
        return;
      }

      await this.client.db.updateBabyJob(babyId, job);

      await interaction.editReply({
        content: `${baby.name} is now a ${job}!`
      });
    }
}

module.exports = BabyEnslave;
