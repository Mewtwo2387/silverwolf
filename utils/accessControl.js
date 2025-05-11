const Discord = require('discord.js');
require('dotenv').config();

const ALLOWED_USERS = process.env.ALLOWED_USERS.split(',');
const BASEMENT_ID = '969953667597893672';

function isDev(interaction) {
  return ALLOWED_USERS.includes(interaction.user.id);
}

function isAdmin(interaction) {
  return interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator) || isDev(interaction);
}

function isBasement(interaction) {
  return interaction.guild.id === BASEMENT_ID;
}

module.exports = { isDev, isAdmin, isBasement };
