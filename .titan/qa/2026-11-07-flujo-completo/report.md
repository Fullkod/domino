# QA: flujo completo de la app web

**Fecha**: 2026-11-07
**Estado**: PASSED (41/41 en la ejecución final)
**Entorno**: `npm run dev` (Next 16, puerto 3001) contra el Supabase online `domino` y la Edge Function `game-action`
desplegada. Chromium headless con perfil de móvil **Pixel 7**, locale `es-ES`. Script de Playwright fuera del repo
(carpeta temporal de la sesión); resultado por paso en `results.json`.

Las cuentas de prueba (superadmin, dueño de club y 4 jugadores) **siguen creadas**. Sus contraseñas están en el
Espacio de Tasknic del proyecto «Dominó», en la nota «Cuentas de prueba». Aquí no hay credenciales.

## Pasos

| # | Paso | Captura |
|---|------|---------|
| 1 | `/` sin sesión redirige a `/login` | `01-login.png` |
| 2 | Login vacío → errores de validación | `02-login-validacion.png` |
| 3 | Login con credenciales malas → «Correo o contraseña incorrectos.» | `03-login-error.png` |
| 4 | Registro con contraseña corta → rechazo | `04-signup-validacion.png` |
| 5 | Registro del superadmin → `/clubs` vacío | `05-clubs-vacio.png` |
| 6 | Rol `platform` (SQL) → aparece el menú Plataforma; un jugador normal no puede entrar en `/platform` | — |
| 7 | Plataforma: crear club con un correo inexistente → error; crearlo con el dueño → OK; emitir 20 000; cuadre correcto | `06-plataforma-club-creado.png` |
| 8 | 4 jugadores se registran; buscar un código inexistente → error; buscar el bueno → solicitar → «Pendiente» | `07-buscar-club.png`, `08-solicitud-pendiente.png` |
| 9 | Dueño: panel del club, aceptar las 4 solicitudes | `09-admin-solicitudes.png` |
| 10 | Asignar 1 000 a cada jugador; el ajuste sin motivo queda bloqueado y con motivo funciona | `10-admin-miembros.png` |
| 11 | Crear mesas «Parejas 100» y «Mano a mano 50»; entrada 3 → rechazada | `11-admin-mesas.png` |
| 12 | Jugadores entran al club, ven su saldo y se sientan | `12-lobby-club.png`, `13-sala-espera.png` |
| 13 | Con 4 «Listo» la partida arranca sola | `14-partida-inicio.png`, `15-partida-en-juego.png` |
| 14 | Partida de parejas jugada **por la interfaz** (tocando fichas, eligiendo lado, pasando) hasta el final | `16`–`19-resultado-parejas-*.png` |
| 15 | Liquidación en BD: bote 400, cargo 20, +190 a cada ganador | — |
| 16 | Levantarse; 1 vs 1 entre dos jugadores hasta el final | `20-1v1-inicio.png`, `21-1v1-resultado.png` |
| 17 | Movimientos del jugador en el club | `22-club-movimientos.png` |
| 18 | Perfil: cambiar nombre, cerrar sesión, volver a entrar | `23-perfil.png` |
| 19 | Caja del club con el informe de 30 días | `24-admin-caja.png` |
| 20 | Plataforma: cuadre correcto tras jugar; un jugador no puede abrir el panel del club | `25-plataforma-cuadre.png` |

Estado final comprobado en BD: tesorería 16 025 (20 000 − 4 000 + 20 + 5), saldos 850 / 1 135 / 900 / 1 090 y
`chip_audit()` sin problemas.

## Fallos encontrados y corregidos

1. **Doble toque en el panel del club** (`/club/admin`): tras aceptar una solicitud, la fila seguía visible hasta la
   recarga y un segundo toque daba «Esa solicitud ya fue revisada». **Fix**: el panel se bloquea (`<fieldset disabled>`)
   desde la acción hasta que llega la recarga.
2. **«Algo salió mal» al terminar una partida** (`/mesa`): un toque justo cuando la partida o la mano acababa devolvía
   `game_not_playing` o `hand_finished` y salía como error genérico. **Fix**: esos códigos y `conflict` no se muestran;
   la mesa solo se recarga.
3. **La mesa ofrecía jugar con un estado viejo** (`/mesa`): entre la respuesta de la jugada y la recarga, la pantalla
   seguía en «Tu turno» con las fichas activas. El servidor lo rechazaba bien (antes de la corrección hubo 217 `400`:
   `not_your_turn`, `tile_not_in_hand`, `cannot_pass_with_legal_move`), pero un humano habría visto un error. **Fix**:
   la mesa queda bloqueada hasta que llega el estado nuevo. En la ejecución final, **0** respuestas de error de
   `game-action`.

Fallos del propio script (no de la app), corregidos: el puerto 3000 estaba ocupado por otra app (Next arrancó en
3001); y el formato `es` no separa los miles en números de 4 cifras («1000», no «1.000»).

## No cubierto

- **APK / Capacitor**: no existe todavía `android/`; no se ha probado dentro del WebView.
- Turno vencido **3 veces seguidas** (abandono) por la interfaz: cubierto en la prueba SQL y en el E2E de la API,
  no aquí.
- Suspender un club o un miembro y sus efectos en el lobby; varios clubes por jugador.
- Reconexión: cerrar la pestaña a mitad de partida y volver.

## Recomendaciones

- Generar `android/` (antes, cambiar el `appId`) y repetir esta QA en un móvil real.
- Tarea programada para los turnos vencidos sin jugadores conectados.
