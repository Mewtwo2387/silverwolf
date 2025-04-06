const { GoogleGenerativeAI } = require('@google/generative-ai');
const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');
require('dotenv').config();
const { log, logError } = require('../utils/log.js');
const { unformatFile } = require('../utils/formatter.js');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);
const systemInstruction = unformatFile('./data/SilverwolfSystemPrompt.txt');
class AskGeminiCommand extends Command {
  constructor(client) {
    super(client, 'ask-silverwolf-ai', 'wow this is so cool, should i add an ai art command ?', [
      {
        name: 'prompt',
        description: 'The prompt',
        type: 3,
        required: true,
      },
      {
        name: 'reset',
        description: 'Reset the chat session',
        type: 5,
        required: false,
      },
    ]);
  }

  async run(interaction) {
    let prompt = interaction.options.getString('prompt');
    const reset = interaction.options.getBoolean('reset');
    const { username } = interaction.user;

    prompt = `${username}: ${prompt}`;

    const loadingMessage = await interaction.editReply({ content: 'Loading...', fetchReply: true });

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction,
      });

      const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'text/plain',
      };

      const lastSession = await this.client.db.getLastActiveServerChatSession(interaction.guild.id);

      log(`Last session: ${lastSession}`);

      let session = lastSession;

      if (reset) {
        if (!lastSession || lastSession == undefined) {
          session = await this.client.db.startChatSession(interaction.user.id, interaction.guild.id);
        } else {
          await this.client.db.endChatSession(lastSession.session_id);
          session = await this.client.db.startChatSession(interaction.user.id, interaction.guild.id);
        }
      } else if (!lastSession || lastSession == undefined) {
        session = await this.client.db.startChatSession(interaction.user.id, interaction.guild.id);
      } else {
        session = lastSession;
      }

      const rawChatHistory = await this.client.db.getChatHistory(session.session_id);

      const chatHistory = rawChatHistory.reverse().map((entry) => ({
        role: entry.role === 'assistant' ? 'model' : entry.role,
        parts: [{ text: entry.message }],
      }));

      if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
        chatHistory.shift();
      }
      console.log(chatHistory.map((entry) => `${entry.role}: ${entry.parts[0].text}`).join('\n'));

      const chatSession = model.startChat({ generationConfig, history: chatHistory });
      const result = await chatSession.sendMessage(prompt);
      const response = await result.response;
      const text = await response.text();
      const processedText = text.replace('(Trailblazer)', username);

      log(`Original: ${text}`);
      log(`Processed: ${processedText}`);

      const embed = new EmbedBuilder()
        .setTitle('Silverwolf Ai says:')
        .setDescription(processedText)
        .setColor(0x0099ff)
        .setFooter({ text: 'Powered by ChatTGP', iconURL: 'https://media.discordapp.net/attachments/969953667597893675/1272422507533828106/Qzrb7Us.png?ex=66baeb4e&is=66b999ce&hm=cf4e7ed0da32e823e5ceb90cd94b1abf3e54cc19f447e38a0aef572af68cd04b&=&format=webp&quality=lossless&width=899&height=899' });

      await interaction.editReply({ content: null, embeds: [embed] });

      // Store user and assistant messages in the database
      await this.client.db.addChatHistory(session.session_id, 'user', prompt);
      await this.client.db.addChatHistory(session.session_id, 'model', processedText);
    } catch (error) {
      logError('Error generating text:', error);
      await interaction.editReply({ content: 'Failed to retrieve response from Gemini AI. Please try again later.', ephemeral: true });
    }
  }
}

module.exports = AskGeminiCommand;
