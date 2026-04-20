/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./site_src/**/*.ts'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: 'var(--ink-900)',
          800: 'var(--ink-800)',
          700: 'var(--ink-700)',
          600: 'var(--ink-600)',
          500: 'var(--ink-500)',
        },
        fog: {
          100: 'var(--fog-100)',
          200: 'var(--fog-200)',
          300: 'var(--fog-300)',
          400: 'var(--fog-400)',
          500: 'var(--fog-500)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          light: 'var(--accent-light)',
          pale: 'var(--accent-pale)',
        },
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        script: ['Italianno', 'cursive'],
      },
    },
  },
};
