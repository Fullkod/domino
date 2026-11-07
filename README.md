# Dominó

Dominó online para Android por clubes: mesas en parejas o 1vs1 con fichas de club.
Reglas de negocio: [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md). Reglas para agentes y stack: [AGENTS.md](AGENTS.md).

## Estructura

```
src/                                 App Next.js (export estático → out/)
supabase/migrations/                 Esquema, RLS, libro de fichas y RPCs
supabase/functions/_shared/domino/   Motor de reglas puro (servidor y app), con pruebas
capacitor.config.ts                  Empaquetado del APK (webDir: out)
android/                             Proyecto Android generado por Capacitor
.titan/                              Memoria, planes y QA compartidos por Claude Code y Codex
```

## Desarrollo

Requiere Node 20.19+, 22.13+ o 24+.

```
npm install
cp .env.local.example .env.local     # URL y anon key del proyecto Supabase
npm run dev
npm test
```

## APK

Requisitos: JDK 21 (`JAVA_HOME`) y Android SDK con la plataforma 36 (`ANDROID_HOME`). No hace falta Android Studio.

```
npm run apk:debug     # build estático + cap sync + APK de depuración
npm run apk:release   # igual, firmado: android/app/build/outputs/apk/release/app-release.apk
npm run assets:icons  # regenera iconos y splash desde assets/ (icono provisional hasta tener marca)
npm run cap:android   # abre Android Studio, si se prefiere
```

La firma de release se lee de `android/keystore.properties` (ignorado por git: `storeFile`, `storePassword`,
`keyAlias`, `keyPassword`). La clave vive fuera del repo; dónde está y su contraseña, en el Espacio de Tasknic del
proyecto. Firma siempre con la misma clave y el mismo `appId` (`com.dominoclubes.app`): si cambia cualquiera de los
dos, el APK nuevo no se instala encima del anterior.

### Publicar una versión (GitHub Action)

La versión que reciben los jugadores **no se compila en local**: GitHub → Actions → **APK release** → *Run workflow*
(`.github/workflows/apk-release.yml`). El Action compila y firma el APK, y lo sube al bucket público `apk` de
Supabase Storage:

- `apk/domino.apk`: siempre la última versión (se sobrescribe; no se acumulan versiones viejas). Es el enlace para
  repartir: `<SUPABASE_URL>/storage/v1/object/public/apk/domino.apk`.
- `apk/latest.json`: `versionCode`, `versionName` y enlace. La app lo consulta al abrir y al volver de segundo plano y
  muestra «Hay una versión nueva» (`src/features/app-update/`).

El `versionCode` es el publicado + 1, y la versión se llama `<major.minor de package.json>.<versionCode>`. Marcando
«Obligar a actualizar» al lanzarlo, esa versión pasa a ser la mínima (`app_settings.min_app_version`) y las
anteriores quedan bloqueadas; también se cambia en Plataforma.

Configuración del repo: variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; secretos
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` y
`SUPABASE_SERVICE_ROLE_KEY`. Si el repo cambia de dueño (traspaso al operador), hay que volver a ponerlos.

---

Desarrollado por [Fullkod](https://fullkod.com). Código propietario; todos los derechos reservados.
