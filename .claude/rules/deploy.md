---
paths:
  - "Dockerfile"
  - "docker-compose.yaml"
  - ".github/workflows/**"
  - "scripts/**"
---

# CI/CD & Docker

Mechanism only — the specifics (host, SSH user, image name) live in the workflow files and are
deliberately not duplicated here.

- `.github/workflows/deploy.yml`: push to `master` → Buildx builds & pushes the Docker image → SSH
  to the prod VM and `docker compose pull && docker compose up -d`.
- `.github/workflows/claude_code*.yml`: `@claude` PR assistant, restricted to authorized actors.
- **Docker** (`Dockerfile`): multi-stage — `oven/bun:1` builder with cairo/pango/jpeg/gif/rsvg dev
  libs to compile `canvas`, then `oven/bun:1-slim` runtime as non-root user `bun`,
  `CMD ["bun","index.ts"]`. The builder also runs `build:css` + `build:js` (Tailwind, `app.js` and
  the Three.js game bundles) and overlays those artifacts into the runtime — they're
  `.dockerignore`d from the source copy, so **a new client-JS entrypoint must be added to both
  `build:js` and the Dockerfile build+overlay steps** or it silently won't ship.
- `docker-compose.yaml` mounts `./persistence` (SQLite persistence), publishes
  `127.0.0.1:8080:6769`, `mem_limit: 1g`.

**`persistence/` is the Docker volume — all runtime data (the SQLite DB, logs) lives there.** Don't
write runtime state anywhere else; it won't survive a redeploy.
