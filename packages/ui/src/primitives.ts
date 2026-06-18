export type Hex = string;

export const color = {
  teal: {
    '50': '#ECF6F6',
    '100': '#CFE8E8',
    '200': '#9FD0D1',
    '300': '#6BB4B6',
    '400': '#3E9598',
    '500': '#1F7A7D',
    '600': '#155E61',
    '700': '#0F4749',
    '800': '#0A3335',
    '900': '#062123',
  },
  aqua: { '400': '#4FD1C5', '500': '#2BB6A8' },
  coral: { '300': '#FF9488', '400': '#FF7A6B', '500': '#FF6B5A', '600': '#E55444' },
  neutral: {
    '0': '#FFFFFF',
    '50': '#F7F9F9',
    '100': '#EEF2F2',
    '200': '#DDE4E4',
    '300': '#C2CCCC',
    '400': '#95A3A3',
    '500': '#6B7878',
    '600': '#4C5757',
    '700': '#364040',
    '800': '#222A2A',
    '900': '#141A1A',
  },
  feedback: {
    success: '#1FA67A',
    successLight: '#3FBF93',
    danger: '#E5484D',
    dangerLight: '#F76A6E',
    warning: '#F5A623',
  },
} as const;

export const space: Record<string, number> = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
};

export const radius: Record<string, number> = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fontSize: Record<string, [number, number]> = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  '2xl': [24, 32],
  '3xl': [30, 36],
  '4xl': [36, 40],
};

export const fontWeight: Record<string, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const shadow: Record<'sm' | 'md' | 'lg', string> = {
  sm: '0 1px 2px rgba(6, 33, 35, 0.06)',
  md: '0 4px 12px rgba(6, 33, 35, 0.08)',
  lg: '0 12px 32px rgba(6, 33, 35, 0.12)',
};
