# Producto, modelo de negocio y decisiones de arranque

> **SUPERADO el 2026-11-07** por `2026-11-07-modelo-clubes.md`: el operador pidió mesas con apuesta y se pasó al
> modelo de clubes. Lo que sigue vigente de esta nota son las reglas de juego por defecto.

Date: 2026-11-06
Fuente: conversación con Roberto al crear el proyecto.

- Idea de un colega de Roberto (el «operador»): dominó online en APK, salas con mesas de 4 conectados; el jugador paga
  por fuera y un admin le acredita créditos («fichas» para el operador; en la app y el código, `credits`).
- **Premisa fijada por Roberto: no se apuesta ni se saca dinero.** Ejemplo: pone 40 pesos → 4 partidas de 10 créditos;
  1 crédito = 1 peso. Los créditos se consumen al jugar; ganar no da créditos.
- **Fullkod cobra el 10 % del ingreso del operador**: mesa de 4 × 10 = 40 → 4 para Fullkod. Se calcula por partida
  al cobrar las entradas (`games.platform_fee_credits`) y se resta si hay devoluciones.
- Distribución: APK por URL (landing en Vercel + APK en GitHub Releases o Supabase Storage), fuera de Play Store.
- Base técnica elegida: Next.js export estático + Capacitor (como Turno Flash, que ya resuelve APK sin Play Store y
  WebView viejos) + Supabase. Tailwind 3, no 4, por los WebView viejos.
- Reglas por defecto: doble 9, parejas 0-2 contra 1-3, 10 fichas por jugador, partida a 100, 30 s por turno, sin robar,
  tranque gana la pareja del jugador con menos puntos (empate entre parejas → mano nula).
- Pendientes con el operador: todos los **[DECIDIR]** de `BUSINESS_LOGIC.md` (variante local, abandono, comisión sobre
  bonus, chat, emparejamiento automático, comprobante de pago, tipo de registro).
