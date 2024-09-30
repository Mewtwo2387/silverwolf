const { AdminCommand } = require("./classes/admincommand.js");

class Say extends AdminCommand {
    constructor(client) {
        super(client, "say", "say something", [
            {
                name: 'message',
                description: 'The message to say',
                type: 3, // STRING type
                required: true
            },
            {
                name: 'attachment',
                description: 'Optional attachment to send with the message',
                type: 11, // ATTACHMENT type
                required: false
            }
        ], true);
    }

    async run(interaction) {
        const input = interaction.options.getString('message').replace(/@/g, ''); 
        const attachment = interaction.options.getAttachment('attachment'); 

        try {
            // Construct the message object with the optional attachment
            const messageOptions = {
                content: input,
                files: attachment ? [attachment.url] : [] // Add the attachment if it exists
            };

            // Send the message in the channel
            await interaction.channel.send(messageOptions);

            // Send an ephemeral reply with the channel mention
            await interaction.editReply({
                content: `Message sent to <#${interaction.channel.id}>.`,
                ephemeral: true
            });
        } catch (error) {
            console.error(error);

            // Send an error message
            await interaction.editReply({
                content: 'Error (Jez, is that you again?).',
                ephemeral: true
            });
        }
    }
}

module.exports = Say;
