# Frontend Design Guide — High-Quality UI Implementation

> Create distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics.

**app-planner context**: In the planning phase, use this guide to establish **design direction decisions** (aesthetic tone, typography approach, color strategy, layout philosophy). Do NOT produce CSS, code, or implementation artifacts — capture the design direction as decisions in the project instruction file (`CLAUDE.md` / `CODEBUDDY.md`). Downstream implementation skills will consume these decisions when building features.

Load this guide **only when the feature involves frontend/UI work**. Skip for backend-only or infrastructure features.

## Context Gathering (Required Before Design)

Before any UI design work, gather:
- **Target audience**: Who uses this product and in what context?
- **Use cases**: What jobs are they trying to get done?
- **Brand personality/tone**: How should the interface feel?

You cannot infer this from codebase alone — ask the user.

## Design Direction

Commit to a **bold** aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an intentional aesthetic — minimalist, editorial, brutalist, organic, luxury, playful, retro-futuristic, industrial, art deco, etc.
- **Differentiation**: What makes this unforgettable?

## Typography

- Choose distinctive fonts. Pair a display font with a refined body font.
- Use a modular type scale with fluid sizing (`clamp()`)
- Vary font weights and sizes for clear visual hierarchy
- Avoid overused fonts: Inter, Roboto, Arial, Open Sans, system defaults
- Avoid monospace as lazy shorthand for "technical" vibes

## Color & Theme

- Use modern CSS color functions (oklch, color-mix, light-dark)
- Tint neutrals toward brand hue for subconscious cohesion
- Avoid: pure black (#000) or pure white (#fff) — always tint
- Avoid: the AI palette (cyan-on-dark, purple-to-blue gradients, neon accents on dark)
- Avoid: gradient text for "impact", default dark mode with glowing accents

## Layout & Space

- Create visual rhythm through varied spacing — not uniform padding
- Use fluid spacing with `clamp()` that breathes on larger screens
- Embrace asymmetry and unexpected compositions
- Avoid: wrapping everything in cards, nesting cards, identical card grids
- Avoid: centering everything, uniform spacing

## Motion

- Focus on high-impact moments: one well-orchestrated page load > scattered micro-interactions
- Use exponential easing for natural deceleration
- Use `transform` and `opacity` only — avoid animating layout properties
- Avoid: bounce/elastic easing, excessive animations

## Interaction

- Use progressive disclosure — start simple, reveal complexity through interaction
- Design empty states that teach the interface
- Use optimistic UI — update immediately, sync later
- Avoid: making every button primary, redundant headers

## Responsive

- Use container queries (`@container`) for component-level responsiveness
- Adapt the interface for different contexts, don't just shrink it
- Never hide critical functionality on mobile

## The AI Slop Test

If you showed this interface to someone and said "AI made this", would they believe you immediately? If yes, redesign. A distinctive interface should make someone ask "how was this made?" not "which AI made this?"

## Windows Compatibility

When running on Windows, prefer PowerShell-compatible commands and use these substitutions when a command example shows Unix shell syntax:

- Use `python` or `py -3` when `python3` is unavailable.
- Use `where.exe <command>` instead of `command -v <command>`.
- Use `Get-ChildItem`, `Select-String`, `Get-Content`, and `Set-Content` instead of `find`, `grep`, `cat`, and shell redirection pipelines.
- For dev-pipeline entrypoints, use the matching PowerShell wrapper: `run-feature.ps1`, `run-bugfix.ps1`, `run-refactor.ps1`, `run-recovery.ps1`, `launch-feature-daemon.ps1`, `launch-bugfix-daemon.ps1`, `launch-refactor-daemon.ps1`, `reset-feature.ps1`, `reset-bug.ps1`, or `reset-refactor.ps1`.
- Pipeline `run`, `resume`, `status`, `reset`, `unskip`, `init`, daemon `status`, daemon `logs`, daemon `stop`, and daemon `start` are handled by native PowerShell wrappers on Windows.

