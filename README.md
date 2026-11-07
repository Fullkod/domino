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

---

Desarrollado por [Fullkod](https://fullkod.com). Código propietario; todos los derechos reservados.
