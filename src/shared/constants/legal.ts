// Terms, privacy and responsible play shown in the app (/terminos). White-label: the operator's
// legal data is filled in at handover (BUSINESS_LOGIC §1.1 D1, §8). Until the legal review (D3)
// signs it off, `reviewed` stays false and the page says the text is provisional.
export const LEGAL = {
  reviewed: false,
  updatedAt: '7 de noviembre de 2026',
  /** Legal name of the operator that owns the platform. */
  operatorName: 'el operador de la plataforma',
  /** Contact for legal and privacy requests. Empty = not published yet. */
  contactEmail: '',
  minimumAge: 18,
} as const

export interface LegalSection {
  id: string
  title: string
  paragraphs: string[]
}

export const TERMS: LegalSection[] = [
  {
    id: 'que-es',
    title: '1. Qué es la app',
    paragraphs: [
      'Es una plataforma para jugar dominó en línea dentro de clubes. Cada club tiene un dueño y administradores que admiten a sus miembros y gestionan las fichas de juego del club.',
      'La plataforma la gestiona {operator}. Al crear una cuenta aceptas estos términos.',
    ],
  },
  {
    id: 'cuenta',
    title: '2. Tu cuenta',
    paragraphs: [
      'Debes tener al menos {age} años. La cuenta es personal: no la compartas ni la cedas.',
      'Eres responsable de lo que se haga con tu cuenta. Si crees que alguien entró en ella, cambia la contraseña y avisa a tu club.',
    ],
  },
  {
    id: 'fichas',
    title: '3. Las fichas',
    paragraphs: [
      'Las fichas son unidades de juego de cada club. Solo sirven para jugar dentro de ese club y no se mezclan entre clubes.',
      'La app no vende fichas, no las compra, no las cambia por dinero ni por bienes, y no permite pasar fichas de un jugador a otro. La app no procesa pagos ni guarda datos bancarios.',
      'Las fichas las asigna y las retira el club. Cualquier acuerdo entre tú y un club, o entre un club y la plataforma, ocurre fuera de la app y es responsabilidad exclusiva de quienes lo celebran.',
      'Cada movimiento de fichas queda registrado y no se puede borrar. Los errores se corrigen con un movimiento contrario.',
    ],
  },
  {
    id: 'mesas',
    title: '4. Mesas y partidas',
    paragraphs: [
      'Cada mesa tiene una entrada en fichas que se descuenta al empezar la partida. Las reglas de la mesa (tipo de dominó, puntos, tiempo por turno y cargo del club) se muestran antes de sentarte.',
      'El servidor de la plataforma reparte las fichas de dominó, valida cada jugada y calcula el resultado. Su registro es el que vale.',
      'Si un jugador deja vencer su turno varias veces seguidas, la partida puede darse por abandonada, según las reglas publicadas.',
    ],
  },
  {
    id: 'conducta',
    title: '5. Conducta',
    paragraphs: [
      'Está prohibido: ponerse de acuerdo con otros jugadores para hacer trampa, usar varias cuentas, usar programas que jueguen por ti, aprovechar errores de la app o molestar a otros jugadores.',
      'El club o la plataforma pueden suspender una cuenta o una membresía que incumpla estas normas y anular las partidas afectadas.',
    ],
  },
  {
    id: 'clubes',
    title: '6. Los clubes',
    paragraphs: [
      'Cada club decide a quién admite, cuántas fichas asigna, qué mesas ofrece y el cargo de sus mesas, dentro de los límites de la plataforma.',
      'Los teléfonos de contacto que publica un club son suyos. La plataforma no participa en esas conversaciones.',
    ],
  },
  {
    id: 'responsable',
    title: '7. Juego responsable',
    paragraphs: [
      'Juega para divertirte. Si sientes que el juego te ocupa demasiado tiempo o te causa problemas, para y pide a tu club que suspenda tu cuenta.',
    ],
  },
  {
    id: 'servicio',
    title: '8. El servicio',
    paragraphs: [
      'La app se ofrece tal cual. Puede tener cortes o fallos; si una partida se interrumpe por un fallo de la plataforma, se puede anular y devolver las entradas.',
      'Las actualizaciones de la app pueden ser obligatorias para seguir jugando.',
      'Estos términos pueden cambiar. Si el cambio es importante, se avisará en la app.',
    ],
  },
]

export const PRIVACY: LegalSection[] = [
  {
    id: 'datos',
    title: 'Qué datos guardamos',
    paragraphs: [
      'Tu correo y tu contraseña (cifrada) para entrar, tu nombre de jugador, los clubes a los que perteneces, tus partidas, tus jugadas y tus movimientos de fichas.',
      'No pedimos documentos de identidad, datos bancarios ni tu ubicación.',
    ],
  },
  {
    id: 'uso',
    title: 'Para qué los usamos',
    paragraphs: [
      'Para que puedas jugar, para mostrar a tu club tus movimientos y saldo, para resolver reclamaciones y para detectar trampas.',
      'Tu nombre de jugador lo ven los demás jugadores. Tu correo solo lo ve la plataforma.',
    ],
  },
  {
    id: 'donde',
    title: 'Dónde se guardan',
    paragraphs: [
      'En los servidores del proveedor de base de datos de la plataforma, que pueden estar fuera de tu país.',
      'Puedes pedir una copia de tus datos o que se borre tu cuenta. El historial de movimientos de fichas se conserva para que las cuentas de cada club sigan cuadrando.',
    ],
  },
]
