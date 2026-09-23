import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0c',
        surface: '#111114',
        surface2: '#17171c',
        surface3: '#1e1e26',
        ink2: '#1a1a22',
        violet: '#7c5dfa',
        violetSoft: '#a898f7',
        roseSoft: '#f07d9a',
        amber: '#f2b65e',
        coolGray: '#a1a1aa',
        textMain: '#ebecee',
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;