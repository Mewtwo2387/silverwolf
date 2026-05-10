/**
 * Subprocess command runner. Reads {commandFile, ctx} JSON from stdin,
 * dynamic-imports the command, runs it against a shim client + shim
 * interaction, and writes the captured response actions as JSON to stdout.
 *
 * stdout is reserved for the final JSON envelope. ALL log output is
 * redirected to stderr so it doesn't corrupt the protocol.
 */

import path from 'path';

const stdoutWrite = process.stdout.write.bind(process.stdout);
// Redirect any stray console.log to stderr so stdout stays clean.
const origConsoleLog = console.log;
console.log = (...args: any[]) => { console.error(...args); };
// Some libs use process.stdout.write directly — redirect those too.
process.stdout.write = ((chunk: any, ...rest: any[]) => process.stderr.write(chunk, ...rest)) as any;

interface SerializedAttachment { id: string; name: string; url: string; size: number; contentType: string | null }
interface SerializedOption { name: string; type: number; value: any; options?: SerializedOption[] }
interface SerializedInteractionCtx {
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
  isDev: boolean;
  alreadyDeferred: boolean;
}
interface WorkerAction {
  kind: 'editReply' | 'reply' | 'followUp';
  payload: { content?: string | null; embeds?: any[]; files?: { name: string; b64: string }[]; ephemeral?: boolean };
}

const repoRoot = path.resolve(import.meta.dir, '..');

function findOption(options: SerializedOption[], name: string): SerializedOption | undefined {
  for (const o of options) {
    if (o.name === name) return o;
    if (o.options) {
      const inner = findOption(o.options, name);
      if (inner) return inner;
    }
  }
  return undefined;
}

function buildOptionsAccessor(ctx: SerializedInteractionCtx): any {
  const subcommand = ctx.options.find((o) => o.type === 1);
  const flatOptions = subcommand?.options ?? ctx.options;
  const attachmentsById = new Map(ctx.attachments.map((a) => [a.id, a]));

  return {
    data: ctx.options,
    getSubcommand(): string {
      if (!subcommand) throw new Error('No subcommand present in interaction options');
      return subcommand.name;
    },
    getString(name: string, required = false): string | null {
      const o = findOption(flatOptions, name);
      if (!o) {
        if (required) throw new Error(`Required option '${name}' missing`);
        return null;
      }
      return typeof o.value === 'string' ? o.value : String(o.value);
    },
    getBoolean(name: string, required = false): boolean | null {
      const o = findOption(flatOptions, name);
      if (!o) {
        if (required) throw new Error(`Required option '${name}' missing`);
        return null;
      }
      return !!o.value;
    },
    getNumber(name: string, required = false): number | null {
      const o = findOption(flatOptions, name);
      if (!o) {
        if (required) throw new Error(`Required option '${name}' missing`);
        return null;
      }
      return Number(o.value);
    },
    getInteger(name: string, required = false): number | null {
      const o = findOption(flatOptions, name);
      if (!o) {
        if (required) throw new Error(`Required option '${name}' missing`);
        return null;
      }
      return Math.trunc(Number(o.value));
    },
    getUser(name: string, required = false): any {
      const o = findOption(flatOptions, name);
      if (!o) {
        if (required) throw new Error(`Required option '${name}' missing`);
        return null;
      }
      return { id: o.value };
    },
    getAttachment(name: string, required = false): SerializedAttachment | null {
      const o = findOption(flatOptions, name);
      if (!o) {
        if (required) throw new Error(`Required option '${name}' missing`);
        return null;
      }
      return attachmentsById.get(String(o.value)) ?? null;
    },
  };
}

function normalizePayload(input: any): WorkerAction['payload'] {
  if (typeof input === 'string') return { content: input };
  const out: WorkerAction['payload'] = {};
  if (input?.content !== undefined) out.content = input.content;
  if (input?.embeds) {
    out.embeds = input.embeds.map((e: any) => (typeof e?.toJSON === 'function' ? e.toJSON() : e));
  }
  if (input?.files) {
    out.files = input.files.map((f: any) => {
      const buf = Buffer.isBuffer(f.attachment) ? f.attachment : Buffer.from(f.attachment ?? '');
      return { name: f.name ?? 'file', b64: buf.toString('base64') };
    });
  }
  if (input?.ephemeral !== undefined) out.ephemeral = input.ephemeral;
  return out;
}

function buildShimInteraction(ctx: SerializedInteractionCtx): { interaction: any; actions: WorkerAction[] } {
  const actions: WorkerAction[] = [];
  let deferred = ctx.alreadyDeferred;
  let replied = false;

  const interaction: any = {
    commandName: ctx.commandName,
    user: { id: ctx.userId, username: ctx.username, tag: ctx.userTag, bot: false },
    guild: ctx.guildId ? { id: ctx.guildId, name: ctx.guildName } : null,
    guildId: ctx.guildId,
    channel: ctx.channelId ? { id: ctx.channelId, name: ctx.channelName } : null,
    channelId: ctx.channelId,
    member: { permissions: { has: () => false } },
    options: buildOptionsAccessor(ctx),
    get deferred() { return deferred; },
    get replied() { return replied; },
    async deferReply(_opts?: any): Promise<void> { deferred = true; },
    async editReply(payload: any): Promise<void> {
      actions.push({ kind: 'editReply', payload: normalizePayload(payload) });
      replied = true;
    },
    async reply(payload: any): Promise<void> {
      actions.push({ kind: 'reply', payload: normalizePayload(payload) });
      replied = true;
    },
    async followUp(payload: any): Promise<void> {
      actions.push({ kind: 'followUp', payload: normalizePayload(payload) });
    },
  };
  return { interaction, actions };
}

async function buildShimClient(ctx: SerializedInteractionCtx): Promise<any> {
  const { default: Database } = await import('../database/Database');
  const db = new Database('./persistence/database.db');
  await db.ready;
  return {
    db,
    user: { id: 'silverwolf-worker' },
    commands: new Map(),
    keywords: [],
    deletedMessages: [],
    editedMessages: [],
    games: [],
    sexSessions: [],
    chat: null,
    currentPokemon: null,
    __ctx: ctx,
  };
}

function emit(response: { actions?: WorkerAction[]; error?: string }): void {
  stdoutWrite(JSON.stringify(response));
}

async function readStdinJson(): Promise<{ commandFile: string; ctx: SerializedInteractionCtx }> {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk.toString();
  return JSON.parse(raw);
}

async function main(): Promise<void> {
  let parsed: { commandFile: string; ctx: SerializedInteractionCtx };
  try {
    parsed = await readStdinJson();
  } catch (err) {
    emit({ error: `Failed to parse stdin: ${(err as Error).message}` });
    process.exit(1);
    return;
  }
  const { commandFile, ctx } = parsed;

  const { interaction, actions } = buildShimInteraction(ctx);

  let client;
  try {
    client = await buildShimClient(ctx);
  } catch (err) {
    emit({ error: `Failed to init shim client: ${(err as Error).message}` });
    process.exit(1);
    return;
  }

  let CommandClass;
  try {
    const abs = path.join(repoRoot, commandFile);
    const mod = await import(abs);
    CommandClass = mod.default ?? mod;
  } catch (err) {
    emit({ error: `Failed to import ${commandFile}: ${(err as Error).message}` });
    process.exit(1);
    return;
  }

  let command;
  try {
    command = new CommandClass(client);
  } catch (err) {
    emit({ error: `Failed to instantiate ${commandFile}: ${(err as Error).message}` });
    process.exit(1);
    return;
  }

  try {
    if (typeof command.run === 'function') {
      // Bypass Command.execute's banned-check / defer logic — parent already
      // deferred. Run the body directly.
      await command.run(interaction);
    } else {
      await command.execute(interaction);
    }
  } catch (err) {
    console.error(`[worker:${commandFile}] command threw:`, err);
    if (actions.length === 0) {
      emit({ error: `Command failed: ${(err as Error).message}` });
      process.exit(1);
      return;
    }
  }

  emit({ actions });
  // Suppress an unused-binding warning for origConsoleLog while keeping it bound for emergencies.
  void origConsoleLog;
  process.exit(0);
}

main().catch((err) => {
  emit({ error: `Worker crashed: ${(err as Error).message}` });
  process.exit(1);
});
