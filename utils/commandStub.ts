import path from 'path';
import { createRequire } from 'node:module';
import { log, logError } from './log';
import { runCommandInSubprocess, applyResponse, serializeInteraction } from './commandWorker';

export interface ManifestCommandEntry {
  kind: 'command';
  name: string;
  description: string;
  options: any[];
  isSubcommandOf: string | null;
  ephemeral: boolean;
  skipDefer: boolean;
  isInteractive: boolean;
  file: string;
}

const _require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dir, '..');

export interface CommandStub {
  __stub: true;
  name: string;
  description: string;
  options: any[];
  isSubcommandOf: string | null;
  ephemeral: boolean;
  skipDefer: boolean;
  isInteractive: boolean;
  file: string;
  client: any;
  toJSON(): object | null;
  execute(interaction: any): Promise<void>;
}

export function createCommandStub(client: any, entry: ManifestCommandEntry): CommandStub {
  const stub: CommandStub = {
    __stub: true,
    name: entry.name,
    description: entry.description,
    options: entry.options,
    isSubcommandOf: entry.isSubcommandOf,
    ephemeral: entry.ephemeral,
    skipDefer: entry.skipDefer,
    isInteractive: entry.isInteractive,
    file: entry.file,
    client,
    toJSON(): object | null {
      if (this.isSubcommandOf === null) {
        return { name: this.name, description: this.description, options: this.options };
      }
      return null;
    },
    async execute(interaction: any): Promise<void> {
      if (this.isInteractive === false) {
        await runViaSubprocess(this, interaction);
        return;
      }
      await loadAndDispatch(this, interaction);
    },
  };
  return stub;
}

async function runViaSubprocess(stub: CommandStub, interaction: any): Promise<void> {
  if (!stub.skipDefer && !interaction.deferred && !interaction.replied) {
    try { await interaction.deferReply({ ephemeral: stub.ephemeral }); } catch (err) {
      logError(`[stub:${stub.name}] deferReply failed:`, err);
    }
  }
  let resp;
  try {
    resp = await runCommandInSubprocess(stub.file, serializeInteraction(interaction));
  } catch (err) {
    logError(`[stub:${stub.name}] subprocess threw:`, err);
    resp = { error: 'Subprocess crashed.' };
  }
  await applyResponse(interaction, resp, stub.name);
}

async function loadAndDispatch(stub: CommandStub, interaction: any): Promise<void> {
  const abs = path.join(repoRoot, stub.file);
  let real;
  try {
    const mod = _require(abs);
    const Cls = mod.default ?? mod;
    real = new Cls(stub.client);
  } catch (err) {
    logError(`[stub:${stub.name}] failed to load module ${stub.file}:`, err);
    if (interaction.deferred) {
      await interaction.editReply('Internal error loading command.');
    } else {
      await interaction.reply({ content: 'Internal error loading command.', ephemeral: true });
    }
    return;
  }

  const key = stub.isSubcommandOf === null ? stub.name : `${stub.isSubcommandOf}.${stub.name}`;
  stub.client.commands.set(key, real);
  log(`[lazy] loaded ${key} from ${stub.file}`);

  await real.execute(interaction);
}
