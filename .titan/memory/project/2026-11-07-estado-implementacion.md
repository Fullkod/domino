# Estado de la implementación (modelo de clubes)

Date: 2026-11-07

Sustituye a `2026-11-06-estado-arranque.md`. Detalle por fase en `.titan/plans/prp-clubes-y-mesas-con-apuesta.md` §10.

- **Supabase `domino` (dcjqxeggkgmbgkzdmpbj)**: 4 migraciones aplicadas (esquema de clubes, índices de FK,
  `platform_find_user`, `save_move`/`save_new_hand`). Edge Function `game-action` desplegada con
  `supabase functions deploy game-action --use-api` (sin Docker). Auth: autoconfirmación de correo activada y
  contraseña mínima 8.
- **Web**: login y registro, perfil, clubes, lobby, mesa en tiempo real, panel de club y panel de plataforma. Tipos
  generados en `src/shared/types/database.ts` (`supabase gen types typescript --project-id …`).
- **Verificado**: prueba E2E real (4 jugadores, partida de 8 manos, liquidación, cuadre, limpieza). Script
  reutilizable fuera del repo; patrón descrito en el PRP.
- **APK (2026-11-07)**: `android/` generado, `appId` neutro `com.dominoclubes.app` (sustituye a `com.fullkod.domino`;
  no cambiarlo más: obliga a reinstalar), icono provisional en `assets/`. Firma de release: clave fuera del repo
  (`~/.android-keys/domino/`), leída de `android/keystore.properties` (ignorado); ruta y contraseña en Tasknic →
  «Firma del APK». `npm run apk:release`. Probado en BlueStacks (Android 9): `.titan/qa/2026-11-07-apk/report.md`.
- **2026-11-07 (tarde)**: migraciones `150000`–`170000` aplicadas (contactos, `retire`, parte de la plataforma, bucket
  `apk`, rol `auditor`, `audit_books`/`audit_movements`). QA 15/15 en `.titan/qa/2026-11-07-contactos-y-supervision/`.
  Ver `2026-11-07-contactos-distribucion-supervision.md`.
- **Falta**: probar en un móvil físico con Android 15+; nombre, marca e icono definitivos; turnos vencidos sin
  clientes (pg_cron); dar el rol `platform` al usuario del operador (SQL `update profiles set role='platform'`).
- **QA con Playwright (2026-11-07): 41/41**, informe en `.titan/qa/2026-11-07-flujo-completo/report.md`.
- **La base tiene datos de prueba**: superadmin (`platform`), dueño de club, 4 jugadores y el «Club de Prueba».
  Contraseñas **solo** en Tasknic, proyecto «Dominó» → Espacio → nota «Cuentas de prueba». Borrarlas antes del piloto.
- Tasknic: proyecto «Dominó» creado (estado preparación); key propia en `.env.local` (`TASKNIC_API_KEY`).
