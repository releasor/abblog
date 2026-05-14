# Docker Deployment Path

Guided deployment when a `Dockerfile` or `docker-compose.yml` is detected, or the user requests Docker deployment.

## Detect and Configure

1. Read `Dockerfile` — extract base image, exposed ports, build steps.
2. Read `docker-compose.yml` if present — extract services, volumes, environment, ports.
3. Identify image name: from compose project name or repo directory name.
4. Identify port mappings: from `EXPOSE`, `ports:` in compose, or ask the user.

## Build and Deploy

1. Build: `docker build -t <project>:<releaseId> .` or `docker compose build`.
2. Check for running containers with the same name: `docker ps -a --filter name=<project>`.
3. If a previous container exists:
   - For blue/green on a server with Nginx: start new container on different port, health check, switch upstream.
   - For single-container setup: stop old, start new — warn about brief downtime.
4. Start: `docker run -d --name <project>-<releaseId> -p <port>:<port> <project>:<releaseId>` or `docker compose up -d`.
5. Health check the new container.
6. Write deploy-history event.

## Operations

| Command | Docker CLI |
|---------|-----------|
| status | `docker ps --filter name=<project>` |
| logs | `docker logs <container-name> --tail 100` |
| restart | `docker restart <container-name>` |
| rollback | `docker stop <new-container> && docker start <old-container>` |
| cleanup | `docker image prune -a --filter "label=project=<project>"` |

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

