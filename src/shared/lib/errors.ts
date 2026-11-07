// Maps database / auth error codes to user-facing Spanish messages.
const MESSAGES: Record<string, string> = {
  insufficient_chips: 'No tienes fichas suficientes.',
  not_authenticated: 'Tu sesión ha caducado. Vuelve a entrar.',
  user_suspended: 'Tu cuenta está suspendida.',
  forbidden: 'No tienes permiso para hacer esto.',
  club_not_found: 'No hay ningún club con ese código.',
  club_suspended: 'El club está suspendido.',
  member_suspended: 'Estás suspendido en este club.',
  not_a_member: 'No eres miembro de este club.',
  already_seated: 'Ya estás sentado en otra mesa.',
  table_not_available: 'Esta mesa no está disponible.',
  cannot_leave_now: 'No puedes levantarte en plena partida.',
  not_seated: 'No estás sentado en ninguna mesa.',
  request_not_pending: 'Esa solicitud ya fue revisada.',
  member_not_found: 'Ese miembro no está en el club.',
  member_not_active: 'El jugador no es miembro activo del club.',
  invalid_amount: 'La cantidad no es válida.',
  note_required: 'Escribe una nota que explique el ajuste.',
  owner_not_found: 'No se encontró a ese usuario.',
  invalid_role: 'Rol no válido.',
  invalid_status: 'Estado no válido.',
  cannot_change_own_status: 'No puedes cambiar tu propio estado.',
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
  'Password should be at least': 'La contraseña debe tener al menos 8 caracteres.',
  'Failed to fetch': 'Sin conexión. Revisa tu internet.',
}

export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
  for (const [key, text] of Object.entries(MESSAGES)) {
    if (raw.includes(key)) return text
  }
  return 'Algo salió mal. Inténtalo de nuevo.'
}
