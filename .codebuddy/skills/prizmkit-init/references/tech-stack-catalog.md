# Tech Stack Detection — Field Catalog

Adaptive field list — only include fields that apply to the project being scanned.

- **Language & Runtime**: e.g. TypeScript + Node.js 20, Python 3.11, Go 1.22
- **Frontend framework** (if applicable): React, Vue.js, Angular, Next.js, Svelte, etc.
- **Frontend styling** (if applicable): Tailwind CSS, SCSS, Styled Components, Material UI, etc.
- **Backend framework** (if applicable): Express.js, FastAPI, Django, NestJS, Gin, etc.
- **Database** (if applicable): PostgreSQL, MySQL, MongoDB, Redis, SQLite — detected from deps or `docker-compose.yml`
- **ORM** (if applicable): Prisma, Drizzle, TypeORM, SQLAlchemy, Mongoose, etc.
- **Bundler** (if applicable): Vite, Webpack, esbuild, Rollup, Turborepo
- **Testing**: Vitest, Jest, pytest, Go test, etc.
- **Project type** (inferred): `frontend` | `backend` | `fullstack` | `library` | `cli` | `monorepo`

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

