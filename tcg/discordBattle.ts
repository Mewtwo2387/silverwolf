import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import type { Battle } from './battle';
import type { Character } from './character';
import {
  executeUseSkill,
  formatAllyStatusForDiscord,
  formatBattleForDiscord,
  formatUseSkillFailureMessage,
  formatUseSkillMessage,
  statusLine as battleStatusLine,
} from './battleInterface';
import { renderBattleBoardPng } from './renderDiscordBattleBoard';

export { createDemoBattle, resolveTargetForSkill } from './battleInterface';

export interface DiscordBattleSession {
  battle: Battle;
  p1UserId: string;
  p2UserId: string;
  p1Tag: string;
  p2Tag: string;
}

/** P1 has locked in a team; waiting for P2 to `/tcgbattle accept`. */
export interface DiscordBattlePending {
  p1UserId: string;
  p2UserId: string;
  p1Tag: string;
  p2Tag: string;
  p1Team: Character[];
}

const sessions = new Map<string, DiscordBattleSession>();
const pendingByChannel = new Map<string, DiscordBattlePending>();

export function getSession(channelId: string): DiscordBattleSession | undefined {
  return sessions.get(channelId);
}

export function setSession(channelId: string, session: DiscordBattleSession): void {
  pendingByChannel.delete(channelId);
  sessions.set(channelId, session);
}

export function clearSession(channelId: string): void {
  sessions.delete(channelId);
}

export function getPending(channelId: string): DiscordBattlePending | undefined {
  return pendingByChannel.get(channelId);
}

export function setPending(channelId: string, pending: DiscordBattlePending): void {
  pendingByChannel.set(channelId, pending);
}

export function clearPending(channelId: string): void {
  pendingByChannel.delete(channelId);
}

/** Clears an active battle and any open challenge in this channel. */
export function clearChannelTcgbattleState(channelId: string): void {
  sessions.delete(channelId);
  pendingByChannel.delete(channelId);
}

export function isPendingOnly(channelId: string): boolean {
  return pendingByChannel.has(channelId) && !sessions.has(channelId);
}

export function channelHasTcgbattleActivity(channelId: string): boolean {
  return sessions.has(channelId) || pendingByChannel.has(channelId);
}

export function sideForPendingUser(pending: DiscordBattlePending, userId: string): 'p1' | 'p2' | null {
  if (userId === pending.p1UserId) return 'p1';
  if (userId === pending.p2UserId) return 'p2';
  return null;
}

export function pendingChallengeHint(pending: DiscordBattlePending): string {
  if (pending.p1UserId === pending.p2UserId) {
    return 'Run `/tcgbattle accept` with your **P2** team of three to begin (solo: you control both sides). `/tcgbattle cancel` to abort.';
  }
  return `Waiting for <@${pending.p2UserId}> to \`/tcgbattle accept\` with a team of three, or either player can \`/tcgbattle cancel\`.`;
}

export function sideForUser(session: DiscordBattleSession, userId: string): 'p1' | 'p2' | null {
  const isP1 = userId === session.p1UserId;
  const isP2 = userId === session.p2UserId;
  if (!isP1 && !isP2) return null;
  if (session.p1UserId === session.p2UserId) {
    return session.battle.currentPlayer;
  }
  if (isP1) return 'p1';
  return 'p2';
}

export function formatBattleText(session: DiscordBattleSession): string {
  return formatBattleForDiscord(session.battle, session.p1Tag, session.p2Tag);
}

export function formatAllyStatusText(session: DiscordBattleSession, side: 'p1' | 'p2', charIndex: number): string {
  const r = formatAllyStatusForDiscord(session.battle, side, charIndex);
  return r.ok ? r.text : r.error;
}

export function tryUseSkill(
  session: DiscordBattleSession,
  side: 'p1' | 'p2',
  charIndex: number,
  skillIndex: number,
  targetRaw: string | null,
): { ok: true; message: string } | { ok: false; error: string } {
  const r = executeUseSkill(session.battle, side, charIndex, skillIndex, targetRaw);
  if (!r.ok) {
    return { ok: false, error: formatUseSkillFailureMessage(r) };
  }
  return { ok: true, message: formatUseSkillMessage(r.detail, 'markdown') };
}

/** Discord embeds: status line for the battle in this session. */
export function statusLine(session: DiscordBattleSession): string {
  return battleStatusLine(session.battle, 'markdown');
}

export async function battleDisplayPayload(
  session: DiscordBattleSession,
  description: string,
  options?: { title?: string; color?: number },
): Promise<{ embeds: EmbedBuilder[]; files: AttachmentBuilder[] }> {
  const buffer = await renderBattleBoardPng(session.battle);
  const attachment = new AttachmentBuilder(buffer, { name: 'tcg-battle.png' });
  const embed = new EmbedBuilder()
    .setColor(options?.color ?? 0x5865f2)
    .setTitle(options?.title ?? 'TCG battle')
    .setDescription(description.slice(0, 4096))
    .setImage('attachment://tcg-battle.png');
  return { embeds: [embed], files: [attachment] };
}

/** Replace a prior rich battle message with plain text (clears embeds/attachments). */
export async function editReplyPlain(interaction: any, text: string): Promise<void> {
  await interaction.editReply({
    content: text.slice(0, 2000),
    embeds: [],
    files: [],
  });
}
