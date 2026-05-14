# deploy.config.json Schema

This file is the machine-readable deployment configuration. Always read it before executing any deploy operation.

## Top-Level Structure

```json
{
  "version": 1,
  "project": "project-name",
  "deploymentMode": "ssh",
  "defaults": { ... },
  "environments": { ... },
  "servers": [ ... ],
  "repository": { ... },
  "apps": [ ... ],
  "nginx": { ... },
  "env": { ... }
}
```

## defaults

```json
{
  "releaseRetention": 5,
  "credentialMode": "ai-assisted|user-managed",
  "secretStorage": "ask-every-time|encrypted-local|plaintext-local|user-managed-on-server-only",
  "rollbackOnFailure": true,
  "headlessDefaultEnvironment": "test"
}
```

## environments

Keyed by environment name. Each entry:
```json
{
  "dev": {
    "server": "server-id",
    "allowHeadless": true,
    "confirmBeforeDeploy": false
  }
}
```

## servers

Array of server objects:
```json
{
  "id": "prod-1",
  "host": "IP or hostname",
  "port": 22,
  "bootstrapUser": "root",
  "runtimeUser": "deploy",
  "roles": ["web"],
  "validated": {
    "ssh": true|false,
    "bootstrap": true|false,
    "runtimeUser": true|false,
    "tools": {
      "node": "version",
      "npm": "version",
      "pm2": "version",
      "nginx": "version",
      "git": "version"
    },
    "directories": true|false,
    "deployKey": true|false
  }
}
```

## repository

```json
{
  "url": "git@github.com:owner/repo.git",
  "branch": "master",
  "auth": "deploy-key|ssh-agent|token",
  "validated": {
    "clone": true|false
  }
}
```

## apps

Array of app objects:
```json
{
  "id": "web",
  "path": ".",
  "runtime": "pm2",
  "packageManager": "npm",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "startCommand": "npm run start",
  "ports": {
    "blue": 3101,
    "green": 3102
  },
  "healthChecks": [
    { "name": "home", "url": "/", "expectedStatus": [200] },
    { "name": "login", "url": "/login", "expectedStatus": [200, 302] }
  ],
  "activeColor": "blue",
  "pm2Process": "prizm-ideas-blue"
}
```

## nginx

```json
{
  "enabled": true,
  "managed": true,
  "firstChangeRequiresConfirmation": true,
  "domain": null,
  "ipFallback": true,
  "currentUpstream": "127.0.0.1:3101"
}
```

## env

```json
{
  "strategy": "ai-assisted|user-managed",
  "required": ["VAR_NAME"],
  "secrets": ["SECRET_NAME"],
  "validated": {
    "allRequiredPresent": true|false
  }
}
```

## Validation Rules

- `version` must be present (always 1 for first version)
- `servers` must have at least one entry with host and bootstrapUser
- `repository.url` must be present
- `apps` must have at least one entry
- `apps[*].ports.blue` and `apps[*].ports.green` must differ
- `apps[*].healthChecks` should have at least one entry
- Environment referenced in `environments` must have a matching server in `servers`

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

