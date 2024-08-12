const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);

class AskGeminiCommand extends Command {
    constructor(client) {
        super(client, "ask-silverwolf-ai", "wow this is so cool, should i add an ai art command ?", [
            {
                name: "prompt",
                description: "The prompt",
                type: 3,  // STRING type
                required: true
            }
        ]);
    }

    async run(interaction) {
        const prompt = interaction.options.getString('prompt');

        // Send an initial loading message
        const loadingMessage = await interaction.editReply({ content: 'Loading...', fetchReply: true });

        try {
            // Get the model and generate content
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = await response.text();  // Await the text extraction

            // Create an embed to format the response
            const embed = new EmbedBuilder()
                .setTitle('Silverwolf Ai says:')
                .setDescription(text)
                .setColor(0x0099ff)
                .setFooter({ text: 'Powered by ChatTGP', iconURL: 'https://media.discordapp.net/attachments/969953667597893675/1272422507533828106/Qzrb7Us.png?ex=66baeb4e&is=66b999ce&hm=cf4e7ed0da32e823e5ceb90cd94b1abf3e54cc19f447e38a0aef572af68cd04b&=&format=webp&quality=lossless&width=899&height=899' });

            // Edit the message with the actual response
            await interaction.editReply({ content: null, embeds: [embed] });
        } catch (error) {
            console.error('Error generating text:', error);
            await interaction.editReply({ content: 'Failed to retrieve response from Gemini AI. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = AskGeminiCommand;
