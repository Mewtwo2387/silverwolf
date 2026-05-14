# Rust Port Completion Plan: Silverwolf Bot

## Objective
To complete the hybrid Rust rewrite of the Silverwolf Discord bot, achieving 100% feature parity with the legacy TypeScript (Bun) implementation. The remaining work will prioritize the completion of all Discord commands and their underlying database logic before addressing background utilities and the web server.

## Background & Motivation
The initial phase of the Rust port successfully migrated the core architecture, database schema, and roughly 40% of the bot's commands, while establishing a hybrid TS worker for canvas generation. However, over 75 commands, advanced database queries, robust utility integrations (MCP), and the full web dashboard are still missing. This plan outlines the phased approach to bridge these gaps.

## Scope & Impact
This plan covers the migration of all remaining `.ts` files (excluding the designated canvas worker) to `.rs`. 
*   **Impacted areas:** `src/commands/`, `src/database/`, `src/utils/`, `src/scheduler.rs`, and `src/web.rs`.
*   **Risk:** Maintaining state consistency and preventing feature regression during the transition.

## Phased Implementation Plan

### Phase 1: Complete Discord Commands & Database (High Priority)
This phase focuses on porting the remaining ~75 slash commands and their associated database interactions to ensure full interactivity for end-users and administrators.

1.  **Administrative & Developer Tools**
    *   Port `dbdump`, `logdump`, `dev_add`, `dev_set`, and `dev_forceautomation`.
    *   Implement the complex DB export logic required for the dump commands in `src/database/`.
2.  **Server Management**
    *   Port `server_register`, `server_unregister`, and `setserverrole`.
3.  **Games & Fun Interactions**
    *   Port `gamebang`, `riskNReward`, `trade`, `sacrifice`.
    *   Port miscellaneous interactive commands like `guide`, `hello`, `eat`, `sing`, `lore`, `grabEmoji`, and `snipe`.
4.  **Summarization Tools**
    *   Port `summary_time` and `summary_count`.

### Phase 2: Schedulers & Advanced Utilities
1.  **Background Schedulers**
    *   Port `babyScheduler` to handle automated baby-related events.
    *   Review and port any missing event handlers (e.g., holiday events from `classes/handlers/`).
2.  **MCP (Model Context Protocol) Enhancement**
    *   Upgrade the basic HTTP client in `src/mcp.rs`.
    *   Implement advanced logic from `utils/mcp.ts`: Gemini-specific schema conversions, name/text sanitization (removing "exa" branding), and exponential backoff/reconnection logic.

### Phase 3: Web Server, API & Auth
1.  **Authentication & Sessions**
    *   Implement Discord OAuth flow in Axum.
    *   Set up secure session management (`site_src/middleware/session.ts` equivalent).
2.  **API Routes**
    *   Rebuild the dynamic API routes (`site_src/routes/games-api.ts`) to serve data to the frontend.
3.  **Dynamic Pages**
    *   Implement the page rendering logic for Birthdays, Leaderboards, and Games, or serve a modernized static frontend that consumes the new Axum API.

## Verification & Testing
*   **Command Parity:** Execute each newly ported command and compare the output against the legacy Bun bot.
*   **Database Integrity:** Verify that new queries correctly mutate the shared SQLite database without corruption.
*   **API Testing:** Ensure the Axum web routes respond with the correct JSON structures and respect rate limits/auth.

## Migration & Rollback Strategies
*   The hybrid approach ensures that we can roll back to the Bun container entirely if a critical flaw is found in the Rust core. 
*   The database structure remains identical, allowing seamless switching between the two implementations during testing.
