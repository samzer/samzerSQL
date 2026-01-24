/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pastel theme colors
        pastel: {
          // Background colors
          bg: {
            primary: '#fafbfc',
            secondary: '#f5f7f9',
            tertiary: '#eef1f5',
            hover: '#e8ecf1',
            active: '#dde3ea',
          },
          // Border colors
          border: {
            light: '#e5e9ef',
            medium: '#d1d8e0',
            dark: '#b8c2cc',
          },
          // Text colors
          text: {
            primary: '#2c3e50',
            secondary: '#5a6977',
            muted: '#8392a5',
            disabled: '#a9b7c6',
          },
          // Accent colors
          accent: {
            blue: '#a8d4f0',
            'blue-hover': '#8ec4e8',
            'blue-text': '#2980b9',
            green: '#b8e6c9',
            'green-hover': '#9edcb3',
            'green-text': '#27ae60',
            purple: '#d4c4e8',
            'purple-hover': '#c4b0de',
            'purple-text': '#8e44ad',
            pink: '#f5c6d6',
            'pink-hover': '#f0b0c4',
            'pink-text': '#c0392b',
            yellow: '#f9e4b7',
            'yellow-hover': '#f5d89a',
            'yellow-text': '#d68910',
            orange: '#f8d5b4',
            'orange-hover': '#f5c69a',
            'orange-text': '#e67e22',
          },
          // Status colors
          status: {
            success: '#b8e6c9',
            'success-text': '#1e8449',
            error: '#f5c6c6',
            'error-text': '#c0392b',
            warning: '#f9e4b7',
            'warning-text': '#d68910',
            info: '#a8d4f0',
            'info-text': '#2980b9',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.08)',
        'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.04)',
        'glow-green': '0 0 10px rgba(39, 174, 96, 0.5), 0 0 20px rgba(39, 174, 96, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
