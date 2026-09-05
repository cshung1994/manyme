import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    borderRadius: {
      none: '0px',
      DEFAULT: '0px',
      sm: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      '3xl': '0px',
      full: '9999px',
    },
    extend: {
      colors: {
        background: '#f9f9f9',
        surface: '#f9f9f9',
        'surface-elevated': '#ffffff',
        'surface-dim': '#f3f3f3',
        'border-subtle': '#e2e2e2',
        'border-strong': '#c6c6c6',
        'text-primary': '#1b1b1b',
        'text-secondary': '#474747',
        'text-tertiary': '#777777',
        accent: '#4a3bf6',
        'accent-muted': '#d3d0ff',
        'accent-foreground': '#ffffff',
        success: '#2e7d32',
        warning: '#e65100',
        error: '#ba1a1a',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Newsreader', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
