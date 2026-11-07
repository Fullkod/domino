# QA: APK de release en Android

**Fecha**: 2026-11-07
**Estado**: PASSED
**APK**: `app-release.apk` (3,5 MB), `com.dominoclubes.app` 1.0 (versionCode 1), firmado con la clave de release
(SHA-256 `8C:98:10:56:…:44:05`), compileSdk/targetSdk 36, minSdk 24.
**Dispositivo**: BlueStacks 5 (Android 9, WebView = Chrome 138), 1600×900, contra el Supabase online `domino`.
Instalado y manejado por `adb` (toques y capturas). El rival en la partida fue un script con la cuenta de Jugador Dos
que juega por la misma API que la app (`game-action`).

## Pasos

| # | Paso | Resultado | Captura |
|---|------|-----------|---------|
| 1 | Icono provisional (ficha 3-5 sobre verde) | OK | `00-icono.png` |
| 2 | Instalar el APK firmado y abrir | Abre en el login, sin «Fullkod» en ningún sitio (`grep` sobre `out/`, `android/app/src` y el APK: 0) | `01-login.png` |
| 3 | Login de Jugador Uno | Entra; ve su club y su saldo | `02-clubes.png` |
| 4 | Sala del club | Mesas, filtros y movimientos | `03-lobby.png` |
| 5 | Sentarse en «Mano a mano 50»; el rival se sienta y marca «Listo» | Aparece **en tiempo real** (Realtime funciona en el WebView) | `04-sala-realtime.png` |
| 6 | «Listo» → la partida arranca sola | «Tu turno», sale el 6-6 obligado | `05-partida-inicio.png` |
| 7 | Jugar 6-6 y 1-6 tocando las fichas | Las jugadas entran y el rival responde en vivo | `06-partida-jugadas.png` |
| 8 | Dejar vencer 3 turnos seguidos | «Partida anulada por abandono en la primera mano». En BD: partida `cancelled`, Jugador Dos con la entrada devuelta, Jugador Uno pierde los 50 (van a la tesorería), `chip_audit()` sin problemas | `07-abandono.png` |
| 9 | Reinstalar encima un APK nuevo con la misma firma | Se instala sin desinstalar y **se conserva la sesión** | `08-barra-corregida.png` |
| 10 | Botón «atrás» de Android dentro del club | Vuelve a «Mis clubes»; la app no se cierra | — |

## Fallo encontrado y corregido

- **Barra de estado blanca con iconos blancos** (Android 9): el tema `AppTheme.NoActionBar` heredaba los colores
  claros. **Fix**: `android/app/src/main/res/values/colors.xml` (`appBackground` #0a0a0a) y en `styles.xml` la
  barra de estado, la de navegación y el fondo de ventana con ese color.

## No cubierto

- Un móvil físico y Android 15+ (edge-to-edge). Capacitor 8 lo resuelve con `SystemBars` (márgenes nativos); falta
  verlo en un móvil real.
- Una partida completa jugada solo desde el APK (sí se hizo en web, `../2026-11-07-flujo-completo/`).
- Pantallas en vertical de móvil pequeño en el APK (BlueStacks va en horizontal; la web sí se probó con perfil Pixel 7).
