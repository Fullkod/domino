# Dominó online — lógica de negocio

> Plataforma de dominó online desarrollada por **Fullkod** como proveedor, para un operador externo (el «operador»).
> Fuente de verdad de las reglas de negocio. Si el código y este documento discrepan, se corrige uno de los dos en el
> mismo cambio. Las decisiones pendientes están marcadas **[DECIDIR]** con el valor por defecto que se implementa.
> Plan vigente: `.titan/plans/prp-clubes-y-mesas-con-apuesta.md` (aprobado 2026-11-07).

## 1. Qué es

Una app Android (APK distribuido por enlace, fuera de Play Store) para jugar dominó online en tiempo real, organizada
en **clubes**. Cada club reparte **fichas de club** a sus miembros. En las mesas los jugadores ponen fichas y **el
ganador se lleva el bote**, menos un **cargo** de la mesa.

La plataforma **no maneja dinero**:

- La app **no vende, no compra y no canjea** fichas. No procesa pagos ni guarda datos bancarios.
- Las fichas las **asigna y retira el club**. Cualquier acuerdo económico entre club y jugador ocurre **fuera de la
  app** y es responsabilidad de quienes lo celebran.
- No hay transferencias entre jugadores: las fichas solo se mueven entre la tesorería del club, los jugadores (por
  asignación o retirada del club) y los botes de las mesas.

> Vocabulario: **fichas** (`chips`) son el saldo de juego; **fichas de dominó** (`tiles`) son las piezas. En la
> interfaz, «fichas» a secas es el saldo y la mano del jugador se llama «tu mano».

### 1.1 Responsabilidad y titularidad (decidido 2026-11-07)

| # | Decisión | Valor |
|---|----------|-------|
| D1 | Dueño legal de la plataforma y de las cuentas (Supabase, dominio, firma del APK, distribución) | **El operador** (o una entidad suya). Se construye bajo cuentas de desarrollo y se **traspasa antes del piloto** |
| D2 | Cómo cobra Fullkod | **Tarifa fija o licencia**, acordada fuera de la app. Fullkod no recibe parte de los cargos de las mesas (`platform_share_pct = 0`) |
| D3 | Revisión legal en el país donde se juegue | **Obligatoria antes del piloto**. En curso: consulta preparada en `.titan/plans/consulta-legal-modelo-clubes.md` (Código Penal, art. 281 «Juegos ilícitos»). Si el modelo con bote no es viable, se pasa al modelo sin bote: la entrada se consume y va al club, gane quien gane |

La app es **marca blanca**: el APK y la web pública no mencionan a Fullkod (§8).

## 2. Roles

### 2.1 Globales (`profiles.role`)

| Rol | Quién | Qué puede hacer |
|-----|-------|-----------------|
| `player` | Cualquiera que se registra | Unirse a clubes, jugar, ver sus saldos y movimientos |
| `platform` | El dueño de la plataforma (operador según D1) | Crear y suspender clubes, emitir fichas a la tesorería de un club y retirarlas, fijar su parte del cargo por club, sus contactos, la versión mínima de la app, ver informes globales. No toca saldos de jugadores directamente |
| `auditor` | Supervisión (decidido 2026-11-07) | **Solo lectura** de los libros de fichas de la plataforma y de todos los clubes (saldos, movimientos, cuadre) en `/supervision`. No ve contactos, teléfonos, correos ni manos, y no puede hacer ninguna acción. Se asigna por SQL |

### 2.2 Dentro de un club (`club_members.role`)

| Rol | Qué puede hacer en su club |
|-----|----------------------------|
| `owner` | Todo lo de `admin` + nombrar o quitar admins |
| `admin` | Aprobar o rechazar solicitudes, suspender miembros, asignar y retirar fichas, crear y cerrar mesas, anular partidas, ver informes del club |
| `player` | Ver las mesas del club, sentarse y jugar |

Un admin de un club no ve ni toca nada de otro club.

## 3. Clubes y fichas

### 3.1 Clubes

- Un club tiene un **código** público corto (para buscarlo), nombre, dueño, estado (`active` / `suspended`) y su
  configuración de cargo (§6).
- Los clubes los crea `platform`. **[DECIDIR con Daniel]** si habrá clubes de varios dueños o solo el del operador.
- Unirse: el jugador busca el código → solicitud `pending` → un admin del club la aprueba (`active`) o la rechaza.
- **Invitación por enlace** (2026-11-07): el admin comparte `https://<web>/unirse/?c=CÓDIGO` («Invitar» en el panel
  del club). Con la app instalada, Android abre el APK (App Links, `/.well-known/assetlinks.json`); sin ella, la web
  muestra el código y el botón para descargar el APK. Sin sesión, la app guarda el código, pide entrar o registrarse y
  vuelve a la invitación. El enlace **solo crea la solicitud** `pending`: un admin la sigue aprobando.
- **Contraseña**: «¿Olvidaste tu contraseña?» manda un enlace por correo a `https://<web>/restablecer/` (abre el APK);
  desde el perfil se cambia sin correo. Requiere la web pública y un SMTP propio en Supabase (el de Supabase solo
  envía a los miembros del equipo).
- Un jugador puede pertenecer a varios clubes; su saldo es **por club** y no se mezcla.

### 3.2 Movimiento de fichas (libro de doble partida)

Cada club tiene cuentas: su **tesorería**, una por **jugador** y una por **bote** de partida. Todo movimiento es una
operación del libro `chip_ledger` (de **solo inserción**) que mueve una cantidad de una cuenta a otra dentro del mismo
club. Los saldos nunca quedan negativos y la suma de un club siempre cuadra con lo emitido.

| Tipo | De → a | Quién |
|------|--------|-------|
| `issue` | (emisión) → tesorería | `platform` |
| `retire` | tesorería o parte de la plataforma → (emisión) | `platform`, con nota obligatoria |
| `assign` | tesorería → jugador | admin del club |
| `withdraw` | jugador → tesorería | admin del club |
| `buy_in` | jugador → bote | servidor, al empezar la partida |
| `payout` | bote → jugador | servidor, al terminar |
| `rake` | bote → tesorería | servidor, al terminar |
| `refund` | bote → jugador | servidor o admin, al anular |
| `adjustment` | tesorería ↔ jugador | admin del club, con nota obligatoria |

Los errores se corrigen con un movimiento contrario; nada se edita ni se borra. Cada movimiento guarda quién, cuándo y
una nota.

**Cuadre** (debe dar siempre 0 diferencias): Σ emitido al club − Σ retirado = tesorería + Σ saldos de jugadores +
Σ botes abiertos + parte de la plataforma.

### 3.3 Operador ↔ club ↔ jugador (decidido 2026-11-07)

Habrá clubes del operador y **clubes de otros dueños**; el flujo es el mismo para todos. Los acuerdos económicos
siempre ocurren **fuera de la app**: la app solo enseña a quién contactar y bloquea la acción que falta.

| Paso | Quién | En la app |
|------|-------|-----------|
| 1. Alta del club | Operador | Plataforma → crear club con el dueño (ya registrado) |
| 2. El club necesita fichas | Admin del club | Si la tesorería no alcanza para asignar, el botón «Confirmar» se cambia por **«Contactar a la plataforma»** (WhatsApp o llamada a los contactos del operador). Se acuerda fuera |
| 3. Emisión | Operador | `issue` a la tesorería del club |
| 4. El jugador necesita fichas | Jugador | Si no le alcanza la entrada, «Sentarse» o «Listo» se cambian por **«Contactar al club»** (contactos del club). Se acuerda fuera |
| 5. Asignación / retirada | Admin del club | `assign` / `withdraw` |
| 6. Liquidación con el operador | Operador | `retire`: el club devuelve fichas de su tesorería, o se liquida la **parte de la plataforma** acumulada |

- **Contactos** (`contacts`): hasta 5 por club (los ven sus miembros activos) y hasta 5 de la plataforma (los ven los
  admins de clubes). Nombre y teléfono con código de país; el mensaje de WhatsApp sale prellenado con el nombre,
  el club y su código, **sin cantidades ni la palabra «comprar»**. Nunca hay un botón de «recargar» ni «comprar».
- **Ingresos del operador por club** (ambas palancas preparadas, se usan según el acuerdo con cada dueño):
  1. lo que cobre fuera de la app por cada emisión;
  2. `clubs.platform_share_pct`: qué % de cada cargo de mesa va a la cuenta `platform` del club (0 en los clubes
     propios). Se liquida fuera y se registra con `retire`.
- El operador ve en Plataforma la tesorería y la parte acumulada de cada club; Supervisión ve todos los libros.

## 4. Mesas y partidas

### 4.1 Tipos de mesa (v1)

Cada club define **plantillas de mesa** (`table_templates`) y la app abre mesas a partir de ellas.

| Parámetro | Valores v1 | Fase 2 |
|-----------|-----------|--------|
| Juego (`game_type`) | `double9` (doble 9), `double6` (doble 6) | Pintintín |
| Formato (`format`) | `pairs` (4 jugadores, 0-2 contra 1-3), `one_vs_one` (2 jugadores) | Individual de 3–4 |
| Modo (`mode`) | `all_in`: cada uno pone la entrada y el ganador se lleva el bote | `cash` **[DECIDIR con Daniel]** |
| Entrada (`entry`) | Entero de 5 a 10 500 (lo fija el club) | — |
| Puntos para ganar (`target_points`) | Por defecto 100 | — |
| Tiempo por turno (`turn_seconds`) | Por defecto 30 s (10–120) | — |
| Conteo al dominar (`scoring`) | `all_hands` por defecto, o `opponents` | — |

Mesas privadas, «Cash» y jerarquía de agentes van en la fase 2, cuando se confirme con el operador cómo funcionan.

### 4.2 Ciclo de una mesa

1. `waiting`: los jugadores se sientan y marcan **listo**. Un jugador solo puede estar sentado en una mesa a la vez.
   Para sentarse debe ser miembro activo del club y tener saldo ≥ entrada en ese club.
2. Con la mesa completa y todos listos, el servidor hace el **buy-in de todos en una sola transacción** (jugador →
   bote). Si a alguno le falta saldo, no se cobra a nadie, se le quita el «listo» y se le avisa.
3. `playing`: se reparte la primera mano y se juega.
4. `finished`: alguien llegó a los puntos objetivo y el servidor **liquida** (§4.3). La mesa se puede volver a usar
   con los mismos jugadores (nueva partida, nuevo buy-in) o se vacía.

### 4.3 Liquidación

- Bote = Σ entradas. Cargo = `min(round(bote × rake_pct / 100), rake_cap)`, si el club tiene tope.
- El resto (`bote − cargo`) va al ganador. En parejas se reparte a partes iguales entre los dos; si sobra una ficha
  impar, va al asiento ganador más bajo.
- El cargo va a la tesorería del club.
- La liquidación es **idempotente** por partida: se paga una sola vez aunque se reintente.

### 4.4 Abandono y anulación

- Un jugador que no juega en su tiempo de turno juega automáticamente (§5.5). Con **3 turnos seguidos vencidos** se le
  considera **abandono**:
  - en la **primera mano**: la partida se anula; se devuelve la entrada a los demás y el que abandona la pierde (va a
    la tesorería como cargo);
  - después: su lado **pierde la partida** y se liquida normalmente a favor del contrario.
- Un admin del club puede **anular** una partida en curso (p. ej. por un fallo): se devuelven todas las entradas y el
  cargo queda en 0.

## 5. Reglas del juego

### 5.1 Reparto y salida

- Fichas por jugador: **doble 9 → 10**; **doble 6 → 7**. Las que sobran quedan boca abajo y **no se roban**
  **[DECIDIR con Daniel: ¿se roba en 1vs1?]**.
- **Primera mano**: sale quien tenga **el doble más alto**, con ese doble. Si nadie tiene dobles, sale el asiento 0
  con la ficha que quiera.
- **Manos siguientes**: sale el siguiente asiento en orden (rota), con la ficha que quiera.

### 5.2 Turno

- Turno en orden de asiento (0 → 1 → 2 → 3 → 0 en parejas; 0 → 1 → 0 en 1vs1).
- El jugador **coloca una ficha** que case con uno de los dos extremos o **pasa**. **Solo puede pasar si no tiene
  jugada**; el servidor lo valida. Si la ficha casa por los dos extremos, elige el lado.

### 5.3 Fin de mano

- **Dominó**: un jugador coloca su última ficha. Gana su lado (pareja o jugador).
- **Tranque**: todos pasan seguidos y nadie puede jugar. Gana el lado del **jugador con menos puntos en la mano**. Si
  hay empate entre jugadores de lados distintos, la mano es **nula** (nadie anota).

### 5.4 Puntuación

- El valor de una ficha es la suma de sus dos números.
- El lado ganador anota la suma de las fichas que quedan en las manos: de todos (`all_hands`) o solo del lado contrario
  (`opponents`). En 1vs1 ambos modos dan lo mismo salvo por las fichas propias del ganador.
- La partida termina cuando un lado llega o supera `target_points`.

### 5.5 Tiempo y reconexión

- Cada turno tiene hora límite (`turn_deadline`). Si vence, el servidor **pasa** si no hay jugada o coloca **la ficha
  jugable de más puntos**.
- Un jugador desconectado puede volver a entrar y recupera su mano; mientras tanto corren sus turnos.

### 5.6 Antitrampas (por diseño)

- **El servidor es la única autoridad.** El móvil solo envía «quiero jugar esta ficha en este lado» o «paso».
- **Cada jugador solo recibe sus propias fichas de dominó.** Las manos se guardan aparte con RLS.
- Chat de mesa: solo mensajes predefinidos **[DECIDIR]**.
- Prohibidos los bots, la colusión y las multicuentas; el admin del club puede suspender y congelar saldos.

## 6. Cargos e ingresos

- Cada club configura su cargo: `rake_pct` (0–20 %) y un tope opcional `rake_cap` por partida.
- Los cargos van a la **tesorería del club**. Cómo los reparte el club fuera de la app no es asunto de la plataforma.
- `clubs.platform_share_pct` existe y vale **0** (D2): la plataforma no participa en los cargos.
- **Informes**: para el club (movimientos, partidas, cargos por periodo) y para `platform` (resumen por club).

## 7. Distribución de la app

- **APK** con Capacitor, firmado siempre con la **misma clave**, que pertenece al dueño según D1. Si se pierde, no se
  puede actualizar la app.
- Descarga desde una landing con un botón al APK y los pasos para permitir «instalar apps de origen desconocido».
- **Publicación**: GitHub Action `APK release` (manual). Compila y firma en GitHub (la clave va en los secretos del
  repo) y sube a Supabase Storage, bucket público `apk`: `domino.apk` (siempre **solo la última**, se sobrescribe) y
  `latest.json`. El `versionCode` es el publicado + 1.
- **Aviso en la app**: al abrir y al volver a la app compara su versión con `latest.json` → franja «Hay una versión
  nueva» con «Actualizar». Android pide confirmar la instalación (no hay instalación silenciosa fuera de Play Store).
- **Actualización forzada**: por debajo de `app_settings.min_app_version` la app se bloquea con «Hay que actualizar».
  Se cambia en Plataforma o marcando «Obligar a actualizar» al lanzar el Action.
- Los paneles de club y de plataforma son la misma app (rutas `/club/...`, `/platform/...`), usables también desde
  el navegador.

## 8. Marca blanca

- Nombre, `appId`, iconos y textos salen de una constante de marca (`src/shared/constants/brand.ts`).
- El APK, la web pública y la landing **no mencionan a Fullkod**. Se verifica con
  `grep -ri fullkod out android/app/src` (debe salir vacío) antes de cada entrega.
- Antes del piloto (D1) se traspasan al operador: proyecto Supabase, repositorio, dominio, distribución y clave de
  firma.

## 9. Fuera del alcance de la v1

Pagos dentro de la app, canje de fichas por dinero, transferencias entre jugadores, tienda de cosméticos, mesas Cash,
Pintintín, mesas privadas, agentes, iOS nativo, Play Store, chat libre, espectadores, partidas contra la máquina.

## 10. Criterios de éxito de la v1

1. 4 jugadores en 4 móviles juegan una partida completa a 100 sin errores ni desincronización; lo mismo en 1vs1.
2. Ningún jugador puede ver las fichas de otro ni hacer una jugada ilegal, aunque modifique el cliente.
3. El buy-in se cobra exactamente una vez a cada uno; con saldo insuficiente de alguno, a nadie.
4. La liquidación paga el bote exactamente una vez.
5. El cuadre de cada club da 0 diferencias en todo momento.
6. Un admin de club no puede ver ni tocar otro club; un jugador no ve saldos ajenos.

## 11. Orden de implementación

1. **Reglas y motor**: este documento y el motor con 1vs1 y parejas, con pruebas.
2. **Esquema**: clubes, fichas de doble partida, mesas, partidas, liquidación, RLS. Se aplica al proyecto remoto con
   permiso.
3. **Autenticación** y perfil (registro por teléfono o correo **[DECIDIR]**).
4. **Clubes**: buscar por código, solicitud, aprobación, asignar y retirar fichas.
5. **Lobby**: mesas del club, sentarse, listo, buy-in.
6. **Partida en tiempo real**: Edge Function `game-action`, Realtime, tiempos de turno, liquidación.
7. **Informes** de club y de plataforma.
8. **Marca blanca, traspaso de cuentas y APK** firmado.
9. QA con 4 dispositivos, revisión legal (D3) y piloto.
