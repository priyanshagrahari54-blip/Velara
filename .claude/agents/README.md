# Agent Definitions

CCGS-pattern: YAML frontmatter + markdown body. Full hierarchy: `../../AGENTS.md`.
Files: game-director.md, technical-director.md, lead-programmer.md,
physics-engineer.md, graphics-engineer.md, qa-lead.md, build-engineer.md,
gameplay-designer.md, art-director.md.

Format template:

```markdown
---
name: physics-engineer
department: Engineering
reports_to: technical-director
owns: [src/gameplay/vehicle.js, src/gameplay/player.js, physics tests]
gate: Physically stable (no launches/tunneling); node physics tests green
---
## Does
- Vehicle tuning, suspension, collision response, anti-blowup guards
## Escalates
- Architectural physics decisions -> technical-director (ADR)
## Never
- Engine/renderer changes without graphics-engineer sign-off
```
