# Dev-Pipeline Schema Analysis Report

## Executive Summary

This report analyzes three JSON schemas used by the PrizmKit Dev-Pipeline:
1. **Feature List Schema** (`feature-list-schema.json`) - for feature tracking
2. **Bug Fix List Schema** (`bug-fix-list-schema.json`) - for bug fix tracking  
3. **Refactor List Schema** (`refactor-list-schema.json`) - for refactor tracking

## 1. ROOT-LEVEL PROPERTIES

### Common Root Properties (All 3 Schemas)

| Property | Type | Required | Enum Values | Notes |
|----------|------|----------|-------------|-------|
| `$schema` | string | YES | Feature: `"dev-pipeline-feature-list-v1"` | Each schema has unique constant value |
| | | | Bug: `"dev-pipeline-bug-fix-list-v1"` | |
| | | | Refactor: `"dev-pipeline-refactor-list-v1"` | |
| `project_name` | string | YES | N/A | minLength: 1 |
| `project_description` | string | NO | N/A | Optional in all |
| `created_at` | string | NO | N/A | ISO format (date-time) |
| `created_by` | string | NO | N/A | Optional in all |
| `global_context` | object | NO | N/A | See section 3 |

### Schema-Specific Root Properties

| Property | Schema | Type | Required |
|----------|--------|------|----------|
| `source_spec` | Feature Only | string | NO |
| `features` | Feature | array | YES |
| `bugs` | Bug Fix | array | YES |
| `refactors` | Refactor | array | YES |

**Items Constraints:**
- Feature: `minItems: 1`
- Bug Fix: `minItems: 1`
- Refactor: `minItems: 1`

---

## 2. ITEM-LEVEL PROPERTIES (Key Differences)

### Feature Item

**Required fields:**
```
id, title, description, priority, dependencies, acceptance_criteria, status
```

**Optional fields:**
```
estimated_complexity, session_granularity, sub_features, model, critic, 
critic_count, completion_notes, browser_interaction
```

| Property | Type | Enum/Pattern | Notes |
|----------|------|--------------|-------|
| `id` | string | Pattern: `^F-\d{3}(-[A-Z])?$` | F-001, F-001-A, etc. |
| `title` | string | N/A | minLength: 1 |
| `description` | string | N/A | minLength: 1 |
| `priority` | string | `critical, high, medium, low` | ✓ REQUIRED |
| `dependencies` | array | Pattern: `^F-\d{3}(-[A-Z])?$` | Array of feature IDs |
| `acceptance_criteria` | array | N/A | minItems: 1, array of strings |
| `status` | string | `pending, in_progress, completed, failed, skipped, split, auto_skipped` | ✓ REQUIRED |
| `estimated_complexity` | string | `low, medium, high` | Optional |
| `session_granularity` | string | `feature, sub_feature, auto` | Default: `"feature"` |
| `sub_features` | array | N/A | Objects with id, title, description |
| `model` | string | N/A | AI model override |
| `critic` | boolean | N/A | Default: `false` |
| `critic_count` | integer | `1, 3` | Enum: single or multi-critic |
| `completion_notes` | array | N/A | Array of strings, AI-generated summaries |
| `browser_interaction` | object | N/A | Config for UI verification (requires playwright) |

### Bug Fix Item

**Required fields:**
```
id, title, description, severity, error_source, verification_type, 
acceptance_criteria, status
```

**Optional fields:**
```
priority, affected_feature, affected_modules, environment, critic, 
critic_count, model
```

| Property | Type | Enum/Pattern | Notes |
|----------|------|--------------|-------|
| `id` | string | Pattern: `^B-\d{3}$` | B-001, B-002, etc. |
| `title` | string | N/A | minLength: 1 - brief symptom description |
| `description` | string | N/A | minLength: 1 - detailed: expected vs actual |
| `severity` | string | `critical, high, medium, low` | ✓ REQUIRED; maps to priority |
| `priority` | string | `high, medium, low` | Optional; derived from severity; NOT critical |
| `error_source` | object | type enum: `stack_trace, user_report, failed_test, log_pattern, monitoring_alert` | ✓ REQUIRED |
| `verification_type` | string | `automated, manual, hybrid` | ✓ REQUIRED |
| `acceptance_criteria` | array | N/A | minItems: 1 |
| `status` | string | `pending, triaging, reproducing, fixing, verifying, completed, failed, needs_info, skipped` | ✓ REQUIRED; more states than Feature |
| `affected_feature` | string | Pattern: `^F-\d{3}(-[A-Z])?$` | Optional; link to original feature |
| `affected_modules` | array | N/A | Optional; module names |
| `environment` | object | N/A | Optional; os, runtime, browser, version |
| `critic` | boolean | N/A | Default: `false` (true for high severity) |
| `critic_count` | integer | `1, 3` | Optional; only if critic=true |
| `model` | string | N/A | AI model override |

### Refactor Item

**Required fields:**
```
id, title, description, scope, type, priority, complexity, 
behavior_preservation, acceptance_criteria, dependencies, status
```

**Optional fields:**
```
model, estimated_lines, completion_notes, critic, critic_count
```

| Property | Type | Enum/Pattern | Notes |
|----------|------|--------------|-------|
| `id` | string | Pattern: `^R-\d{3}$` | R-001, R-002, etc. |
| `title` | string | N/A | minLength: 1 |
| `description` | string | N/A | minLength: 1 |
| `scope` | object | N/A | Files and modules affected |
| `type` | string | `extract, rename, restructure, simplify, decouple, migrate` | ✓ REQUIRED; specific refactor type |
| `priority` | string | `critical, high, medium, low` | ✓ REQUIRED |
| `complexity` | string | `low, medium, high` | ✓ REQUIRED |
| `behavior_preservation` | object | strategy: `test-gate, snapshot, manual` | ✓ REQUIRED object |
| `acceptance_criteria` | array | N/A | minItems: 1 |
| `dependencies` | array | Pattern: `^R-\d{3}$` | ✓ REQUIRED; array of refactor IDs only |
| `status` | string | `pending, in_progress, completed, failed, skipped` | ✓ REQUIRED; simpler than Bug |
| `model` | string | N/A | AI model override |
| `estimated_lines` | integer | N/A | Optional |
| `completion_notes` | array | N/A | AI-generated summaries |
| `critic` | boolean | N/A | Default: `false` (true for critical/high) |
| `critic_count` | integer | `1, 3` | Default: 3 for critical, 1 for high |

---

## 3. GLOBAL_CONTEXT OBJECT (Shared Structure)

**Location:** Root-level, optional in all 3 schemas

**Properties (all optional):**
```
tech_stack, language, runtime, frontend_framework, frontend_styling,
backend_framework, database, orm, testing_strategy, bundler, project_type
```

**Bug Fix & Refactor Only (NOT in Feature):**
```
design_system, ci_pipeline
```

### Field Details

| Property | Type | Present In |
|----------|------|-----------|
| `tech_stack` | string | All 3 |
| `language` | string | All 3 |
| `runtime` | string | All 3 |
| `frontend_framework` | string | All 3 |
| `frontend_styling` | string | All 3 |
| `backend_framework` | string | All 3 |
| `database` | string | All 3 |
| `orm` | string | All 3 |
| `testing_strategy` | string | All 3 |
| `bundler` | string | All 3 |
| `project_type` | string | All 3 |
| `design_system` | string | Bug Fix + Refactor ONLY ❌ Feature |
| `ci_pipeline` | string | Bug Fix + Refactor ONLY ❌ Feature |

---

## 4. KEY INCONSISTENCIES & SCHEMA DIFFERENCES

### 4.1 ID Pattern Inconsistencies

| Schema | ID Pattern | Example |
|--------|-----------|---------|
| Feature | `^F-\d{3}(-[A-Z])?$` | F-001, F-001-A ✓ Allows sub-feature suffixes |
| Bug Fix | `^B-\d{3}$` | B-001 ✗ NO suffixes allowed |
| Refactor | `^R-\d{3}$` | R-001 ✗ NO suffixes allowed |

**Finding:** Only Features support sub-IDs with `-[A-Z]` suffix. This is intentional (features can split into sub_features).

### 4.2 Priority vs Severity (Bug Fix Only)

**Feature & Refactor:** Direct `priority` enum
```
"priority": ["critical", "high", "medium", "low"]
```

**Bug Fix:** Has BOTH `severity` and `priority`
```
"severity": ["critical", "high", "medium", "low"]  ← ✓ REQUIRED
"priority": ["high", "medium", "low"]               ← ✗ NO "critical" option
```

**Issue:** Bug Fix severity has "critical" but priority doesn't. Pipeline docs state:
> "Both critical and high severity map to high priority"

**Impact:** When deserializing a bug with severity="critical", pipeline must map to priority="high" (not preserved).

### 4.3 Status Enums - Feature vs Bug vs Refactor

**Feature Status (7 values):**
```
pending, in_progress, completed, failed, skipped, split, auto_skipped
```

**Bug Fix Status (9 values):**
```
pending, triaging, reproducing, fixing, verifying, completed, failed, needs_info, skipped
```
*Includes intermediate workflow states: triaging, reproducing, fixing, verifying, needs_info*
*NO "split" or "auto_skipped"*

**Refactor Status (5 values):**
```
pending, in_progress, completed, failed, skipped
```
*Simplest; no workflow states*

### 4.4 Dependencies Pattern

| Schema | Dependencies | Pattern |
|--------|--------------|---------|
| Feature | `dependencies` (required) | `^F-\d{3}(-[A-Z])?$` - can reference sub-features |
| Bug Fix | N/A | No `dependencies` field ❌ |
| Refactor | `dependencies` (required) | `^R-\d{3}$` - ONLY refactor IDs, no sub-IDs |

**Issue:** Bug Fix schema lacks dependency tracking. Bugs cannot declare prerequisites. Feature dependencies support sub-features; Refactor dependencies do not.

### 4.5 Acceptance Criteria vs Task Lists

| Schema | AC Field | Type | Notes |
|--------|----------|------|-------|
| Feature | `acceptance_criteria` | array of strings | minItems: 1, manually written |
| Bug Fix | `acceptance_criteria` | array of strings | minItems: 1, fix verification criteria |
| Refactor | `acceptance_criteria` | array of strings | minItems: 1, completion criteria |

**Finding:** All use same field name & structure. AC format is schema-agnostic.

### 4.6 Critic Configuration Differences

| Schema | Critic Default | Critic Count Default | Notes |
|--------|-----------------|----------------------|-------|
| Feature | `false` | 1 | Per-feature override possible |
| Bug Fix | `false` for most; `true` for "high severity"` | 1 for high severity; omit for others | Special logic: high severity → critic=true |
| Refactor | `false` (explicit); `true` for "critical/high"` | 3 for critical; 1 for high; omit for others | Special defaults: critical→3 critics, high→1 |

**Finding:** Refactor has the strictest critic defaults (auto-enable for critical/high). Bug Fix has conditional enable (high severity only). Feature has manual opt-in.

### 4.7 Schema-Specific Features

#### Feature Only
- `sub_features` (nested array of objects)
- `session_granularity` (feature, sub_feature, auto)
- `browser_interaction` (UI verification config)
- `source_spec` (root-level, source spec reference)

#### Bug Fix Only
- `severity` (critical, high, medium, low)
- `error_source` (object: type + metadata - stack_trace, user_report, etc.)
- `affected_feature` (F-ID reference)
- `affected_modules` (array of module names)
- `environment` (os, runtime, browser, version)

#### Refactor Only
- `type` (extract, rename, restructure, simplify, decouple, migrate)
- `behavior_preservation` (strategy: test-gate, snapshot, manual)
- `estimated_lines` (integer, lines of code affected)

#### All Three
- `id`, `title`, `description`
- `priority` (with caveats for Bug Fix)
- `acceptance_criteria`
- `status`
- `model` (AI model override)
- `critic`, `critic_count`
- `completion_notes`

### 4.8 Global Context Discrepancies

**Feature's global_context is MISSING:**
- `design_system` ❌ (present in Bug Fix & Refactor)
- `ci_pipeline` ❌ (present in Bug Fix & Refactor)

**Why?** Legacy inconsistency. Feature schema predates Bug Fix / Refactor and wasn't updated.

**Risk:** If a codebase tries to unify global_context across all three, it must handle optional fields conditionally.

---

## 5. TEMPLATE DIRECTORY STRUCTURE

### Critical Paths Files

**Three variants exist for each concept:**

| Concept | Files | Scope |
|---------|-------|-------|
| Critical Paths | `critical-paths-full.md`, `critical-paths-lite.md`, `critical-paths-agent.md` | Different detail levels |
| Directory Convention | `directory-convention-full.md`, `directory-convention-lite.md`, `directory-convention-agent.md` | Lite vs Full vs Agent mode |
| Phase Context Snapshot | `phase-context-snapshot-base.md`, `phase-context-snapshot-lite-suffix.md`, `phase-context-snapshot-agent-suffix.md` | Suffix variants for modes |
| Phase Implementation | `phase-implement-lite.md`, `phase-implement-full.md`, `phase-implement-agent.md` | Three execution modes |
| Phase Review | `phase-review-full.md`, `phase-review-agent.md` | Full & Agent variants |
| Phase Plan | `phase-plan-lite.md`, `phase-plan-agent.md` | Lite & Agent variants |
| Phase Critic | `phase-critic-plan.md`, `phase-critic-plan-full.md` | Plan review (single and multi) |
| Phase Commit | `phase-commit.md`, `phase-commit-full.md` | Standard & Full variants |

### Singleton Sections

| File | Purpose |
|------|---------|
| `failure-capture.md` | Failure logging protocol |
| `session-context.md` | Session metadata template |
| `subagent-timeout-recovery.md` | Recovery on agent timeout |
| `test-failure-recovery.md` | Test failure handling |
| `checkpoint-system.md` | Workflow checkpoint tracking |
| `phase0-init.md` | Project bootstrap |
| `phase0-test-baseline.md` | Baseline test detection |
| `resume-header.md` | Resume from phase template |
| `failure-log-check.md` | Failure log diagnostics |
| `context-budget-rules.md` | Context window guardrails |
| `phase-browser-verification.md` | Playwright UI verification |
| `phase-deploy-verification.md` | [DEPRECATED] Local deployment check (template removed) |
| `ac-verification-checklist.md` | Acceptance criteria verification |
| `feature-context.md` | Feature brief context |
| `phase-specify-plan-full.md` | Full spec + plan workflow |

### Total Section Files: 36 markdown templates

---

## 6. ENVIRONMENT CONFIGURATION (.env.example)

**Key Environment Variables:**

| Variable | Type | Default | Scope |
|----------|------|---------|-------|
| `PRIZMKIT_ENV` | string | (unset) | "test" = debug bootstrap output |
| `AI_CLI` | string | auto-detect | claude or cbc |
| `MODEL` | string | (unset) | AI model override (per-task overrides this) |
| `MAX_RETRIES` | integer | (not specified) | Retry attempts per task |
| `SESSION_TIMEOUT` | integer | 0 | 0 = no limit |
| `VERBOSE` | integer | (not specified) | 1=on, 0=off |
| `ENABLE_CRITIC` | boolean | false | Adversarial review enable |
| `PIPELINE_MODE` | string | auto-detect | lite/standard/full override |
| `STRICT_BEHAVIOR_CHECK` | integer | (not specified) | Refactor full test suite |
| `AUTO_PUSH` | integer | 0 | 0=off, 1=on |
| `DEV_BRANCH` | string | auto-generated | Custom branch name |
| `HEARTBEAT_INTERVAL` | integer | 30 | Heartbeat log interval (s) |
| `HEARTBEAT_STALE_THRESHOLD` | integer | 600 | Max seconds without heartbeat |
| `LOG_CLEANUP_ENABLED` | integer | 1 | Periodic cleanup |
| `LOG_RETENTION_DAYS` | integer | 14 | Delete logs older than N days |
| `LOG_MAX_TOTAL_MB` | integer | 1024 | Max total logs (MB) |

**Priority:** Command-line env vars > .env file > defaults

---

## 7. BOOTSTRAP PROMPT FILES

Located in `/dev-pipeline/templates/`:

| File | Purpose | Size |
|------|---------|------|
| `bootstrap-prompt.md` | Standard bootstrap | ~1.8 KB |
| `bootstrap-tier1.md` | Lite/minimal workflow | ~18 KB |
| `bootstrap-tier2.md` | Standard workflow | ~25 KB |
| `bootstrap-tier3.md` | Full workflow | ~31 KB |
| `bugfix-bootstrap-prompt.md` | Bug fix workflow | ~14 KB |
| `refactor-bootstrap-prompt.md` | Refactor workflow | ~11 KB |

**Finding:** Tier-based bootstraps suggest complexity-driven workflow selection. Bug fix & refactor have dedicated bootstraps.

---

## 8. DETAILED INCONSISTENCY MATRIX

### Table: Cross-Schema Field Presence

| Field | Feature | Bug Fix | Refactor | Issue |
|-------|---------|---------|----------|-------|
| `id` | F-001(-A) | B-001 | R-001 | Different patterns, Feature allows suffixes |
| `title` | ✓ | ✓ | ✓ | Consistent |
| `description` | ✓ | ✓ | ✓ | Consistent |
| `priority` | ✓ req | partial | ✓ req | Bug Fix lacks "critical" in priority enum |
| `severity` | ❌ | ✓ req | ❌ | Bug Fix only, no feature severity |
| `dependencies` | ✓ req (F-IDs) | ❌ | ✓ req (R-IDs) | Bug Fix lacks deps, Feature allows sub-IDs |
| `acceptance_criteria` | ✓ req | ✓ req | ✓ req | Consistent |
| `status` | 7 values | 9 values | 5 values | Inconsistent enum sizes |
| `error_source` | ❌ | ✓ req | ❌ | Bug Fix only |
| `verification_type` | ❌ | ✓ req | ❌ | Bug Fix only |
| `scope` | ❌ | ❌ | ✓ req | Refactor only |
| `type` | ❌ | ❌ | ✓ req | Refactor only (refactor type) |
| `complexity` | optional | ❌ | ✓ req | Feature optional; Refactor required |
| `behavior_preservation` | ❌ | ❌ | ✓ req | Refactor only |
| `model` | ✓ opt | ✓ opt | ✓ opt | Consistent |
| `critic` | ✓ opt (default false) | ✓ opt (conditional) | ✓ opt (conditional) | Different defaults |
| `critic_count` | ✓ opt (1,3) | ✓ opt (1,3) | ✓ opt (1,3) | Enum consistent; defaults differ |
| `completion_notes` | ✓ opt | ❌ | ✓ opt | Bug Fix lacks completion notes |
| `affected_feature` | N/A | ✓ opt (F-ID) | N/A | Bug Fix only |
| `affected_modules` | N/A | ✓ opt | ❌ | Bug/Feature only (Refactor has scope.modules) |
| `environment` | N/A | ✓ opt | N/A | Bug Fix only |
| `sub_features` | ✓ opt | ❌ | ❌ | Feature only |
| `session_granularity` | ✓ opt | ❌ | ❌ | Feature only |
| `browser_interaction` | ✓ opt | ❌ | ❌ | Feature only |
| `estimated_lines` | N/A | ❌ | ✓ opt | Refactor only |
| `design_system` | ❌ | ✓ opt (global) | ✓ opt (global) | Missing from Feature global_context |
| `ci_pipeline` | ❌ | ✓ opt (global) | ✓ opt (global) | Missing from Feature global_context |

---

## 9. CRITICAL FINDINGS & RECOMMENDATIONS

### ⚠️ HIGH PRIORITY ISSUES

1. **Bug Fix Schema Missing Dependencies**
   - Bugs cannot declare prerequisite bugs or feature links
   - **Recommendation:** Add `dependencies` field (array of B-IDs) to enable bug fix ordering
   - **Impact:** May lead to out-of-order bug fixes if dependencies exist

2. **Global Context Inconsistency**
   - Feature missing `design_system` and `ci_pipeline`
   - **Recommendation:** Add these fields to Feature global_context for consistency
   - **Impact:** Feature pipelines cannot track design system or CI info

3. **Priority vs Severity Mismatch (Bug Fix)**
   - Bug Fix `severity` has "critical", but `priority` does NOT
   - **Recommendation:** Either add "critical" to priority enum OR document explicit mapping rules
   - **Impact:** Pipeline code must hardcode severity→priority mapping; unclear in schema

4. **Status Enum Proliferation**
   - 3 different status enums (Feature: 7, Bug: 9, Refactor: 5)
   - **Recommendation:** Standardize or document which phases these statuses map to
   - **Impact:** Code handling all 3 must have schema-specific status handling

### 🔴 MODERATE ISSUES

5. **Feature Dependencies Support Sub-IDs, Others Don't**
   - Feature dependencies: `^F-\d{3}(-[A-Z])?$` (can reference F-001-A)
   - Refactor dependencies: `^R-\d{3}$` (cannot reference sub-refactors)
   - **Recommendation:** Explicitly document this difference or make consistent
   - **Impact:** Refactors cannot decompose; Features can

6. **Critic Count Defaults Inconsistent**
   - Feature: default false, critic_count default 1
   - Bug Fix: default false (conditional true for high severity), critic_count 1 for high only
   - Refactor: default false (conditional true for critical/high), critic_count 3 for critical / 1 for high
   - **Recommendation:** Document default resolution rules in schema comments
   - **Impact:** Implicit defaults make it hard to reason about critic enablement

7. **Bug Fix Lacks Completion Notes**
   - Feature & Refactor have `completion_notes` array; Bug Fix does not
   - **Recommendation:** Add `completion_notes` to Bug Fix for consistency and downstream context
   - **Impact:** Bug fixes cannot propagate context to dependent features

8. **Complexity Field Inconsistency**
   - Feature: optional `estimated_complexity` (low, medium, high)
   - Bug Fix: NO complexity field
   - Refactor: required `complexity` (low, medium, high)
   - **Recommendation:** Make Bug Fix complexity optional to match Feature; or require in all 3
   - **Impact:** Can't estimate bug fix effort from schema

### 🟡 MINOR ISSUES

9. **Source Spec Field (Feature Only)**
   - Feature root has optional `source_spec` string; others don't
   - **Recommendation:** Document purpose or generalize to all schemas
   - **Impact:** Feature-specific metadata not portable

10. **Session Granularity (Feature Only)**
    - Feature only field; no equivalent in Bug Fix or Refactor
    - **Recommendation:** Document as intentional Feature-specific feature
    - **Impact:** Execution granularity concept not generalized

---

## 10. EXACT ENUM VALUES SUMMARY

### ID Patterns
- **Feature**: `^F-\d{3}(-[A-Z])?$` → F-001, F-001-A, F-123-Z
- **Bug Fix**: `^B-\d{3}$` → B-001, B-123
- **Refactor**: `^R-\d{3}$` → R-001, R-123

### Priority/Severity Enums
- **Feature Priority**: `[critical, high, medium, low]` (4 values)
- **Bug Severity**: `[critical, high, medium, low]` (4 values)
- **Bug Priority**: `[high, medium, low]` (3 values) ⚠️ NO CRITICAL
- **Refactor Priority**: `[critical, high, medium, low]` (4 values)

### Status Enums
- **Feature**: `[pending, in_progress, completed, failed, skipped, split, auto_skipped]` (7 values)
- **Bug Fix**: `[pending, triaging, reproducing, fixing, verifying, completed, failed, needs_info, skipped]` (9 values)
- **Refactor**: `[pending, in_progress, completed, failed, skipped]` (5 values)

### Complexity/Estimated Complexity Enums
- **Feature estimated_complexity** (optional): `[low, medium, high]`
- **Refactor complexity** (required): `[low, medium, high]`
- **Bug Fix**: NO FIELD

### Feature-Specific Enums
- **session_granularity**: `[feature, sub_feature, auto]` (default: "feature")
- **browser_interaction required fields**: `url` (string); optional: `setup_command`, `verify_steps` (array), `screenshot` (boolean, default true)

### Bug-Specific Enums
- **error_source.type**: `[stack_trace, user_report, failed_test, log_pattern, monitoring_alert]`
- **verification_type**: `[automated, manual, hybrid]`

### Refactor-Specific Enums
- **type**: `[extract, rename, restructure, simplify, decouple, migrate]` (6 values)
- **behavior_preservation.strategy**: `[test-gate, snapshot, manual]`

### Critic Count Enum (All 3)
- **critic_count**: `[1, 3]` (single critic or multi-critic voting)

---

## APPENDIX: TEMPLATE FILE COUNTS

**By Category:**
- Mode Variants (Full/Lite/Agent/Base): 18 files
- Singleton Phases & Workflows: 18 files
- **Total**: 36 markdown template sections

**Mode Distribution:**
- Full/Standard: 9 files
- Lite: 5 files
- Agent: 6 files
- Base/Shared: 7 files
- Singleton: 3 files

