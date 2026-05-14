#!/usr/bin/env python3
"""Shared utility functions for dev-pipeline scripts.

Centralizes common operations (JSON I/O, error reporting, display helpers)
to avoid duplication across pipeline scripts.
"""

import json
import logging
import os
import re
import sys


def load_json_file(path):
    """Load and return parsed JSON from a file.

    Returns (data, error_string). On success error_string is None.
    """
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        return None, "File not found: {}".format(abs_path)
    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return None, "Invalid JSON: {}".format(str(e))
    except IOError as e:
        return None, "Cannot read file: {}".format(str(e))
    return data, None


def write_json_file(path, data):
    """Write data as JSON to a file. Creates parent directories if needed.

    Returns an error string on failure, None on success.
    """
    abs_path = os.path.abspath(path)
    parent = os.path.dirname(abs_path)
    if parent and not os.path.isdir(parent):
        try:
            os.makedirs(parent, exist_ok=True)
        except OSError as e:
            return "Cannot create directory: {}".format(str(e))
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
    except IOError as e:
        return "Cannot write file: {}".format(str(e))
    return None


def setup_logging(name="prizmkit.dev_pipeline", level=None):
    """Configure and return a standard logger for pipeline scripts.

    Logs are written to stderr to avoid interfering with stdout JSON outputs.
    """
    resolved_level = (level or os.environ.get("PRIZMKIT_LOG_LEVEL", "INFO")).upper()
    numeric_level = getattr(logging, resolved_level, logging.INFO)

    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(
            level=numeric_level,
            stream=sys.stderr,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )

    logger = logging.getLogger(name)
    logger.setLevel(numeric_level)
    return logger


def error_out(message, code=1):
    """Print an error JSON and exit with the given code."""
    output = {"error": message}
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(code)


def pad_right(text, width):
    """Pad text with spaces to fill width, accounting for ANSI escape codes."""
    i = 0
    visible_len = 0
    while i < len(text):
        if text[i] == "\033":
            while i < len(text) and text[i] != "m":
                i += 1
            i += 1
        else:
            visible_len += 1
            i += 1
    padding = width - visible_len
    if padding > 0:
        return text + " " * padding
    return text


def _build_progress_bar(percent, width=20):
    """Build a text progress bar.

    Example: ████████░░░░░░░░░░░░ 40%
    """
    filled = int(width * percent / 100)
    empty = width - filled
    bar = "\u2588" * filled + "\u2591" * empty
    return "{} {:>3}%".format(bar, int(percent))


def _read_file_safe(filepath):
    """Read a file and return its content, or empty string on error."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except (IOError, OSError):
        return ""


def _detect_node_runtime(project_root, pkg):
    """Detect Node.js runtime version from engines, .nvmrc, or .node-version."""
    engines = pkg.get("engines", {})
    node_ver = engines.get("node", "")
    if node_ver:
        return "Node.js {}".format(node_ver)

    for version_file in [".nvmrc", ".node-version"]:
        vpath = os.path.join(project_root, version_file)
        if os.path.isfile(vpath):
            content = _read_file_safe(vpath).strip()
            if content:
                return "Node.js {}".format(content)

    return "Node.js"


def _parse_python_deps(py_content, req_content):
    """Extract Python package names from pyproject.toml and requirements.txt.

    Returns a set of lowercased package names (without version specifiers).
    """
    deps = set()

    # Parse requirements.txt lines: "package==1.0", "package>=2.0", "package"
    for line in req_content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Split on version specifiers and extras
        name = re.split(r"[>=<!~;\[\s]", line, 1)[0].strip()
        if name:
            deps.add(name.lower())

    # Parse pyproject.toml dependencies (simplified: look for quoted strings
    # in [project.dependencies] and [project.optional-dependencies.*] sections)
    in_deps_section = False
    for line in py_content.splitlines():
        stripped = line.strip()
        if stripped.startswith("["):
            in_deps_section = (
                "dependencies" in stripped.lower()
                and "optional" not in stripped.lower()
            ) or "dependencies" in stripped.lower()
            continue
        if in_deps_section:
            # Match quoted dependency: "flask>=2.0" or 'django~=4.0'
            match = re.match(r"""^[\s"']*([a-zA-Z0-9_-]+)""", stripped)
            if match:
                deps.add(match.group(1).lower())

    return deps


def detect_project_context(project_root):
    """Auto-detect project tech stack from project files.

    Reads package.json, pyproject.toml, requirements.txt, docker-compose,
    and common config files to infer language, frameworks, styling,
    database, ORM, bundler, testing, and project type.

    Returns a dict of detected key-value pairs. Only detected fields are
    included — no empty or null values. Adapts to any project type
    (frontend-only, backend-only, fullstack, library, CLI, monorepo).
    """
    detected = {}

    # ── 1. Node.js / JavaScript / TypeScript project ──
    pkg_path = os.path.join(project_root, "package.json")
    if os.path.isfile(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)

            # All dependencies combined for detection
            deps = {}
            deps.update(pkg.get("dependencies", {}))
            deps.update(pkg.get("devDependencies", {}))

            # Language
            if "typescript" in deps or os.path.isfile(
                os.path.join(project_root, "tsconfig.json")
            ):
                detected["language"] = "TypeScript"
            else:
                detected["language"] = "JavaScript"

            # Runtime
            detected["runtime"] = _detect_node_runtime(project_root, pkg)

            # Test framework (more specific first)
            scripts = pkg.get("scripts", {})
            test_script = (
                scripts.get("test", "")
                + " "
                + scripts.get("test:unit", "")
            )
            if "vitest" in deps or "vitest" in test_script:
                detected["testing_framework"] = "Vitest"
            elif "jest" in deps or "jest" in test_script:
                detected["testing_framework"] = "Jest"
            elif "mocha" in deps or "mocha" in test_script:
                detected["testing_framework"] = "Mocha"
            elif "--test" in test_script or "node:test" in test_script:
                detected["testing_framework"] = "Node.js built-in test runner"

            # ── Frontend framework ──
            frontend_frameworks = [
                ("next", "Next.js"),
                ("nuxt", "Nuxt"),
                ("@angular/core", "Angular"),
                ("svelte", "Svelte"),
                ("solid-js", "Solid.js"),
                ("react", "React"),
                ("vue", "Vue.js"),
            ]
            for dep_name, fw_name in frontend_frameworks:
                if dep_name in deps:
                    detected["frontend_framework"] = fw_name
                    break

            # ── Backend framework ──
            backend_frameworks = [
                ("@nestjs/core", "NestJS"),
                ("express", "Express.js"),
                ("fastify", "Fastify"),
                ("koa", "Koa"),
                ("hapi", "Hapi"),
                ("hono", "Hono"),
            ]
            for dep_name, fw_name in backend_frameworks:
                if dep_name in deps:
                    detected["backend_framework"] = fw_name
                    break

            # Legacy "framework" field for backward compatibility
            if "frontend_framework" in detected:
                detected["framework"] = detected["frontend_framework"]
            elif "backend_framework" in detected:
                detected["framework"] = detected["backend_framework"]

            # ── Frontend styling ──
            styling_libs = [
                ("tailwindcss", "Tailwind CSS"),
                ("@tailwindcss/vite", "Tailwind CSS"),
                ("styled-components", "Styled Components"),
                ("@emotion/react", "Emotion"),
                ("@emotion/styled", "Emotion"),
                ("@mui/material", "Material UI"),
                ("@chakra-ui/react", "Chakra UI"),
                ("antd", "Ant Design"),
                ("sass", "SCSS/Sass"),
                ("node-sass", "SCSS/Sass"),
                ("less", "Less"),
            ]
            for dep_name, style_name in styling_libs:
                if dep_name in deps:
                    detected["frontend_styling"] = style_name
                    break

            # ── Database ──
            db_libs = [
                ("pg", "PostgreSQL"),
                ("postgres", "PostgreSQL"),
                ("mysql2", "MySQL"),
                ("mysql", "MySQL"),
                ("better-sqlite3", "SQLite"),
                ("mongodb", "MongoDB"),
                ("mongoose", "MongoDB"),
                ("redis", "Redis"),
                ("ioredis", "Redis"),
            ]
            for dep_name, db_name in db_libs:
                if dep_name in deps:
                    detected["database"] = db_name
                    break

            # ── ORM ──
            orm_libs = [
                ("@prisma/client", "Prisma"),
                ("prisma", "Prisma"),
                ("drizzle-orm", "Drizzle"),
                ("typeorm", "TypeORM"),
                ("sequelize", "Sequelize"),
                ("mongoose", "Mongoose"),
                ("knex", "Knex.js"),
                ("@mikro-orm/core", "MikroORM"),
            ]
            for dep_name, orm_name in orm_libs:
                if dep_name in deps:
                    detected["orm"] = orm_name
                    break

            # ── Bundler ──
            bundler_libs = [
                ("vite", "Vite"),
                ("webpack", "Webpack"),
                ("esbuild", "esbuild"),
                ("rollup", "Rollup"),
                ("parcel", "Parcel"),
                ("turbo", "Turborepo"),
                ("@rspack/core", "Rspack"),
            ]
            for dep_name, bundler_name in bundler_libs:
                if dep_name in deps:
                    detected["bundler"] = bundler_name
                    break

            # ── Project type inference ──
            has_frontend = "frontend_framework" in detected
            has_backend = "backend_framework" in detected
            has_workspaces = "workspaces" in pkg
            has_bin = "bin" in pkg

            if has_workspaces:
                detected["project_type"] = "monorepo"
            elif has_frontend and has_backend:
                detected["project_type"] = "fullstack"
            elif has_frontend:
                detected["project_type"] = "frontend"
            elif has_backend:
                detected["project_type"] = "backend"
            elif has_bin:
                detected["project_type"] = "cli"
            elif "main" in pkg or "exports" in pkg:
                detected["project_type"] = "library"

        except (json.JSONDecodeError, IOError):
            pass

    # ── 2. Python project detection ──
    if "language" not in detected:
        py_content = ""
        for marker in ["pyproject.toml", "setup.py", "requirements.txt"]:
            marker_path = os.path.join(project_root, marker)
            if os.path.isfile(marker_path):
                detected["language"] = "Python"
                if marker == "pyproject.toml":
                    py_content = _read_file_safe(marker_path)
                break

        if detected.get("language") == "Python":
            req_path = os.path.join(project_root, "requirements.txt")
            req_content = _read_file_safe(req_path) if os.path.isfile(req_path) else ""
            py_deps = _parse_python_deps(py_content, req_content)

            # Runtime version (regex for requires-python = ">=3.11")
            if py_content:
                ver_match = re.search(
                    r'requires-python\s*=\s*["\']([^"\']+)["\']', py_content
                )
                if ver_match:
                    detected["runtime"] = "Python {}".format(ver_match.group(1))

            # Testing
            if "pytest" in py_deps:
                detected["testing_framework"] = "pytest"

            # Backend framework
            py_backend = [
                ("django", "Django"),
                ("fastapi", "FastAPI"),
                ("flask", "Flask"),
                ("starlette", "Starlette"),
                ("tornado", "Tornado"),
                ("aiohttp", "aiohttp"),
            ]
            for dep_name, fw_name in py_backend:
                if dep_name in py_deps:
                    detected["backend_framework"] = fw_name
                    detected["framework"] = fw_name
                    break

            # Database / ORM
            py_db = [
                ("psycopg2", "PostgreSQL"),
                ("psycopg", "PostgreSQL"),
                ("asyncpg", "PostgreSQL"),
                ("pymysql", "MySQL"),
                ("pymongo", "MongoDB"),
                ("motor", "MongoDB"),
            ]
            for dep_name, db_name in py_db:
                if dep_name in py_deps:
                    detected["database"] = db_name
                    break

            py_orm = [
                ("sqlalchemy", "SQLAlchemy"),
                ("tortoise-orm", "Tortoise ORM"),
                ("peewee", "Peewee"),
            ]
            for dep_name, orm_name in py_orm:
                if dep_name in py_deps:
                    detected["orm"] = orm_name
                    break
            # Django ORM: if django is a dep and no other ORM detected
            if "django" in py_deps and "orm" not in detected:
                detected["orm"] = "Django ORM"

            # Project type
            if "backend_framework" in detected:
                detected["project_type"] = "backend"

    # ── 3. Go project detection ──
    if "language" not in detected:
        go_mod_path = os.path.join(project_root, "go.mod")
        if os.path.isfile(go_mod_path):
            detected["language"] = "Go"
            detected["runtime"] = "Go"
            go_content = _read_file_safe(go_mod_path)
            if "gin-gonic" in go_content:
                detected["backend_framework"] = "Gin"
            elif "labstack/echo" in go_content:
                detected["backend_framework"] = "Echo"
            elif "go-chi/chi" in go_content:
                detected["backend_framework"] = "Chi"
            if "backend_framework" in detected:
                detected["framework"] = detected["backend_framework"]
                detected["project_type"] = "backend"

    # ── 4. Rust / Java / other languages (basic detection) ──
    if "language" not in detected:
        if os.path.isfile(os.path.join(project_root, "Cargo.toml")):
            detected["language"] = "Rust"
            detected["runtime"] = "Rust"
        elif os.path.isfile(os.path.join(project_root, "pom.xml")):
            detected["language"] = "Java"
            detected["runtime"] = "Java (Maven)"
        elif os.path.isfile(os.path.join(project_root, "build.gradle")):
            detected["language"] = "Java/Kotlin"
            detected["runtime"] = "Java (Gradle)"

    # ── 5. Database from docker-compose (cross-language) ──
    if "database" not in detected:
        for dc_name in [
            "docker-compose.yml",
            "docker-compose.yaml",
            "compose.yml",
            "compose.yaml",
        ]:
            dc_path = os.path.join(project_root, dc_name)
            if os.path.isfile(dc_path):
                dc_content = _read_file_safe(dc_path).lower()
                dc_db = [
                    ("postgres", "PostgreSQL"),
                    ("mysql", "MySQL"),
                    ("mariadb", "MariaDB"),
                    ("mongo", "MongoDB"),
                    ("redis", "Redis"),
                    ("sqlite", "SQLite"),
                ]
                for pattern, db_name in dc_db:
                    if pattern in dc_content:
                        detected["database"] = db_name
                        break
                break

    return detected


def enrich_global_context(global_context, project_root):
    """Fill gaps in global_context using auto-detected project info.

    Only adds auto-detected values for keys not already present.
    Mutates global_context in place and returns it.
    """
    if not project_root:
        return global_context

    detected = detect_project_context(project_root)
    # Map detected keys → global_context convention names
    key_mapping = {
        "language": "language",
        "testing_framework": "testing_strategy",
        "framework": "framework",
        "frontend_framework": "frontend_framework",
        "frontend_styling": "frontend_styling",
        "backend_framework": "backend_framework",
        "database": "database",
        "orm": "orm",
        "bundler": "bundler",
        "project_type": "project_type",
        "runtime": "runtime",
    }
    # Alternate key names that should block auto-detection
    alt_keys = {
        "testing_strategy": ["testing_framework", "test_framework", "testing"],
    }
    for det_key, ctx_key in key_mapping.items():
        if det_key not in detected:
            continue
        if ctx_key in global_context:
            continue
        already_set = any(
            k in global_context for k in alt_keys.get(ctx_key, [])
        )
        if not already_set:
            global_context[ctx_key] = detected[det_key] + " (auto-detected)"

    return global_context


def read_platform_conventions(project_root):
    """Resolve the path to CLAUDE.md or CODEBUDDY.md for project-level conventions.

    Returns a path reference for the AI agent to read at runtime,
    rather than inlining the full file content into the prompt.
    """
    platform = os.environ.get("PRIZMKIT_PLATFORM", "claude")
    if platform == "codebuddy":
        candidates = ["CODEBUDDY.md", "CLAUDE.md"]
    else:
        candidates = ["CLAUDE.md", "CODEBUDDY.md"]

    for filename in candidates:
        filepath = os.path.join(project_root, filename)
        if os.path.isfile(filepath):
            return "`{}`".format(filename)

    return "(No project conventions file found — CLAUDE.md or CODEBUDDY.md)"
