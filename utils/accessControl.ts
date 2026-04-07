import { PermissionsBitField, type ChatInputCommandInteraction } from 'discord.js';
// Note: Bun automatically reads .env files

const ALLOWED_USERS = process.env.ALLOWED_USERS!.split(',');
const BASEMENT_ID = '969953667597893672';
const ALLOWED_SERVERS: string | string[] = process.env.ALLOWED_SERVERS ? process.env.ALLOWED_SERVERS.split(',') : BASEMENT_ID;

function isDev(interaction: ChatInputCommandInteraction): boolean {
  return ALLOWED_USERS.includes(interaction.user.id);
}

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  // eslint-disable-next-line max-len
  return (interaction.member?.permissions as PermissionsBitField)?.has(PermissionsBitField.Flags.Administrator) || isDev(interaction);
}

function isBasement(interaction: ChatInputCommandInteraction): boolean {
  return interaction.guild?.id === BASEMENT_ID;
}

function isAllowedServer(interaction: ChatInputCommandInteraction): boolean {
  return Array.isArray(ALLOWED_SERVERS)
    ? ALLOWED_SERVERS.includes(interaction.guild?.id ?? '')
    : ALLOWED_SERVERS === interaction.guild?.id;
}

export {
  isDev,
  isAdmin,
  isBasement,
  isAllowedServer,
};
