# QA: contactos, liquidación operador ↔ club y Supervisión

**Fecha**: 2026-11-07
**Estado**: PASSED (15/15)
**Entorno**: `npm run dev` (puerto 3001) contra el Supabase online `domino`, migraciones `20261107150000`–`170000`
aplicadas. Chromium headless, perfil Pixel 7, `es-ES`. Script fuera del repo; resultado por paso en `results.json`.
Cuentas: las de «Cuentas de prueba» en Tasknic, más la nueva **Supervisión** (`supervision.domino@example.com`, rol
`auditor`, contraseña en la misma nota).

## Pasos

| # | Paso | Captura |
|---|------|---------|
| 1 | Plataforma: añade su contacto; un teléfono inválido se rechaza | — |
| 2 | Plataforma: se ve «Versión mínima de la app» | — |
| 3 | Plataforma → «Más opciones» del club: parte de la plataforma 10 %, devolver 5 fichas de la tesorería con motivo | `01-plataforma.png` |
| 4 | Dueño del club: pestaña «Contacto», añade el teléfono del club | `02-club-contactos.png` |
| 5 | Dueño: asignar más de lo que hay en tesorería → «Confirmar» se cambia por «Contactar a la plataforma»; WhatsApp al número del operador con el código del club | `03-club-contactar-plataforma.png` |
| 6 | Jugador Tres (900 fichas) en una mesa de 5 000 → «Contactar al club» en lugar de «Sentarse»; el mensaje lleva su nombre y no dice «comprar» ni «recargar» | `04-jugador-contactar-club.png` |
| 7 | Las mesas que sí alcanzan siguen con «Sentarse» | — |
| 8 | RLS: el jugador ve los contactos de su club y no los de la plataforma; no puede crear contactos | — |
| 9 | RLS: Supervisión no ve ningún contacto; no puede emitir ni devolver fichas | — |
| 10 | Un jugador no puede llamar a `audit_books` | — |
| 11 | Supervisión: total de la plataforma, libros por club y filtro «Plataforma ↔ clubes» (sale la devolución de QA) | `05-supervision.png` |
| 12 | Supervisión no ve el menú Plataforma | — |
| 13 | `chip_audit()` sin problemas | — |

Limpieza: se borraron la mesa de prueba y los contactos, y la parte de la plataforma volvió a 0 %. La devolución de 5
fichas queda en el libro (no se borra nada): tesorería del club de prueba 16 080 → 16 075.

## Fallos

- Ninguno de la app. Del script: tras guardar, el panel «Más opciones» sigue abierto (el botón pasa a «Ocultar
  opciones»); y la primera captura de Supervisión se tomó antes de que llegara el filtro (repetida esperando la recarga).

## No cubierto

- La sala de espera de la mesa con saldo insuficiente («Listo» → «Contactar al club»): mismo componente y mismo
  control del servidor (`set_ready` → `insufficient_chips`), sin prueba de UI.
- Abrir WhatsApp de verdad desde el APK (en BlueStacks no hay WhatsApp; se comprobó el enlace `wa.me`).
- El aviso de actualización en el APK: se prueba al publicar con el GitHub Action.
