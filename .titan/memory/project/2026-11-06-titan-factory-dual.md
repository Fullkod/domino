# Titan Factory para Claude Code y Codex

Date: 2026-11-06

- Capa copiada de Invoxa (que viene de kshop/klauShop): `.claude/` (toolbox Claude `1d92ede`, ver
  `.claude/titan-factory-source.json`), `plugins/titan-factory-codex/`, `.agents/`, `.codex/`, `skills-lock.json`.
  Se excluyó el skill propio `invoxa`. Marketplace renombrado a `domino` (`.agents/plugins/marketplace.json`,
  `.codex/config.toml`).
- `.titan/` creado con `titan.py init-project` ejecutado desde la copia del plugin de Invoxa (desde la copia de este
  repo se niega: «Choose a target application, not the toolkit source or its ancestor»).
- Verificación: `python plugins/titan-factory-codex/scripts/validate.py` → 29 skills, 7 agentes, sin errores.
