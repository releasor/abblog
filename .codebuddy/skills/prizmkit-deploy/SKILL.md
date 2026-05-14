---
name: prizmkit-deploy
description: "Universal deployment gateway for any PrizmKit project. Discovers project type and target (SSH server, Vercel, Docker, etc.), then routes: full automation for SSH Linux with PM2 + Nginx + blue/green switching, guided setup for cloud platforms, or safe documentation fallback for unsupported targets. Also operates existing deployments: status, logs, restart, rollback, health checks, history. Trigger on: 'deploy', 'deploy my app', 'help me deploy', 'ship it', 'take this live', 'deploy to Vercel', 'deploy to my server', 'how do I deploy this', any deployment or hosting question."
---

# PrizmKit Deploy — Universal Deployment Gateway

`/prizmkit-deploy` is the single entry point for all deployment work. When a user asks to deploy anything — any project type, any target — this skill handles it.

Three possible outcomes depending on what's supported:
1. **Full automation** (SSH Linux server): configure, bootstrap, deploy, verify, operate — complete AI takeover.
2. **Guided setup** (cloud platforms like Vercel, Netlify, Docker): generate config, walk through CLI steps, verify.
3. **Documented fallback** (unsupported targets): detect what's possible, produce deploy.md, record the adapter gap.

When invited, behave as a deployment engineer. Ask until you understand what is being deployed, where it runs, how it is built, how it starts, what secrets it needs, how traffic reaches it, and how health is checked.

## Deployment Discovery

Before doing anything else, discover what you're deploying and where. This phase routes the request to the right adapter or fallback. It runs regardless of mode (interactive or headless), but interactive mode may ask questions; headless mode reads from existing config and exits with `NEEDS_INPUT` if critical details are missing.

### Step 1: Project Detection

Scan the project root for build/package files and classify:

| File found | Language/Framework | Build command | Start command |
|------------|-------------------|---------------|---------------|
| `package.json` with `next` dep | Next.js | `next build` | `next start -p <port>` |
| `package.json` with `vite` dep | Vite (React/Vue) | `vite build` | `vite preview` |
| `package.json` (generic) | Node.js | `npm run build` | `npm run start` |
| `go.mod` | Go | `go build` | `./<binary>` |
| `Cargo.toml` | Rust | `cargo build --release` | `./target/release/<binary>` |
| `requirements.txt` / `pyproject.toml` | Python | — | `python -m uvicorn` or similar |
| `Dockerfile` | Containerized | `docker build` | `docker run` |
| `docker-compose.yml` | Docker Compose | `docker compose build` | `docker compose up` |
| `Makefile` only | C/C++/generic | `make` | `make run` or binary |

Also scan for:
- **Environment variables**: grep for `process.env.`, `os.environ`, `os.Getenv`, `env::var` — catalog every reference
- **Port usage**: grep for port numbers, `listen()`, `PORT` env var
- **Database dependencies**: check package.json/requirements.txt/go.mod for database drivers

### Step 2: Deployment Target Detection

Determine WHERE the user wants to deploy. Check in order:

**A. User-specified target** (highest priority):
- "deploy to Vercel" / "deploy to my server" / "deploy with Docker" → use what the user says.

**B. Detect from project files** (if user hasn't specified):
- `vercel.json` → Vercel
- `netlify.toml` → Netlify
- `fly.toml` → Fly.io
- `Dockerfile` or `docker-compose.yml` → Docker
- `.github/workflows/deploy.yml` → check what it targets
- `app.yaml` → GCP App Engine
- `serverless.yml` → Serverless Framework

**C. Ask the user** (interactive only):
- "Where should this project be deployed?"
- Options to suggest based on detected files + common choices:
  - "My own Linux server (SSH access) — full AI automation"
  - "Vercel / Netlify — guided CLI setup"
  - "Docker — guided container deployment"
  - "Other — generate deployment documentation"

If headless mode and no target can be determined, exit with `NEEDS_INPUT` listing the missing target information.

**D. Check for existing deployment**:
- Does `.prizmkit/deploy/deploy.config.json` already exist? If yes, read the configured target.
- Does the user mention a server IP or hostname? Check if it's already reachable.

### Step 3: Route to Adapter

Based on detected target, route the rest of the session:

```
SSH Linux server  → §SSH Deployment Path (full automation)
                     bootstrap, configure, deploy, operate
                     First-version: PM2 + Nginx + blue/green

Vercel / Netlify  → §Cloud Platform Deployment Path (guided)
                     detect CLI tools, walk through deploy commands,
                     generate deploy.md with platform-specific steps

Docker            → §Docker Deployment Path (guided)
                     detect Dockerfile/Compose, build image,
                     container lifecycle (run, stop, logs, restart)

Unsupported       → §Unsupported Deployment Fallback
                     generate deploy.md with detected info,
                     record missing adapter gap,
                     provide manual deployment checklist
```

The SSH path is fully documented in the sections below. Cloud and Docker paths follow the same discovery and documentation patterns but use platform CLIs instead of SSH + PM2.

**Compatibility check before routing to SSH**: The SSH adapter (PM2 + Nginx + blue/green) requires a Node.js project — verify `package.json` exists. Non-Node.js projects (Go, Rust, Python) targeting a Linux server route to Unsupported Fallback with a note: "Adapter gap: PM2 adapter requires Node.js."

### Step 4: Unsupported Deployment Fallback

When the deployment target or project type isn't covered by any adapter, don't fail silently. Instead:

1. **Detect what you can**: project language, framework, build/start commands, env vars, port usage, database dependencies.
2. **Generate `.prizmkit/deploy/deploy.md`**: human-readable deployment guide with:
   - Prerequisites (tools, accounts, versions)
   - Environment variables table (detected from code scan)
   - Build and start instructions
   - Health check suggestions
   - Platform-specific tips if the target is partially recognized
3. **Record the adapter gap**: write a note in deploy.md and deploy-history identifying what's missing (e.g., "Adapter needed: Python/FastAPI on systemd", "Adapter needed: Go binary deployment").
4. **Provide a manual checklist**: concrete steps the user can follow to deploy manually.
5. **Offer to generate CI/CD config**: if `.github/workflows/` exists or the user wants one, generate a basic deploy workflow.

This ensures every deployment request produces useful output, even when full automation isn't available yet.

## Mode Detection

Detect invocation mode from the user's initial message. The mode determines what you're allowed to do:

**Interactive mode** (user typed `/prizmkit-deploy` or asked directly):
- May ask as many questions as needed to fill in missing deployment details.
- May request approvals for privileged, destructive, or traffic-impacting actions.
- May deploy to any environment (dev/test/production).
- Production requires explicit user confirmation before execution.

**Headless mode** (invoked via `--headless` flag, pipeline, or script):
- Must never wait for user input or prompt — unattended shells timing out on a prompt blocks pipelines silently.
- May ONLY target `dev` or `test` environments.
- If `--env production` in headless mode: exit immediately with `ENVIRONMENT_DENIED — production deployment requires interactive mode`.
- If required info is missing, exit with `NEEDS_INPUT` and write pending questions to `.prizmkit/deploy/pending-input.json`.
- May only perform actions already authorized by `deploy.config.json`.

## Command Routing

When the user invokes `/prizmkit-deploy`, determine intent from the first word after the command:

```
/prizmkit-deploy                  → deploy (if config exists) or configure (if not)
/prizmkit-deploy configure        → first-run or repair configuration wizard
/prizmkit-deploy deploy           → full deployment pipeline
/prizmkit-deploy status           → show PM2 process status for all apps
/prizmkit-deploy logs --app <id>  → tail PM2 logs for the given app
/prizmkit-deploy restart --app <id> → PM2 restart for the given app
/prizmkit-deploy rollback --app <id> [--to <releaseId>] → rollback to previous or specified release
/prizmkit-deploy health --app <id> → run configured health checks
/prizmkit-deploy history          → list recent deployment events from deploy-history/
/prizmkit-deploy validate         → run validation checks without deploying
```

### No-arg behavior

- If `.prizmkit/deploy/deploy.config.json` does not exist → start first-run configuration wizard.
- If config exists and validates → show deployment summary (active release, app status, last deploy time) and ask which environment, then proceed to deploy.
- If config exists but required fields are missing or validation is stale → enter repair flow.

## File Structure

All artifacts live under `.prizmkit/deploy/`:

```
.prizmkit/deploy/
  deploy.md                          # human-readable documentation
  deploy.config.json                 # machine-readable config & validation state
  pending-input.json                 # pending questions for headless mode resume
  deploy-history/
    <deployment-id>.json             # one per deploy/rollback/event
  deploy-scripts/                    # future — currently unused, place for PrizmKit-managed deploy scripts and templates
  secrets.enc.json                   # optional, encrypted local secrets
  secrets.local.json                 # optional, plaintext secrets (must be gitignored)
```

The full `deploy.config.json` schema is documented in `references/deploy-config-schema.md`. Read it when writing or validating config.

## SSH Deployment Path (Full Automation)

The following sections — Server Model through Multi-App Coordination — define the SSH deployment adapter. This is the only fully-automated path in the first version. Route here when Discovery determines the target is a Linux server with SSH access.

### SSH: Server Model

Servers are generic SSH targets. A server is valid if it:
- Can be reached over SSH.
- Provides a Linux shell.
- Can install or has Node.js, npm, PM2, Nginx, Git.
- Can access the configured Git repository.

Server-side directory layout:
```
/var/www/<project>/
  releases/
    <release-id>/
  shared/
    .env.production          # mode 600, owner: runtime user
    deploy-metadata.json     # active color, last release, timestamp
  current -> releases/<release-id>
  deploy-logs/
```

SSH roles: `bootstrapUser` (usually root, for initial setup) and `runtimeUser` (default `deploy`, for app processes). App processes never run as root.

### SSH: First-Run Configuration Wizard

When `.prizmkit/deploy/deploy.config.json` does not exist, enter configuration wizard. The flow is: **collect → validate → confirm → persist**.

#### Step 1: SSH Server Discovery

Ask for and validate:
- **Server host and port** (e.g., `43.161.221.171:22`)
- **Bootstrap user** (usually `root`) — used for initial package install and user creation
- **Runtime user** (recommend `deploy`) — app runs as this user, never root
- **Auth method** — SSH key path or agent

Validate immediately: `ssh <bootstrapUser>@<host> 'echo OK'`. If that fails, nothing else matters — stop and fix connectivity first.

#### Step 2: Repository Access

Ask for and validate:
- **Git URL** (e.g., `git@github.com:owner/repo.git`)
- **Branch** (e.g., `master`)
- **Auth strategy** — prefer read-only Deploy Key

If using Deploy Key:
1. Generate ed25519 key on server: `sudo -u <runtimeUser> ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""`
2. Show the public key to the user with explicit instruction: "Add this to GitHub Deploy Keys (read-only)"
3. Wait for user confirmation, then verify: attempt a git clone as runtime user

#### Step 3: Application Configuration

For each app, collect:
- **id** — short name (e.g., `web`)
- **path** — relative path within repo
- **packageManager** — npm / yarn / pnpm
- **installCommand** — `npm ci` / `yarn install` etc.
- **buildCommand** — `npm run build` etc.
- **startCommand** — `npm run start` etc.
- **ports** — blue/green port pair (default 3101/3102)
- **healthChecks** — list of `{ name, url, expectedStatus[] }`

#### Step 4: Environment Variables

- Scan source code for `process.env.<VAR>` references.
- Ask user for each required value.
- Identify which are secrets (API keys, tokens) vs. non-secrets (URLs, anon keys).
- Ask about secret storage strategy (see Secrets Management below).

#### Step 5: Persist Configuration

Write `deploy.config.json` with all collected values and `validated: {}` stubs for each section. Write `deploy.md` as human-readable documentation.

### SSH: Bootstrap Flow

Before first deployment, bootstrap the server. Present a plan to the user showing every privileged action before executing anything.

**Always-run preflight:**
```
locale-gen en_US.UTF-8           # fix locale warnings on bare Ubuntu
apt-get update -qq               # refresh package list
```

**Check-and-install (idempotent):**
- **Node.js**: check `node --version`. If missing or too old, install via NodeSource. Use v22 LTS if v25 not available — that's fine for most projects.
- **npm**: verify separately from node (`which npm`). On minimal installs, npm may be a separate package.
- **PM2**: `npm install -g pm2` if missing.
- **Nginx**: `apt-get install -y nginx` if missing.
- **Git**: `apt-get install -y git` if missing.

**Detect port conflicts before starting Nginx:**
```
ss -tlnp | grep :80 || true
```
If port 80/443 is occupied, report what's using it and ask how to resolve.

**User and directory setup:**
```
useradd -m -s /bin/bash <runtimeUser>   # if not exists
mkdir -p /var/www/<project>/{releases,shared,deploy-logs}
chown -R <runtimeUser>:<runtimeUser> /var/www/<project>
```

**PM2 startup:**
```
env PATH=$PATH:/usr/bin pm2 startup systemd -u <runtimeUser> --hp /home/<runtimeUser>
```

**Deploy key (if strategy is deploy-key):**
```
sudo -u <runtimeUser> ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
sudo -u <runtimeUser> ssh-keyscan -H github.com >> ~/.ssh/known_hosts
```

After each bootstrap step, record the result. Bootstrap operations must be idempotent. Back up any existing config files before modifying them.

### SSH: Deployment Execution Flow

Pipeline runs in strict order. Each group must complete before the next begins. If any step before traffic switch fails, STOP — do not touch the live version.

**Group 1 — Pre-flight & Prepare:**
- Verify SSH, runtime user, tools, deploy key, port availability.
- Generate `releaseId`: `YYYYMMDD-<short-commit-sha>`. Create `releases/<releaseId>`.
- Determine target color: read `activeColor` from `shared/deploy-metadata.json` and use the opposite. If first deploy (no metadata, no `current` symlink), default to blue (port 3101).

**Group 2 — Fetch & Build:**
- `git clone <repoUrl> --branch <branch> releases/<releaseId>` as runtime user.
- `cd releases/<releaseId> && <installCommand>` as runtime user.
- Copy `.env.production` from `shared/` into release dir BEFORE build — `NEXT_PUBLIC_*` vars are baked at build time.
- Run `<buildCommand>`. If build fails: STOP.

**Group 3 — Stage & Health Check:**
- Start new version on the inactive port via PM2: `pm2 start npm --name <project>-<app>-<color> -- run start -- -p <inactivePort>`.
- PM2 process naming: `<project>-<app>-<color>` (e.g., `prizm-ideas-web-green`).
- Wait 3-5 seconds, run health checks against new port. If any fails: STOP. Do NOT switch traffic. Record failure.

**Group 4 — Switch & Verify:**
- Update Nginx upstream to new port. Run `nginx -t` — abort on failure.
- `systemctl reload nginx`. Update `current` symlink to new release.
- Write `shared/deploy-metadata.json` with new `activeColor`, `activePort`, `lastReleaseId`.
- Run health checks against public endpoint. If any fails: rollback immediately (switch Nginx back, restart old PM2).

**Group 5 — Cleanup & Record:**
- Stop old PM2 process. Remove oldest releases beyond `releaseRetention` count. `pm2 save`.
- Write deploy-history JSON to `.prizmkit/deploy/deploy-history/<releaseId>.json` (schema: `references/deploy-history-schema.md`).
- Update `deploy.config.json` with new validation status.

### SSH: Blue/Green PM2 + Nginx Strategy

The active color (blue or green) maps to a port:
- Blue: port 3101 (default)
- Green: port 3102 (default)

Active color is persisted in `/var/www/<project>/shared/deploy-metadata.json`. If metadata is missing, rediscover from Nginx `proxy_pass` directive or from running PM2 processes.

PM2 process naming: `<project>-<app>-<color>` (deterministic, never reuse old release IDs in names).

Nginx config must include the PrizmKit managed marker:
```
# PrizmKit Managed: <project> — DO NOT EDIT MANUALLY
```

Before modifying any Nginx config that lacks this marker, ask for user confirmation.

Always `nginx -t` before `systemctl reload nginx`. If syntax check fails, abort.

### SSH: Rollback

Two rollback triggers:
1. **Automatic**: health check failure after traffic switch → roll back immediately.
2. **Manual**: `/prizmkit-deploy rollback --app <id> [--to <releaseId>]`

Rollback steps:
1. Identify target release: `--to <releaseId>` or discover previous release from deploy history.
2. Verify target release directory exists and has a valid build.
3. Determine which port the target release used (from deploy history or release metadata).
4. Start the target PM2 process on its port (if not already running).
5. Update Nginx upstream to target port, run `nginx -t`, reload.
6. Run health checks against the restored version.
7. Write a rollback event to deploy history.
8. Do NOT delete the failed release or its logs — preserve for debugging.

If no previous release exists (first deployment), rollback is not possible — state this clearly.

### SSH: Operations Commands

#### status
SSH to server and run `pm2 list` as runtime user. Also show:
- Active release (from `current` symlink target)
- Active color/port (from `deploy-metadata.json`)
- Last deploy timestamp

#### logs --app <id>
SSH to server and run `pm2 logs <process-name> --lines 100` as runtime user.

#### restart --app <id>
1. Identify the active PM2 process for the app.
2. Run `pm2 restart <process-name>` as runtime user.
3. Wait for process to come online.
4. Run health checks to verify recovery.

#### health --app <id>
Run all configured health checks for the app against the public endpoint. Report pass/fail for each.

#### history
Read `.prizmkit/deploy/deploy-history/` directory, list events chronologically. Show event type, release ID, commit SHA, timestamp, status.

## Environment Policy

| Mode | dev | test | production |
|------|-----|------|------------|
| Interactive | Allowed | Allowed | Allowed (requires confirmation) |
| Headless | Allowed | Allowed | **REJECTED** — exits with ENVIRONMENT_DENIED |

This is non-negotiable. Even if config allows it, headless must reject production.

## Secrets Management

Four storage modes, configured during first-run wizard:

- **ask-every-time**: Prompt for secrets on each deploy. Safest, most manual.
- **encrypted-local**: Store in `.prizmkit/deploy/secrets.enc.json`. Encrypt with user passphrase using Argon2id/scrypt KDF. Decryption material never stored alongside ciphertext.
- **plaintext-local**: Store in `.prizmkit/deploy/secrets.local.json`. Must be gitignored. Before each deploy, verify the file is not tracked by git. If tracked, stop and ask to resolve.
- **user-managed-on-server-only**: User handles secrets manually. Skill verifies server-side `.env.production` has all required vars before deploying.

Server runtime secrets live in `/var/www/<project>/shared/.env.production` with mode `600`, owned by runtime user.

Deploy history records secret presence metadata only (e.g., `{"SUPABASE_SERVICE_ROLE_KEY": {"present": true}}`). Never record raw secret values or unsalted hashes.

### SSH: Existing Deployment Takeover

When deploying to a server that already has deployment assets:

1. Detect: existing `/var/www/<project>` directory, existing PM2 processes with similar names, Nginx config referencing the same domain/IP, port conflicts.
2. Report findings to the user and ask for takeover decision:
   - **Take over and backup**: Back up existing config, then proceed.
   - **Coexist**: Use different directory/ports/process names.
   - **Manual resolve**: Stop and let the user handle it.
3. Record takeover decision and validation results in config and history.

### SSH: Nginx Management

- First Nginx config creation or update of a non-PrizmKit block requires user confirmation.
- Subsequent updates to PrizmKit-managed blocks (`# PrizmKit Managed:` marker) may proceed automatically.
- Managed marker format: `# PrizmKit Managed: <project> — DO NOT EDIT MANUALLY`
- Always run `nginx -t` before reload.
- If a server block exists without the managed marker, ask before modifying.

See `references/nginx-blue-green.md` for the full Nginx config template, traffic switch procedure, and active port rediscovery technique.

### SSH: Bootstrap Safety Rules

Before executing privileged bootstrap work, generate an action plan listing:
- Packages to install/upgrade
- Users/groups to create/modify
- SSH keys to create
- Nginx config to create/modify
- Directories and permissions to change
- Services that may be restarted

Execution rules:
- User gives one explicit approval for the entire bootstrap plan.
- If the plan changes during execution, pause and ask again.
- Bootstrap operations must be idempotent.
- Existing config files must be backed up before modification.
- All privileged actions and results recorded in deploy history.
- Failed bootstrap stops before deployment, provides recovery instructions.

### SSH: Multi-App Coordination

An all-app deploy creates one release group. Rules:
- Pre-traffic phases (fetch, install, build, stage) must complete for ALL selected apps before ANY app switches traffic.
- If any app fails before traffic switch, NO app switches traffic. Staged processes are stopped, live system unchanged.
- If any app fails after traffic switch, default: group rollback (all apps in the release group roll back).
- Single-app deploys (`--app <id>`) do not affect unrelated apps.

## Validation

Validation is mandatory before production deploy. Check:
- SSH connectivity and user permissions
- Required tools present (node, npm, git, pm2, nginx)
- Repository reachability and branch existence
- Ports availability
- Required env vars present
- Nginx config syntax
- Health check routes accessible

Persist validation in `deploy.config.json` under each section's `validated` field.

## Adapter Paths

After Discovery routes to a deployment target, read the corresponding reference file for execution details:

| Target | Reference | Mode |
|--------|-----------|------|
| SSH Linux server | SSH sections below (Server Model through Multi-App) | Full automation |
| Vercel, Netlify, Fly.io | `references/cloud-platform-deploy.md` | Guided CLI |
| Docker / Docker Compose | `references/docker-deploy.md` | Guided build + run |
| Unrecognized target | Deployment Discovery Step 4 | Documented fallback |

The SSH path is documented inline below because it is the fully-automated adapter and the model needs its instructions in every SSH deployment session. Cloud and Docker paths are in references because they're loaded only when Discovery routes to them.

## Deploy History Record Schema

Each deployment, rollback, or significant event writes a record to `.prizmkit/deploy/deploy-history/<id>.json`. The full schema is in `references/deploy-history-schema.md` — read it when writing history records.

Never record raw secret values in history — presence metadata only.

## Implementation Notes from Live Validation

These findings from PrizmIdeas first deployment should guide your behavior:

1. **Detect port conflicts before installing Nginx.** Check what's on port 80/443 and ask before stopping anything.
2. **Verify npm separately from node.** Minimal Node installs may not bundle npm.
3. **Fix locale on bare Ubuntu.** Run `locale-gen en_US.UTF-8` early to avoid perl warnings in apt.
4. **Deploy key workflow is inherently interactive.** Generate key → wait for user to add to GitHub → verify. Headless mode cannot complete this.
5. **`pm2 startup` needs explicit PATH.** Always use `env PATH=$PATH:/usr/bin pm2 startup ...`.
6. **Persist deploy metadata on server.** Write `activeColor`, `activePort`, `lastReleaseId`, `lastDeployTimestamp` to `shared/deploy-metadata.json`.
7. **Detect first deployment.** If no `current` symlink and no PM2 process for the app, skip rollback safety checks and use blue (3101) as initial color.
8. **Build-time env vars.** Copy `.env.production` before `npm run build`, not after. `NEXT_PUBLIC_*` vars are baked at build time.
9. **Node.js version flexibility.** Default to v22 LTS if v25 is unavailable. Most frameworks tolerate a minor version diff.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

