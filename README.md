# Silverwolf Bot

silverwolf is very hot.

![image](https://github.com/Mewtwo2387/silverwolf/blob/master/silverwolf.webp)

## Setup

```bash
git clone https://github.com/Mewtwo2387/silverwolf.git
git pull origin master
npm install
```

Create a `.env` file and add the following:

```
CLIENT_ID=your-discord-bot-client-id
TOKEN=your-discord-bot-token
GEMINI_TOKEN=your-gemini-token
ALLOWED_USERS=discord-user-ids-of-devs,separated,by,commas
GUILD_ID=discord-server-ids,separated,by,commas
```

## Run

For dev (with nodemon):
```bash
npm run dev
```

For prod:
```bash
npm run start
```


## Lint

To list all issues:
```bash
npm run lint
```

To fix all fixable issues:
```bash
npm run lint:fix
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
