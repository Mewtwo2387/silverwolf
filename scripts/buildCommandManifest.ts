import path from 'path';
import fs from 'fs';
import { createRequire } from 'node:module';

interface CommandEntry {
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

interface GroupEntry {
  kind: 'group';
  name: string;
  description: string;
  isSubcommandOf: null;
  subcommands: string[];
  file: string;
}

type ManifestEntry = CommandEntry | GroupEntry;

interface Manifest {
  version: number;
  generatedAt: string;
  entries: ManifestEntry[];
}

function preferTsOverJs(files: string[]): string[] {
  const tsBasenames = new Set(
    files.filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')),
  );
  return files.filter((file) => {
    if (file.endsWith('.ts')) return true;
    if (file.endsWith('.js')) return !tsBasenames.has(file.replace(/\.js$/, ''));
    return false;
  });
}

const repoRoot = path.resolve(import.meta.dir, '..');
const commandsDir = path.join(repoRoot, 'commands');
const groupsDir = path.join(commandsDir, 'commandgroups');
const manifestOut = path.join(commandsDir, 'manifest.json');

const _require = createRequire(import.meta.url);

const dbProxy: any = new Proxy(() => dbProxy, {
  get: () => dbProxy,
  apply: () => dbProxy,
});

const fakeClient = {
  db: dbProxy,
  commands: new Map(),
  user: { id: '0' },
};

const entries: ManifestEntry[] = [];

function instantiate(file: string, dir: string): any {
  const mod = _require(path.join(dir, file));
  const Cls = mod.default ?? mod;
  return new Cls(fakeClient);
}

function relPath(file: string, dir: string): string {
  const abs = path.join(dir, file);
  return path.relative(repoRoot, abs);
}

const commandFiles = preferTsOverJs([...new Bun.Glob('*.{ts,js}').scanSync(commandsDir)]);
for (const file of commandFiles) {
  try {
    const cmd = instantiate(file, commandsDir);
    entries.push({
      kind: 'command',
      name: cmd.name,
      description: cmd.description,
      options: cmd.options ?? [],
      isSubcommandOf: cmd.isSubcommandOf ?? null,
      ephemeral: !!cmd.ephemeral,
      skipDefer: !!cmd.skipDefer,
      isInteractive: cmd.isInteractive !== false,
      file: relPath(file, commandsDir),
    });
  } catch (err) {
    console.error(`[manifest] failed to instantiate ${file}:`, err);
    process.exit(1);
  }
}

const groupFiles = preferTsOverJs([...new Bun.Glob('*.{ts,js}').scanSync(groupsDir)]);
for (const file of groupFiles) {
  try {
    const grp = instantiate(file, groupsDir);
    entries.push({
      kind: 'group',
      name: grp.name,
      description: grp.description,
      isSubcommandOf: null,
      subcommands: grp.commands ?? [],
      file: relPath(file, groupsDir),
    });
  } catch (err) {
    console.error(`[manifest] failed to instantiate group ${file}:`, err);
    process.exit(1);
  }
}

const manifest: Manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  entries,
};

fs.writeFileSync(manifestOut, `${JSON.stringify(manifest, null, 2)}\n`);
const cmdCount = entries.filter((e) => e.kind === 'command').length;
const grpCount = entries.filter((e) => e.kind === 'group').length;
console.log(`[manifest] wrote ${entries.length} entries (${cmdCount} commands, ${grpCount} groups) to ${path.relative(repoRoot, manifestOut)}`);
