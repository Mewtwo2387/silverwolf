# Silverwolf Bot - Getting Started Guide

This guide covers how to install, run, debug, and test the Silverwolf Discord bot using Bun.

## Prerequisites

1.  **Install Bun** (if not already installed):
    ```bash
    # Windows (using PowerShell)
    powershell -c "irm bun.sh/install.ps1 | iex"
    
    # macOS/Linux
    curl -fsSL https://bun.sh/install | bash
    ```

2.  **Verify Installation**:
    ```bash
    bun --version
    ```

---

## Installation

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone <repository-url>
    cd silverwolf
    ```

2.  **Install dependencies**:
    ```bash
    bun install
    ```
    > **Note**: Bun is fully compatible with `package.json` and will install all dependencies from npm.

3.  **Configure environment variables**:
    Create a `.env` file in the project root (or copy from `.env.example` if available):
    ```env
    TOKEN=your_discord_bot_token
    CLIENT_ID=your_discord_client_id
    ```
    > **Note**: Bun automatically reads `.env` files—no `dotenv` package needed!

---

## Running the Bot

### Production
```bash
bun start
# or
bun index.js
```

### Development (with hot reload)
```bash
bun run dev
# or
bun --watch index.js
```
> File changes will automatically restart the bot.

### Using Node.js (fallback)
If you need to use Node.js for any reason:
```bash
npm run start:node   # Production
npm run dev:node     # Development with watch mode
```

---

## Testing

### Run all tests
```bash
bun test
```

### Watch mode (re-runs tests on file changes)
```bash
bun test --watch
```

### Run specific test file
```bash
bun test tests/specific.test.js
```

### Using Jest (fallback)
```bash
npm run test:jest
npm run test:coverage
```

---

## Debugging

### 1. Using Bun's Built-in Debugger
```bash
bun --inspect index.js
```
Then open Chrome and navigate to `chrome://inspect` to connect.

### 2. VS Code Debugging
Add this to your `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Silverwolf",
      "program": "${workspaceFolder}/index.js",
      "cwd": "${workspaceFolder}",
      "stopOnEntry": false,
      "watchMode": false
    }
  ]
}
```
> Install the "Bun for Visual Studio Code" extension for best experience.

### 3. Logging
The bot uses `utils/log.js` for logging. All logs are written to `logs.txt`.

---

## Project Structure

```
silverwolf/
├── index.js              # Entry point
├── classes/              # Core classes (Silverwolf, Bitcoin, etc.)
├── commands/             # Discord slash commands
├── database/             # SQLite database layer (uses bun:sqlite)
│   ├── Database.js       # Main database class
│   ├── models/           # Data models
│   ├── queries/          # Query helpers
│   └── tables/           # Table definitions
├── utils/                # Utility functions
├── tests/                # Test files
├── data/                 # Static data files (JSON)
└── .env                  # Environment variables
```

---

## Common Issues

### "Cannot find module 'bun:sqlite'"
This error means you're running with Node.js instead of Bun. Use:
```bash
bun index.js
```

### Database locked error
The bot now uses WAL mode for better concurrency. If you still encounter issues, ensure only one instance is running.

### Canvas/native module issues
If `canvas` fails to build, install system dependencies:
- **Windows**: Install Visual Studio Build Tools
- **macOS**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
- **Linux**: `sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

---

## Performance Tips

1.  **Startup Time**: Bun starts significantly faster than Node.js (~5-10x improvement).
2.  **Database**: `bun:sqlite` is much faster than `node-sqlite3` (synchronous but optimized).
3.  **HTTP Requests**: Native `fetch` is faster and has no dependencies.

---

## Need Help?
- Check the logs in `logs.txt`
- Run with debug mode: `bun --inspect index.js`
- Ask in the project Discord server
