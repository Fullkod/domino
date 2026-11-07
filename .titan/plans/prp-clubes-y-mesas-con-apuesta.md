# PRP: clubes, fichas de club y mesas con apuesta

Fecha: 2026-11-07 · Estado: **aprobado (D1 = b, D2 = b, D3 = sí); en curso, fases 1–3**
Origen: pedido del operador (Daniel, WhatsApp 2026-11-07): entradas de 5 a 10 500 fichas, «apuestas lo que quieras
contra el otro jugador», «el ganador se lleva las fichas». Referencia de mecánicas: Domino Real
(`.titan/memory/reference/2026-11-07-domino-real-referencia.md`). Solo se toman las mecánicas, no la marca ni el aspecto.

## 1. Objetivo y valor

Sustituir el modelo actual (créditos que se consumen y no se ganan) por un **modelo de clubes**:

- La plataforma ofrece el software: clubes, mesas, motor de juego y libro de fichas.
- Cada **club** reparte **fichas de club** a sus miembros y las recupera. El dinero, si lo hay, se mueve entre club y
  jugador **fuera de la app**. La app no vende, no compra y no canjea fichas.
- En las mesas, los jugadores ponen fichas y **el ganador se las lleva**, menos un **cargo** por mesa.

**Requisitos** (los pide el operador): mesas con apuesta, entradas configurables de 5 a 10 500 y ganador que cobra.
**Supuestos** (de la referencia, se confirman con Daniel en §8): clubes con ID, tipos Cash/All-In, 1vs1, cargo por mesa.

### Lo que este cambio supone

Esto **anula la premisa «no es de apuestas»** de `BUSINESS_LOGIC.md` §1 y la regla de `AGENTS.md` «nunca premios en
créditos sin revisión legal». Si un club cobra dinero por las fichas y las recompra, hay apuesta con dinero real,
aunque la app no tenga botón de retiro. El modelo de clubes **reparte la responsabilidad**, pero no la elimina: quien
opera la plataforma y cobra un cargo de las mesas participa en el negocio. Por eso §2 deja abierta la decisión D1,
que no es técnica.

## 2. Decisiones que bloquean (Roberto)

| # | Decisión | Opciones | Por defecto en el plan |
|---|----------|----------|------------------------|
| **D1** | Quién es el **dueño legal** de la plataforma y de las cuentas (Supabase, dominio, firma del APK, distribución) | (a) Fullkod · (b) el operador o una entidad suya; Fullkod como proveedor de desarrollo | **(b)**. Se construye bajo las cuentas actuales y se **traspasa** antes del piloto |
| **D2** | Cómo cobra **Fullkod** | (a) % del cargo de las mesas · (b) tarifa fija o licencia mensual · (c) desarrollo + mantenimiento por horas | **(b)**: no depende de lo que se juegue. El esquema deja un `platform_share` a 0 por si se elige (a) |
| **D3** | **Revisión legal** en el país donde se juega | Sí, antes del piloto · No | Recomendado: sí. Sin ella, el riesgo lo asume quien sea el dueño según D1 |

Hasta que estén D1 y D2, las fases 1–3 de §6 se pueden hacer (son neutras). La fase 8 (traspaso y marca) depende de D1.

## 3. Alcance

**Incluido (v1)**
- Clubes: crear (solo `platform`), unirse por ID con aprobación, roles dentro del club, suspender miembros.
- Fichas de club: saldo por club y jugador; el club asigna y retira; libro de solo inserción.
- Mesas por club: **All-In** (el bote, menos el cargo, para el ganador) en **parejas** (4) y **1vs1** (2).
- Juegos: doble 9 y doble 6. Cargo por mesa calculado en el servidor.
- Informes: movimientos del club, cargos cobrados por periodo y reparto entre club y plataforma.
- **Marca blanca**: nombre, `appId`, iconos y textos de la app configurables. Ninguna mención a Fullkod en el APK ni en
  la web pública.

**Fase 2 (después de confirmar con Daniel)**: mesas **Cash** (buy-in con salida a mitad de partida), mesas
individuales de 3–4 jugadores, **Pintintín**, mesas **privadas**, jerarquía de agentes con reparto del cargo.

**Fuera de alcance**: pagos dentro de la app, canje de fichas por dinero en la app, transferencias entre jugadores,
tienda de cosméticos y monedas, iOS nativo, Play Store.

## 4. Comportamiento esperado y aceptación

### Recorrido principal
1. El jugador se registra y busca un club por su **ID** → solicitud `pending` → el admin del club la aprueba.
2. El admin del club le **asigna fichas**: la tesorería del club baja y el saldo del jugador en ese club sube. El pago,
   si lo hay, ocurre fuera.
3. El jugador ve las mesas del club (filtros: juego, formato, entrada), se sienta y marca **listo**.
4. Con la mesa completa y todos listos, el servidor **bloquea la entrada** de cada jugador en una transacción: si a
   alguno le falta saldo, no se cobra a nadie.
5. Se juega la partida (motor actual, servidor autoritativo).
6. Al terminar: bote = Σ entradas. Cargo = `round(bote × rake_pct)` (con tope opcional). El ganador o la pareja
   ganadora reciben `bote − cargo`, repartido a partes iguales en parejas; el resto va al primer asiento ganador. El
   cargo va a la tesorería del club (y la parte de plataforma, si D2 = a).
7. El admin del club puede **retirar fichas** a un jugador, que vuelven a la tesorería.

### Fallos y bordes
- Saldo insuficiente al marcar listo → se rechaza; al cobrar → no se cobra a nadie y se quita el «listo».
- Abandono (3 turnos vencidos): pierde su entrada. En la primera mano se anula y se devuelve a los demás; después
  pierde su lado (igual que la regla actual §4.2).
- Partida anulada por un admin → se devuelven todas las entradas y el cargo queda en 0.
- Mano nula o empate → no cambia nada; la partida sigue hasta `target_points`.
- Jugador suspendido en el club → no puede sentarse; su saldo se congela (no se borra).

### Criterios medibles
1. En todo momento: Σ saldos de jugadores del club + tesorería del club + cargos de plataforma = Σ fichas emitidas al
   club. Se verifica con una consulta de cuadre que debe devolver 0 filas.
2. Una partida cobra la entrada una sola vez y paga el bote una sola vez (idempotente por `game_id`).
3. Ningún saldo queda negativo; ningún movimiento se edita ni se borra.
4. Un jugador no ve las fichas de otros, ni saldos ni movimientos de otros clubes (RLS).
5. Un admin de un club no puede ver ni tocar otro club.
6. El APK y la web pública no contienen «Fullkod» (`grep` sobre `out/` y `android/app/src`).

### Acceso
| Rol | Alcance |
|-----|---------|
| `platform` | Crea clubes, emite fichas a la tesorería de un club, ve informes globales. No juega con saldo de jugadores |
| `club_owner` / `club_admin` | Aprueba miembros, asigna y retira fichas, crea mesas y cargos de su club, ve sus informes |
| `player` | Se une a clubes, ve su saldo por club, juega |

## 5. Arquitectura

La migración `20261106120000_initial_schema.sql` **no está aplicada en ningún sitio**, así que se **reescribe** en
lugar de añadir otra encima.

### Cambios de esquema
- `profiles.role`: queda en `player | platform`. Los roles de club van en `club_members`.
- **Nuevas**:
  - `clubs` (`code` público corto, `name`, `owner_id`, `status`, `rake_pct`, `rake_cap`, `platform_share_pct`
    default 0).
  - `club_members` (`club_id`, `user_id`, `role` owner/admin/player, `status` pending/active/suspended).
  - `club_wallets` (saldo por club y usuario, `check (balance >= 0)`).
  - `club_treasury` (saldo del club).
- `credit_ledger` → **`chip_ledger`** con `club_id` y doble partida: cada operación inserta las dos patas (cuenta
  origen y cuenta destino) en la misma transacción. Tipos: `issue` (plataforma → tesorería), `assign` (tesorería →
  jugador), `withdraw` (jugador → tesorería), `buy_in` (jugador → bote), `payout` (bote → jugador), `rake` (bote →
  tesorería / plataforma), `refund` (bote → jugador), `adjustment`.
- `_apply_credit` → `_post_chips(club, from_account, to_account, amount, kind, game, actor, note)`. Sigue siendo la
  **única** puerta de cambio de saldo.
- `rooms` → `table_templates` por club (`game_type` double9/double6, `format` pairs/1v1, `mode` all_in, `entry`,
  `target_points`, `turn_seconds`). `game_tables` cuelga del club.
- `games`: `pot`, `rake`, `platform_rake`, `payout_done boolean`. Se quitan `platform_fee_*` (pasan a ser el reparto
  del cargo).
- Se eliminan `topup_requests` y `app_settings.credit_price` / `currency_label`: la app no conoce dinero.
- RLS en todo: el jugador solo ve sus filas y las de clubes donde es miembro activo; los admins del club, su club.
  Todas las funciones nuevas con `revoke all … from public, anon, authenticated` y `grant` explícito.

### Motor (`supabase/functions/_shared/domino/`)
- Generalizar de 4 asientos fijos a **2 o 4** (1vs1 y parejas). `Seat`, `SEATS`, `teamOf` y el reparto pasan a
  depender de `RuleConfig.players`. En doble 6 con 2 jugadores, 7 fichas cada uno, sin robar
  **[DECIDIR con Daniel: ¿se roba del pozo en 1vs1?]**.
- Pruebas nuevas en `engine.test.ts` para 1vs1 (salida, tranque, puntuación).

### Edge Function `game-action`
Sin cambios de contrato: intenciones jugar/pasar. Se añade la **liquidación al terminar** la partida (llamada a una
RPC `settle_game(game_id)` idempotente).

### Marca blanca
- `capacitor.config.ts` (`appId`, `appName`) y `package.json` `name` desde una constante de marca
  (`src/shared/constants/brand.ts`). Se quita `com.fullkod.*`.
- Se quitan las menciones a Fullkod de la UI, la landing y el pie del README público. Los documentos internos
  (`BUSINESS_LOGIC.md`, `.titan/`) no van en el APK y siguen igual hasta el traspaso.
- Lo que la marca blanca **no** resuelve (depende de D1): el repo `Fullkod/domino`, la organización «Fullkod» de
  Supabase, la cuenta que firma el APK y la del dominio. Se resuelven con el traspaso de la fase 8.

## 6. Fases

| # | Resultado | Verificación |
|---|-----------|--------------|
| 1 | `BUSINESS_LOGIC.md` y `AGENTS.md` reescritos con el modelo de clubes y D1–D3 | Revisión de Roberto |
| 2 | Motor con 1vs1 y parejas | `npm test` (nuevas pruebas), `npm run typecheck` |
| 3 | Migración reescrita: clubes, fichas de doble partida, mesas, liquidación | Revisión del SQL; se aplica al proyecto `domino` **con permiso**; consultas de cuadre y de RLS con usuarios de prueba |
| 4 | Auth + perfil | `npm run build`, prueba en navegador y en el APK |
| 5 | Clubes: buscar por ID, solicitud, aprobación, asignar y retirar fichas | Playwright + cuadre del libro |
| 6 | Lobby y mesas: crear mesa, sentarse, listo, cobro atómico | Pruebas con 2 y 4 sesiones |
| 7 | Partida en tiempo real + liquidación + turnos vencidos | 4 dispositivos; cuadre tras N partidas |
| 8 | Marca blanca + traspaso de cuentas según D1 + APK firmado | `grep -ri fullkod out android/app/src` vacío; APK instalado en un móvil |

Cada fase empieza revisando el estado real del código. Las fases 1–3 se pueden hacer antes de D1/D2.

## 7. Verificación y despliegue

- Siempre: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, y `npm run cap:sync` cuando se toque la web.
- BD: nada de Docker local. La migración se aplica al proyecto remoto `domino` (`dcjqxeggkgmbgkzdmpbj`) solo con
  permiso de Roberto. Mientras no haya datos reales, se puede rehacer el proyecto si hiciera falta.
- Antes del piloto: consulta de cuadre del libro, prueba de RLS con un usuario de cada rol y revisión de grants
  (`anon` sin EXECUTE en nada sensible).

## 8. Preguntas para Daniel (no bloquean las fases 1–3)

1. **Cash** frente a **All-In**: ¿en Cash se paga por mano o por punto? ¿Uno se puede levantar a mitad de partida con
   lo que lleva?
2. El número entre paréntesis («10 500 (500)»), ¿es el cargo por partida? ¿Cuánto es normalmente (% o fijo)?
3. ¿En 1vs1 se roba del pozo o no?
4. ¿Los clubes los abre él solo, o habrá varios clubes de distintos dueños?
5. ¿Quién reparte las fichas: el dueño del club o también «agentes» por debajo?
6. ¿A cuántos puntos se juega normalmente y cuánto dura el turno?

## 9. Decisiones y lecciones

- 2026-11-07: el operador pide mesas con apuesta. Roberto decide seguir adelante y buscar una variante en la que
  Fullkod no aparezca. Se toma como modelo el de clubes (Domino Real). El modelo anterior sin apuestas queda
  **superado** al aprobar este PRP (`.titan/memory/project/2026-11-06-producto-y-decisiones.md`).
- La migración inicial nunca se aplicó: se reescribe en lugar de migrar.
- 2026-11-07: Roberto aprueba el PRP con los valores por defecto de D1, D2 y D3.
- 2026-11-07: una abogada señala el **Código Penal (Gaceta Oficial, 1-9-2022), art. 281 «Juegos ilícitos»**: 1–3 años
  para el «banquero, colector, apuntador o promotor», y 3–8 años si intervienen dos o más personas. Define juego
  ilícito como el que no tiene autorización, con «interés patrimonial de cualquier tipo», en el que la ganancia o la
  pérdida dependen «de la suerte o de otros factores ajenos a la voluntad». Se recomendó pasar al modelo sin bote
  (la entrada se consume y va al club gane quien gane). **Roberto decide mantener el modelo con bote por ahora** y
  consultarlo con la abogada; la consulta preparada está en `.titan/plans/consulta-legal-modelo-clubes.md`.
  **No se pone en marcha con jugadores reales sin su respuesta.** Pasar al modelo sin bote = en `finish_game`,
  mandar el bote entero a la tesorería (`rake`) en lugar de pagar al ganador.

## 10. Estado

**En curso** (2026-11-07). Hecho y verificado:

| Fase | Estado | Evidencia |
|------|--------|-----------|
| 1 Documentos | Hecha | `BUSINESS_LOGIC.md`, `AGENTS.md` |
| 2 Motor 1vs1 + parejas | Hecha | 25 pruebas en `engine.test.ts` |
| 3 Esquema | **Aplicado al remoto** | 4 migraciones (`supabase/migrations/`). Prueba SQL con rollback: club, fichas, buy-in, liquidación 400→20 de cargo y 190+190, abandono en la 1.ª mano, cuadre 0, RLS y grants |
| 4 Auth + perfil | Hecha (web) | `/login`, `/signup`, `/perfil`. Auth: confirmación por correo **desactivada** (no hay SMTP propio), contraseña mínima 8 |
| 5 Clubes | Hecha (web) | `/clubs` (buscar por código, solicitar), `/club/admin` (solicitudes, miembros, asignar, retirar y ajustar, mesas, cargo, informe 30 días), `/platform` (crear club, emitir, suspender, cuadre) |
| 6 Lobby y partida | Hecha (web) | `/club` (mesas, sentarse), `/mesa` (sala de espera, inicio automático, tablero, turnos, pasar, resultado). Edge Function `game-action` desplegada. E2E real con 4 usuarios: partida de 8 manos, turno vencido, jugada fuera de turno rechazada, cuadre 0, limpieza total |

| QA web | **41/41** | Playwright, móvil Pixel 7, contra Supabase online: `.titan/qa/2026-11-07-flujo-completo/report.md`. 3 fallos de UI encontrados y corregidos |

**Pendiente**
- Prueba en el APK. Falta `npx cap add android`; nunca se ha generado la carpeta `android/`.
- `capacitor.config.ts` sigue con `appId: com.fullkod.domino`: **hay que cambiarlo antes del primer APK** (marca blanca; el `appId` no se puede cambiar después sin perder las actualizaciones).
- Turnos vencidos: los resuelve el `tick` que mandan los clientes de la mesa. Si se desconectan todos, la mesa queda parada hasta que alguien vuelva. Mejora: tarea programada (pg_cron + llamada a la función).
- Fase 7 (informes de plataforma más completos) y fase 8 (marca blanca, traspaso de cuentas, APK firmado).
- Bloqueo para el piloto: la respuesta legal (D3).

### Aprendizajes

### 2026-11-07: el lint de React rechaza `load()` dentro de `useEffect`
- **Error**: `react-hooks/set-state-in-effect` al llamar a una función que hace `setState` desde un efecto.
- **Fix**: un contador `version` para recargar; el efecto pide los datos y hace `setState` en el `.then`, con una
  bandera `current` para descartar resultados viejos. Para inicializar formularios, un componente hijo con `key`.
- **Aplicar en**: toda pantalla que cargue datos de Supabase.

### 2026-11-07: borrar datos de prueba choca con el libro de solo inserción
- **Error**: `chip_ledger` no deja borrar (trigger), así que no se puede borrar un usuario con movimientos.
- **Fix**: en limpiezas de pruebas, en una transacción: `disable trigger` → borrar → `enable trigger`. **Nunca** con
  datos reales.

### 2026-11-07: la mesa ofrecía jugadas con el estado viejo
- **Error**: entre la respuesta de `game-action` y la recarga, la UI seguía en «Tu turno» y se podía volver a tocar
  (el servidor lo rechazaba, pero el jugador veía un error).
- **Fix**: `busy` se activa con la acción y solo se apaga cuando llega la vista recargada. Los códigos que significan
  «la mesa ya cambió» (`game_not_playing`, `hand_finished`, `conflict`) no se muestran.
- **Aplicar en**: toda pantalla que actúe y luego recargue (panel de club: `<fieldset disabled={busy}>`).

### 2026-11-07: `next dev` reescribe `AGENTS.md`
- Next 16 añade un bloque `nextjs-agent-rules` a `AGENTS.md` en cada `next dev`. Es inofensivo: se commitea.
