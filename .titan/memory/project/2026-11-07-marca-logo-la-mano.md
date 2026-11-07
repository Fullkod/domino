# Marca: logo «La mano» y manual de marca

Date: 2026-11-07
Fuente: Roberto, en sesión (eligió entre 4 rondas y 16 propuestas; las demás se borraron).

- **Logo aprobado: «La mano, icono noche».** Tres fichas blancas en abanico sobre un cuadrado Violeta Noche `#24104F`,
  con un punto de oro `#F2B705` en la ficha de delante. Es a la vez símbolo e icono de la app. Nombre `dominó`
  dibujado a medida, en violeta `#5B21B6` y con la tilde en oro. Sobre fondo oscuro, la mano va sin el cuadrado.
- Paleta de Fullkod. Tipografías Outfit (titulares), DM Sans (texto) y JetBrains Mono (fichas, códigos). Lema: «Tu
  club, en tu mano».
- **Kit y manual fuera del repo**, en `C:\Local-Disc-D\Project\Fullkod\_materiales\domino\brand\` (README con cómo
  regenerar). El manual lleva el logo de Fullkod en los créditos («Hecho por»), a petición de Roberto. La app sigue
  siendo marca blanca: nada de Fullkod en la UI, el APK ni la web pública.
- **Aplicada en la app (2026-11-07, APK 0.1.5)**: icono adaptable y pantalla de carga (`assets/` → `npm run
  assets:icons`, fondo `#24104F`), favicon, iconos y `site.webmanifest` en `public/`, logos en `public/brand/`
  (`Logo.tsx`: horizontal en la cabecera, vertical en las pantallas públicas), tipografías con `next/font/google`
  (se incrustan en el build), colores en `tailwind.config.ts` (`noche`, `oro`, `lavanda`…; la escala `neutral` está construida sobre
  Violeta Noche: 950 fondo `#170D35`, 900 tarjetas; acciones en `violet-600`). Cabecera y tapete en Noche; fichas
  blancas con puntos Noche; cifras, códigos y saldos en JetBrains Mono. El oro solo para tu turno, la ficha elegida y la última jugada. Lema en `BRAND.tagline`.
