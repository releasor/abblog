   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — File Manifest**: For each file relevant to this feature, list: file path, why it's needed (modify/reference/test), key interface signatures (function names + params + return types). Do NOT include full file content — agents read files on-demand. Format:
     ### Files to Modify
     | File | Why Needed | Key Interfaces |
     |------|-----------|----------------|
     | `<source-dir>/config.js` | Add runtime config layer | `config` (Zod object), `configSchema` |

     ### Files for Reference
     | File | Why Needed | Key Interfaces |
     |------|-----------|----------------|
     | `<source-dir>/security/permission-guard.js` | Permission check integration | `checkCommandPermission(userId, cmd)` |

     ### Known TRAPS (from .prizm-docs/)
     - <trap entries extracted from L1/L2 docs>


**Checkpoint update**: Update `workflow-checkpoint.json` — set step `context-snapshot` to `"completed"`.
