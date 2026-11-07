# Invitación por enlace y recuperación de contraseña

Date: 2026-11-07
Fuente: Roberto, en sesión. Regla de negocio en `BUSINESS_LOGIC.md` §3.1.

- **Programado** (commit `81a30fc`, sin publicar): `/unirse/?c=CÓDIGO` (en el APK por Android App Links; en la web,
  página de descarga), «Invitar» en el panel del club (`@capacitor/share`), «¿Olvidaste tu contraseña?» → `/recuperar/`
  → correo → `/restablecer/`, y cambio de contraseña en el perfil. El enlace solo crea la solicitud `pending`.
- **Web pública (2026-11-07): `https://domino-jet-kappa.vercel.app`**, desplegada por Roberto desde GitHub en su
  Vercel (no está en la cuenta conectada a Claude). Por defecto en `BRAND.webUrl`; variable de repo
  `NEXT_PUBLIC_APP_URL` puesta; Supabase Auth con `site_url` y redirección `/**` de ese dominio. Cuando llegue el
  dominio del operador, cambiar los tres y publicar otro APK. Lo de abajo queda como historia.
- ~~Dominio: se espera al del operador~~ (Roberto, 2026-11-07). La única cuenta de Vercel conectada en esta máquina es
  el equipo «lgiavedoni's projects» de commercecraft: **no desplegar ahí**. Mientras no haya web, `NEXT_PUBLIC_APP_URL`
  está vacío: «Invitar» comparte el código (sin enlace) y la recuperación por correo da «aún no disponible».
- **Al tener dominio**: 1) desplegar `out/` (sirve `/.well-known/assetlinks.json`, huella SHA-256 de la firma de
  release); 2) variable de repo `NEXT_PUBLIC_APP_URL` en GitHub (el Action pasa `-PappLinkHost`); 3) en Supabase Auth,
  `site_url` y la URL de redirección `https://<web>/restablecer/`; 4) publicar APK nuevo (el filtro de App Links va
  en el manifiesto, cambiarlo exige otro APK).
- **Correo: Resend** (decidido). Falta crear la cuenta, verificar un dominio de remitente y configurar el SMTP en
  Supabase Auth. Sin eso, el SMTP de Supabase solo envía a los miembros del equipo.
