/**
 * Preset Tailwind do Lastro. Consumo em apps/web:
 *   module.exports = { presets: [require('@lastro/ui/tailwind-preset')] }
 * As cores apontam para variáveis CSS injetadas via themeCss() (:root / .dark).
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        border: 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        'on-accent': 'var(--text-onAccent)',
        brand: 'var(--brand)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'amount-positive': 'var(--amount-positive)',
        'amount-negative': 'var(--amount-negative)',
        'focus-ring': 'var(--focusRing)',
      },
      spacing: {
        1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
        6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
      },
      borderRadius: { sm: '6px', md: '10px', lg: '16px', xl: '24px', full: '9999px' },
      boxShadow: {
        sm: '0 1px 2px rgba(6, 33, 35, 0.06)',
        md: '0 4px 12px rgba(6, 33, 35, 0.08)',
        lg: '0 12px 32px rgba(6, 33, 35, 0.12)',
      },
    },
  },
};
