# Consulta legal: app de dominó por clubes

Fecha: 2026-11-07 · Para: la abogada que revisa el proyecto · Estado: **pendiente de revisión**

Esta nota describe cómo funciona la app hoy, qué partes se pueden cambiar con facilidad y qué preguntas necesitamos
que nos responda. Referencia aportada por ella: Código Penal (Gaceta Oficial, 1 de septiembre de 2022), art. 281
(«Juegos ilícitos») y la definición de «juegos ilícitos» del glosario final.

## 1. Quiénes intervienen

| Parte | Papel |
|-------|-------|
| **Operador** (Daniel) | Pidió la app. Según lo acordado (2026-11-07), será el **dueño** de la plataforma y de las cuentas (servidor, dominio, publicación del APK) antes de ponerla en marcha |
| **Fullkod** (Roberto) | Desarrolla la app como proveedor. Cobra una **tarifa fija o licencia**, no un porcentaje de lo que se juega. Su nombre no aparece en la app |
| **Clubes** | Grupos dentro de la app. Cada club tiene un dueño y administradores que reparten fichas a sus jugadores |
| **Jugadores** | Se registran, entran a un club y juegan en mesas de 2 o 4 personas |

**Por confirmar:** en qué país están el operador, los dueños de club y los jugadores, y dónde tiene su sede Fullkod.

## 2. Cómo funciona hoy (modelo «con bote»)

1. El jugador consigue fichas a través de su club. **La app no vende fichas, no cobra dinero y no las cambia por
   dinero.** Si el jugador le paga algo al club o el club le recompra fichas, eso ocurre **fuera de la app**, y la app
   no lo registra.
2. En una mesa, cada jugador pone una entrada (entre 5 y 10 500 fichas) y se forma un **bote**.
3. Se juega una partida de dominó. El reparto de fichas de dominó es **aleatorio**; después cuenta la habilidad.
4. **El ganador (o la pareja ganadora) se lleva el bote**, menos un **cargo** (por defecto, el 5 %) que va al club.
5. La plataforma no recibe parte de ese cargo (acordado: 0 %).

Este es el modelo que pidió el operador y el que está programado ahora mismo.

## 3. Alternativa preparada (modelo «sin bote»)

Todo igual, salvo el punto 4: **la entrada se consume** y va al club **gane quien gane**. El ganador solo obtiene
ranking y estadísticas, nunca fichas. Cambiar de un modelo al otro es un ajuste pequeño en el programa.

## 4. Lo que nos preocupa

Leyendo el artículo 281 y la definición:
- «**ánimo de lucro o interés patrimonial de cualquier tipo**»: ¿cuenta que las fichas se paguen por fuera de la app?
- «la ganancia o la pérdida dependen de la suerte **o de otros factores ajenos a la voluntad**»: ¿un juego de
  habilidad con reparto aleatorio, como el dominó, entra aquí?
- «banquero, colector, apuntador o **promotor**»: ¿quién desarrolla o es dueño de la plataforma puede considerarse
  promotor? ¿Y los dueños de club que reparten fichas?
- Apartado 4: la pena sube a **3–8 años** cuando intervienen **dos o más personas**.

## 5. Preguntas concretas

1. Con el **modelo con bote** (§2), ¿hay riesgo penal para el operador, para los dueños de club o para Fullkod como
   desarrollador? ¿Cambia algo que Fullkod cobre una tarifa fija y no un porcentaje?
2. Con el **modelo sin bote** (§3), ¿desaparece el riesgo? ¿O el simple hecho de pagar una entrada ya es un problema?
3. ¿Cambia algo según **dónde** estén el operador, los jugadores, el servidor (EE. UU.) y Fullkod?
4. ¿Existe alguna **autorización legal** que permita operar el modelo con bote? ¿Quién la otorga?
5. ¿Qué cláusulas mínimas deberían llevar los **términos de uso** y el **contrato** entre Fullkod y el operador?

## 6. Qué haremos con la respuesta

- Si el modelo con bote no es viable: cambiar al modelo sin bote antes de ponerla en marcha.
- Si es viable bajo condiciones: anotarlas aquí e incorporarlas a `BUSINESS_LOGIC.md`.
- En cualquier caso, **no se pone en marcha con jugadores reales hasta tener su respuesta** (decisión D3).
