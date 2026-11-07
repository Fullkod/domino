<!-- titan-factory-codex:start -->
## Titan Factory Codex

- At the start of a relevant project task, read `.titan/memory/MEMORY.md` if present and only its relevant linked entries.
- Use available `tf-` skills for matching work. Skills do not imply connected services or permission for unrelated actions.
- For new compatible apps prefer Next.js + Supabase + Vercel. EasyPanel remains an alternative. Preserve this project's existing stack and the user's explicit choices.
- Keep project decisions in `.titan/memory/`, feature plans in `.titan/plans/` and useful QA evidence in `.titan/qa/`. Read-only tasks must not write state.
- Reuse authorization already given for the task. Delegate only when the user requests or authorizes delegation; do not launch agents merely because role files exist.
- Preserve local code and project knowledge during toolkit updates. Never store credentials in shared memory.
<!-- titan-factory-codex:end -->

<!-- titan-factory-shared:start -->
## Shared agent tooling

- This repository hosts two Titan Factory toolboxes: Codex (`plugins/titan-factory-codex/`, `.codex/`, `.agents/`) and Claude Code (`CLAUDE.md`, `.claude/`). Both use the same 29 `tf-` skills and 7 `tf-` agents; keep the two catalogs in sync when adding, renaming or removing one.
- Third-party skills (`supabase`, `supabase-postgres-best-practices`, `logo-design`) live once in `.agents/skills/`, locked in `skills-lock.json`. `.claude/skills/` only holds thin bridges to them.
- Both share one project memory: `.titan/memory/` (plus `.titan/plans/` and `.titan/qa/`). Never create a second copy such as `.claude/memory/`. Entries may come from either agent; keep the existing format (plain Markdown, `# Title`, one-line index entries appended to `MEMORY.md`).
- Do not modify the other agent's toolbox unless the task is about it.
<!-- titan-factory-shared:end -->

# Dominó — reglas del proyecto (comunes a Claude Code y Codex)

> App Android (APK por enlace, fuera de Play Store) de dominó online por **clubes**: cada club asigna y retira fichas
> a sus miembros; en las mesas (parejas o 1vs1) el ganador se lleva el bote menos un cargo para el club. La app **no
> maneja dinero** (no vende, no compra ni canjea fichas). Fullkod es el proveedor del desarrollo; el dueño legal será el
> operador (traspaso antes del piloto) y la app es **marca blanca**.
> Lógica de negocio completa y decisiones pendientes: `BUSINESS_LOGIC.md`. Plan vigente:
> `.titan/plans/prp-clubes-y-mesas-con-apuesta.md`.

## Al empezar cada sesión

1. Leer `.titan/memory/MEMORY.md` y las entradas relevantes antes de tocar código. `BUSINESS_LOGIC.md` manda sobre
   cualquier nota; el código actual manda sobre una nota vieja.
2. Features complejas: PRP en `.titan/plans/` (plantilla `prp-base.md`) aprobado por Roberto → implementación →
   verificación (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`) → commit.
3. **Nada de push, deploy ni cambios en servicios externos** (Supabase, Vercel, GitHub) sin permiso explícito.
   **No levantar Supabase local con Docker**: las migraciones se escriben como archivos y se aplican al proyecto
   remoto solo cuando Roberto lo autorice.

## Stack

| Capa | Tecnología |
|------|------------|
| App | **Next.js 16 con `output: 'export'`** (estático) + React 19 + TypeScript |
| Estilos | Tailwind CSS 3.4 (no v4: los WebView viejos de Android sin Play Store no lo soportan) |
| **APK** | **Capacitor 8** (`capacitor.config.ts`, `android/`, `webDir: out`). Toda feature debe funcionar dentro del WebView |
| BD / Auth / Realtime | **Supabase** (Postgres + RLS, Auth, Realtime `postgres_changes`) |
| Lógica de juego | Edge Function `game-action` (Deno) con el motor puro de `supabase/functions/_shared/domino/` |
| Validación | Zod |
| Pruebas | Vitest (`npm test`) |

## Reglas de código

- **Capacitor siempre presente**: nada que dependa de servidor Next (sin middleware, route handlers, Server Actions,
  `next/headers`, `next/image` optimizado ni rutas dinámicas sin `generateStaticParams`). Después de cambiar la web:
  `npm run cap:sync`. Probar en el APK, no solo en el navegador.
- **El servidor es la única autoridad del juego.** El cliente solo envía intenciones (jugar ficha/lado, pasar). Nunca
  confiar en el cliente para validar jugadas, turnos, puntos ni saldos.
- **Nunca mandar al cliente las fichas de otro jugador.** Las manos viven en `hand_tiles` con RLS por asiento.
- **El motor (`_shared/domino/`) es puro**: sin dependencias, sin I/O, imports relativos con extensión `.ts` (los
  necesita Deno). La app lo importa como `@engine/*`. Todo cambio de reglas va con prueba en `engine.test.ts`.
- **Fichas**: todo cambio de saldo pasa por `public._post_chips` (libro de doble partida y solo inserción
  `chip_ledger`). Nunca `update` directo de saldos. Las correcciones son movimientos contrarios. El cuadre por club
  (`chip_audit`) debe dar siempre 0 diferencias.
- **Nunca** añadir pagos dentro de la app, canje de fichas por dinero ni transferencias entre jugadores
  (BUSINESS_LOGIC §1).
- **Marca blanca**: nada de «Fullkod» en la UI, el APK ni la web pública; usar `src/shared/constants/brand.ts`.
- Cambios de esquema como migraciones en `supabase/migrations/`, con RLS en toda tabla.
- **Toda función nueva en `public` declara sus grants** (`revoke all ... from public, anon, authenticated` y luego
  `grant execute` solo a quien la necesite). Supabase da EXECUTE a `anon` por defecto. Si la llama un usuario,
  comprueba dentro quién es (`auth.uid()`, `is_platform()`, `is_club_admin(club)`).
- Solo la anon key en el cliente. Nunca secretos en código, memoria ni variables `NEXT_PUBLIC_*`.
- La clave de firma del APK (`*.jks`/`*.keystore`) nunca entra al repo.
- Código, comentarios y commits en inglés; textos de la interfaz en español.
- Nuevo `any` prohibido (usar `unknown`).
- Commits: `feat:` / `fix:` / `refactor:` / `chore:` / `docs:`.

## Comandos

```
npm run dev          # Next en desarrollo (webpack)
npm test             # Vitest (motor de reglas)
npm run lint
npm run typecheck
npm run build        # export estático a out/
npm run cap:sync     # build + copiar a android/
npm run apk:release  # build + sync + APK firmado (android/keystore.properties, clave fuera del repo)
npm run apk:debug    # igual, APK de depuración
npm run cap:android  # abrir Android Studio (opcional)
```

## Auto-blindaje

Error → fix → documentar. Errores de una feature en su PRP (`.titan/plans/`); patrones recurrentes en
`.titan/memory/reference/`; reglas críticas para todo el proyecto en este archivo.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
