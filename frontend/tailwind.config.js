/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1B2733', soft: '#3D4954', muted: '#5B6B79', faint: '#8A97A3' },
        line: '#E2E8ED',
        canvas: '#F7FAFB',
        teal: { DEFAULT: '#0E7C86', dark: '#0B646C', tint: '#E3F5F3' },
        amber: { tint: '#FCF1DC', line: '#F0DDB0', ink: '#7A5A17' },
      },
      fontFamily: { sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
};
