# Nginx Blue/Green Configuration Template

## Server Block Template

```nginx
# PrizmKit Managed: <project> — DO NOT EDIT MANUALLY
upstream <project>_backend {
    server 127.0.0.1:<activePort>;
}

server {
    listen 80 default_server;
    server_name _;

    # PrizmKit managed marker: <project>
    location / {
        proxy_pass http://<project>_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Traffic Switch Procedure

When switching from one color to another:

1. Update the `upstream` block: change `server 127.0.0.1:<oldPort>` to `server 127.0.0.1:<newPort>`
2. Run `nginx -t` to validate syntax
3. If syntax check passes: `systemctl reload nginx`
4. If syntax check fails: DO NOT reload. Abort the switch. Report the error.

## Managed Marker

All PrizmKit-generated Nginx config must contain:
```
# PrizmKit Managed: <project> — DO NOT EDIT MANUALLY
```

Before modifying any server block that lacks this marker, ask for user confirmation.

## First-Time Setup

- Disable default nginx site: `rm -f /etc/nginx/sites-enabled/default`
- Create new config: `/etc/nginx/sites-available/<project>`
- Symlink: `ln -sf /etc/nginx/sites-available/<project> /etc/nginx/sites-enabled/<project>`
- Test: `nginx -t`
- Reload: `systemctl reload nginx`

## Rediscovery of Active Port

If `deploy-metadata.json` is missing, rediscover the active upstream port from Nginx config:
```
grep "server 127.0.0.1:" /etc/nginx/sites-available/<project>
```
Then match the port against configured blue/green ports to determine active color.

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

