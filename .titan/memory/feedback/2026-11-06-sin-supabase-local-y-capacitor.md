# Sin Supabase local con Docker; Capacitor siempre presente

Date: 2026-11-06
Fuente: Roberto, durante el arranque.

- **No crear Supabase local con Docker.** Las migraciones se escriben como archivos y se aplican al proyecto remoto
  solo con su permiso. **Por qué:** lo pidió explícitamente al ver que se iba a levantar Docker.
  **Cómo aplicar:** nada de `supabase start`, `db reset` ni arrancar Docker Desktop en este repo.
- **«OJO con Capacitor, no se nos puede olvidar».** Toda decisión técnica debe funcionar dentro del APK.
  **Cómo aplicar:** nada que requiera servidor Next; tras cambios web, `npm run cap:sync` y probar en el APK.
