# Silverwolf Bot

silverwolf is very hot.

![image](https://github.com/Mewtwo2387/silverwolf/blob/master/silverwolf.webp)

> **Full technical reference** (architecture, website, database, security & performance): see [AGENTS.md](AGENTS.md).

## Setup

```bash
git clone https://github.com/Mewtwo2387/silverwolf.git
git pull origin master
bun install
```

Create a `.env` file. See [`.env.example`](.env.example) for the full, current list of keys
(Discord bot token + client ID, OAuth/session secrets for the website, AI provider keys, etc.).
Bun loads `.env` automatically. Allowed servers are configured in the database, not via env.

## Run

For dev (hot reload via `bun --watch`):
```bash
bun run dev
```

For prod:
```bash
bun run start
```


## Lint

To list all issues:
```bash
bun run lint
```

To fix all fixable issues:
```bash
bun run lint:fix
```
This only fixes stuff like indentations and line breaks, so good luck with the rest.

To list issues by rule:
```bash
./eslint-by-rule.sh <rule-name> [directory-or-file]
```

If you don't have <s>jiaoqiu</s> `jq` installed, install it with:

```bash
sudo apt-get update
sudo apt-get install jq
```

If you get a `required file not found` error on Linux, try running:

```bash
dos2unix eslint-by-rule.sh
```
Yea this repo is CRLF, uh.

## Deploy

Github Actions should automatically deploy to the VM when you push to `master`.
