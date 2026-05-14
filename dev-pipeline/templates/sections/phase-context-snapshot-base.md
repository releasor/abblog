### Build Context Snapshot

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Detect source code directories: read KEY_FILES and STRUCTURE sections from `root.prizm` to identify where source code lives (e.g. `src/`, `app/`, `lib/`, `cmd/`, `packages/`, or project root). If `root.prizm` is missing, scan the project tree:
   ```bash
   find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.rb" -o -name "*.rs" \) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/vendor/*' | head -30
   ```
   Identify the top-level source directories from the results.
3. Scan the detected source directories for files related to this feature; read each one
4. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: run the following to get a visual directory tree, then paste output:
     ```bash
     find . -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/__pycache__/*' -not -path '*/vendor/*' | sed -e 's;[^/]*/;|____;g;s;____|; |;g'
     ```
