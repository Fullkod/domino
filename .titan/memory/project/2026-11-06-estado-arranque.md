# Estado del arranque (qué hay y qué falta verificar)

> **SUPERADO el 2026-11-07** por `2026-11-07-estado-implementacion.md`.

Date: 2026-11-06

Hecho (todo sin commit; repo `Fullkod/domino` estaba vacío):
- Starter Next.js/Supabase de la Titan Factory (`titan.py scaffold-app`, generado en temporal y copiado porque el repo
  ya tenía `.git`). Adaptado a export estático: `next.config.ts` con `output: 'export'`, sin `src/lib/supabase/server.ts`
  ni `@supabase/ssr`; cliente solo de navegador.
- Capacitor: `capacitor.config.ts` (`com.fullkod.domino`, `webDir: out`), dependencias y scripts `cap:sync`/`cap:android`.
  **Falta** `npx cap add android` (necesita `npm run build` antes) → carpeta `android/`.
- `BUSINESS_LOGIC.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.local.example`.
- Migración `supabase/migrations/20261106120000_initial_schema.sql`: perfiles/roles, ajustes, wallets + libro de solo
  inserción, recargas, salas/mesas/asientos, partidas/manos/fichas privadas/jugadas, RPCs (jugador, admin, servidor) con
  grants explícitos, RLS y publicación Realtime. **No aplicada en ningún sitio**: no hay proyecto Supabase todavía.
- Motor puro en `supabase/functions/_shared/domino/` (`types`, `tiles`, `rules`, `index`) y `engine.test.ts`.

Sin verificar (se paró antes): `npm install` se lanzó, pero no se corrieron `npm test`, `lint`, `typecheck` ni `build`.
La migración no se ha probado contra Postgres. Primer paso de la próxima sesión: correr esas cuatro verificaciones.

Ojo conocido: el trigger que impide modificar `credit_ledger` hace que borrar un usuario de Auth falle (cascade).
Es intencional (se suspende, no se borra), pero hay que tenerlo presente.

Siguiente según `BUSINESS_LOGIC.md` §10: auth → créditos (recarga/aprobación) → lobby → Edge Function `game-action`
con Realtime y tiempos de turno → informe de comisión → APK firmado y landing.
Sin `TASKNIC_API_KEY` propia todavía (no usar la de otro repo).
