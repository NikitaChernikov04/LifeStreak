import type { Config } from 'tailwindcss';

/**
 * "Журнал наблюдений" — the app is a notebook you keep on yourself. Paper is
 * warm cream with the tooth of uncoated stock and one margin rule down the
 * left; ink is the only voice that carries weight; ochre marks everything the
 * user has earned; vermilion is reserved exclusively for breaks in the record,
 * never for decoration.
 *
 * The page carries exactly one ruling, and it belongs to the content. An
 * earlier version printed a 22px square grid behind everything, which drew a
 * rhythm at the same spatial frequency as the type and lined up with nothing.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      fontFamily: {
        // Display: PT Sans Narrow — a Cyrillic-first condensed grotesque, the
        // face of Russian signage and forms. Set in caps with wide tracking.
        display: ['"PT Sans Narrow"', 'Arial Narrow', 'sans-serif'],
        // Data: everything that is a measurement — dates, counts, XP, codes.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        // Prose: descriptions and anything read as a sentence.
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: {
          DEFAULT: 'hsl(var(--paper))',
          lit: 'hsl(var(--paper-lit))',
          edge: 'hsl(var(--paper-edge))',
          sunk: 'hsl(var(--paper-sunk))',
        },
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          soft: 'hsl(var(--ink-soft))',
        },
        graphite: 'hsl(var(--graphite))',
        indigo: {
          DEFAULT: 'hsl(var(--indigo))',
          soft: 'hsl(var(--indigo-soft))',
        },
        vermilion: 'hsl(var(--vermilion))',
        ochre: 'hsl(var(--ochre))',
      },
      borderRadius: {
        // Paper is cut, not rounded. 2px is the softest the system goes.
        none: '0',
        sm: '1px',
        DEFAULT: '2px',
        md: '2px',
        lg: '3px',
      },
      fontSize: {
        micro: ['0.625rem', { lineHeight: '1rem', letterSpacing: '0.12em' }],
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.1em' }],
      },
      keyframes: {
        // The caret on today's empty cell — a notebook waiting to be written in.
        caret: {
          '0%, 45%': { opacity: '1' },
          '55%, 100%': { opacity: '0.15' },
        },
        // A check-in lands like a rubber stamp: overshoot, settle, slight cant.
        stamp: {
          '0%': { transform: 'scale(1.6) rotate(-8deg)', opacity: '0' },
          '55%': { transform: 'scale(0.94) rotate(1.5deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'ink-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        caret: 'caret 1.4s steps(1, end) infinite',
        stamp: 'stamp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ink-in': 'ink-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
