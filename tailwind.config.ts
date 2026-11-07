import type { Config } from 'tailwindcss'

// Brand manual (Nov 2026): Violeta Noche #24104F, Violeta #5B21B6 (Tailwind violet-800), Oro #F2B705.
// Gold only for what needs attention now (your turn, the playable tile, the last tile played).
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        noche: '#24104F',
        oro: '#F2B705',
        tinta: '#17132A',
        pizarra: '#625C7A',
        lavanda: '#EFEAFB',
        crema: '#FDF6DD',
        // Neutrals tinted towards the brand violet (from Tinta, Pizarra and Lavanda).
        neutral: {
          50: '#F8F6FD',
          100: '#EFEAFB',
          200: '#DCD6EC',
          300: '#BDB6D1',
          400: '#958EAD',
          500: '#625C7A',
          600: '#4A4463',
          700: '#36304F',
          800: '#262040',
          900: '#1A1530',
          950: '#100C20',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'Roboto', 'Segoe UI', 'Arial', 'sans-serif'],
        display: ['var(--font-outfit)', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'Roboto Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
