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
        // Neutrals built on Violeta Noche (brand manual §06: Noche is "el color que más se ve"):
        // 950 is the app background, 900 cards, 800 inputs and chips, 700 borders; 100 = Lavanda.
        neutral: {
          50: '#F8F6FD',
          100: '#EFEAFB',
          200: '#DED7F2',
          300: '#C2B8E3',
          400: '#9C90C6',
          500: '#7568A3',
          600: '#544680',
          700: '#3D2F6E',
          800: '#2C1F5A',
          900: '#211546',
          950: '#170D35',
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
