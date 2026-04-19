import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Light theme base
        ww: {
          bg: 'var(--color-bg)',
          bg2: 'var(--color-bg2)',
          surface: 'var(--color-surface)',
          'surface-alt': 'var(--color-surface-alt)',
          'surface-warm': 'var(--color-surface-warm)',
          border: 'var(--color-border)',
          'border-strong': 'var(--color-border-strong)',
          hairline: 'var(--color-hairline)',
          text: 'var(--color-text)',
          'text-sec': 'var(--color-text-sec)',
          'text-muted': 'var(--color-text-muted)',
          'text-faint': 'var(--color-text-faint)',
          accent: 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          'accent-soft': 'var(--color-accent-soft)',
          'accent-faint': 'var(--color-accent-faint)',
          'accent-on': 'var(--color-accent-text-on)',
          meet: 'var(--color-meet)',
          task: 'var(--color-task)',
          memo: 'var(--color-memo)',
          personal: 'var(--color-personal)',
          daily: 'var(--color-daily)',
          danger: 'var(--color-danger)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"',
          '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'system-ui', 'sans-serif',
        ],
        display: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
          '"Apple SD Gothic Neo"', 'system-ui', 'sans-serif',
        ],
        mono: [
          '"Berkeley Mono"', '"JetBrains Mono"', '"SF Mono"',
          'ui-monospace', 'Menlo', 'monospace',
        ],
      },
      borderRadius: {
        card: '16px',
        sheet: '24px',
        fab: '28px',
        tab: '22px',
        pill: '999px',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
    },
  },
  plugins: [],
} satisfies Config
