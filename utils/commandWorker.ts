import path from 'path';
import { fileURLToPath } from 'url';
import { logError, log } from './log';

const SUBPROCESS_TIMEOUT_MS = 60_000;
const WORKER_PATH = fileURLToPath(new URL('./commandRunner.worker.ts', import.meta.url));

const ALLOWED_USERS = (process.env.ALLOWED_USERS || '').split(',').filter(Boolean);

export interface SerializedAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string | null;
}

export interface SerializedOption {
  name: string;
  type: number;
  value: any;
  options?: SerializedOption[];
}

export interface SerializedInteractionCtx {
  commandName: string;
  userId: string;
  userTag: string;
  username: string;
  guildId: string | null;
  guildName: string | null;
  channelId: string | null;
  channelName: string | null;
  options: SerializedOption[];
  attachments: SerializedAttachment[];
  ephemeralDefault: boolean;
  isDev: boolean;
  alreadyDeferred: boolean;
}

export interface WorkerAction {
  kind: 'editReply' | 'reply' | 'followUp';
  payload: {
    content?: string | null;
    embeds?: any[];
    files?: { name: string; b64: string }[];
    ephemeral?: boolean;
  };
}

export interface WorkerResponse {
  actions?: WorkerAction[];
  error?: string;
}

function serializeOption(opt: any): SerializedOption {
  return {
    name: opt.name,
    type: opt.type,
    value: opt.value,
    options: opt.options ? opt.options.map(serializeOption) : undefined,
  };
}

export function serializeInteraction(interaction: any): SerializedInteractionCtx {
  const optionsData: any[] = interaction.options?.data ?? [];
  const attachments: SerializedAttachment[] = [];
  for (const att of (interaction.options?.resolved?.attachments?.values?.() ?? [])) {
    attachments.push({
      id: att.id, name: att.name, url: att.url, size: att.size, contentType: att.contentType ?? null,
    });
  }
  return {
    commandName: interaction.commandName,
    userId: interaction.user.id,
    userTag: interaction.user.tag ?? interaction.user.username,
    username: interaction.user.username,
    guildId: interaction.guild?.id ?? null,
    guildName: interaction.guild?.name ?? null,
    channelId: interaction.channel?.id ?? null,
    channelName: interaction.channel?.name ?? null,
    options: optionsData.map(serializeOption),
    attachments,
    ephemeralDefault: false,
    isDev: ALLOWED_USERS.includes(interaction.user.id),
    alreadyDeferred: !!interaction.deferred,
  };
}

export async function runCommandInSubprocess(
  commandFile: string,
  ctx: SerializedInteractionCtx,
): Promise<WorkerResponse> {
  const payload = JSON.stringify({ commandFile, ctx });

  let proc;
  const spawnedAt = Date.now();
  try {
    proc = Bun.spawn({
      cmd: [process.execPath, '--smol', WORKER_PATH, commandFile],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
    });
  } catch (err) {
    logError(`[worker:${commandFile}] failed to spawn:`, err);
    return { error: 'Could not start command subprocess.' };
  }

  const killTimer = setTimeout(() => {
    try { proc.kill(); } catch { /* already gone */ }
  }, SUBPROCESS_TIMEOUT_MS);

  let stdoutText = '';
  let exitCode: number | null = null;
  try {
    proc.stdin.write(payload);
    await proc.stdin.end();
    stdoutText = await new Response(proc.stdout).text();
    exitCode = await proc.exited;
  } catch (err) {
    logError(`[worker:${commandFile}] i/o failed:`, err);
    return { error: 'Subprocess communication failed.' };
  } finally {
    clearTimeout(killTimer);
  }

  const elapsed = Date.now() - spawnedAt;
  log(`[worker:${commandFile}] exit=${exitCode} ms=${elapsed}`);

  if (exitCode !== 0 && !stdoutText) {
    logError(`[worker:${commandFile}] exited ${exitCode} with no output`);
    return { error: 'Subprocess produced no output.' };
  }

  let parsed: WorkerResponse;
  try {
    parsed = JSON.parse(stdoutText);
  } catch (err) {
    logError(`[worker:${commandFile}] invalid JSON:`, err);
    return { error: 'Subprocess returned invalid output.' };
  }
  return parsed;
}

function decodeFiles(files?: { name: string; b64: string }[]): any[] | undefined {
  if (!files || files.length === 0) return undefined;
  return files.map((f) => ({ attachment: Buffer.from(f.b64, 'base64'), name: f.name }));
}

export async function applyResponse(
  interaction: any,
  resp: WorkerResponse,
  label = 'command',
): Promise<void> {
  if (resp.error || !resp.actions || resp.actions.length === 0) {
    const message = resp.error
      ? `Subprocess error: ${resp.error}`
      : 'No response from command subprocess.';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    } catch (err) {
      logError(`[worker:${label}] failed to send error reply:`, err);
    }
    return;
  }

  for (const action of resp.actions) {
    const files = decodeFiles(action.payload.files);
    const opts: any = {};
    if (action.payload.content !== undefined) opts.content = action.payload.content;
    if (action.payload.embeds) opts.embeds = action.payload.embeds;
    if (files) opts.files = files;
    if (action.payload.ephemeral !== undefined) opts.ephemeral = action.payload.ephemeral;

    try {
      switch (action.kind) {
        case 'editReply':
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(opts);
          } else {
            await interaction.reply(opts);
          }
          break;
        case 'reply':
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(opts);
          } else {
            await interaction.reply(opts);
          }
          break;
        case 'followUp':
          await interaction.followUp(opts);
          break;
        default:
          logError(`[worker:${label}] unknown action kind: ${(action as any).kind}`);
      }
    } catch (err) {
      logError(`[worker:${label}] action ${action.kind} failed:`, err);
    }
  }
}

// Suppress unused import lint
void path;
