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
- **Falta**: QA visual, `npx cap add android` y APK; cambiar `appId` (sigue `com.fullkod.domino`) **antes del primer
  APK**; resolver los turnos vencidos sin clientes (pg_cron); dar el rol `platform` al usuario del operador (SQL
  `update profiles set role='platform'`).
- **QA con Playwright (2026-11-07): 41/41**, informe en `.titan/qa/2026-11-07-flujo-completo/report.md`.
- **La base tiene datos de prueba**: superadmin (`platform`), dueño de club, 4 jugadores y el «Club de Prueba».
  Contraseñas **solo** en Tasknic, proyecto «Dominó» → Espacio → nota «Cuentas de prueba». Borrarlas antes del piloto.
- Tasknic: proyecto «Dominó» creado (estado preparación); key propia en `.env.local` (`TASKNIC_API_KEY`).
