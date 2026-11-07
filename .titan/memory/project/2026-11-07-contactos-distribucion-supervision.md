# Contactos, operador ↔ clubes de terceros, APK por GitHub Action y Supervisión

Date: 2026-11-07
Fuente: Roberto, en sesión. Detalle de negocio en `BUSINESS_LOGIC.md` §2.1, §3.3 y §7.

- **Recargas = «Contactar»**: nunca un botón de comprar ni recargar. Si a un jugador no le alcanza la entrada, «Sentarse»
  o «Listo» pasan a «Contactar al club». Si a un club no le alcanza la tesorería para asignar, pasa a «Contactar a la
  plataforma». Contactos en la tabla `contacts` (`club_id` null = del operador), hasta 5, WhatsApp (`wa.me`) y llamada,
  con un mensaje neutro (nombre, club, código; sin cantidades). Roberto lo activó ya, sin esperar a la abogada.
- **Habrá clubes de otros dueños.** El operador: emite (`issue`), devuelve (`retire`, con nota, desde tesorería o desde
  la cuenta `platform` del club) y fija `platform_share_pct` por club (0 en los propios). Liquidación siempre fuera.
- **Supervisión** (`profiles.role = 'auditor'`, por SQL): solo lectura de los libros de fichas de la plataforma y de
  todos los clubes en `/supervision` (`audit_books`, `audit_movements`, `chip_audit`). Sin contactos ni datos
  personales. Cuenta real: `domino@fullkod.com` (Fullkod), contraseña en la nota de Tasknic «Cuentas de prueba»;
  **no borrarla** con las cuentas de prueba antes del piloto.
- **Enlace de descarga** del APK en la nota de Tasknic «Descarga del APK (enlace para repartir)».
- **APK**: se publica con el GitHub Action «APK release» (no en local; el JDK y el SDK locales se quedan solo para
  pruebas). Sube `domino.apk` (solo la última) y `latest.json` al bucket público `apk`. La app avisa de la versión
  nueva (`UpdateGate`) y bloquea por debajo de `min_app_version`. Secretos en GitHub (repo privado `Fullkod/domino`).
- **Legal**: términos y privacidad provisionales en la app (`/terminos`, texto en `src/shared/constants/legal.ts`,
  `reviewed: false`). La consulta ampliada para la abogada (cobro de Fullkod por comisión fuera de la app, despliegue en
  cuentas de Fullkod, marca ligada a Fullkod) está en `private/legal/` (**ignorado por git**, HTML + PDF), no en el repo.
