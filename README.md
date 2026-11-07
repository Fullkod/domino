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

```
npm run cap:sync      # build estático + copia a android/
npm run cap:android   # abre Android Studio → Build → Generate Signed APK
```

Firma siempre con la misma clave. Guárdala fuera del repo y con copia de seguridad: sin ella no se pueden
publicar actualizaciones.

---

Desarrollado por [Fullkod](https://fullkod.com). Código propietario; todos los derechos reservados.
