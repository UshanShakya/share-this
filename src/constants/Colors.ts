export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    elevated: '#EBEBEB',
    text: '#111111',
    textSecondary: '#666666',
    accent: '#5B5BD6',
    destructive: '#E5484D',
    border: '#E0E0E0',
  },
  dark: {
    background: '#111111',
    surface: '#1E1E1E',
    elevated: '#2A2A2A',
    text: '#F5F5F5',
    textSecondary: '#999999',
    accent: '#7C7CF0',
    destructive: '#F16063',
    border: '#333333',
  },
} as const;

export type Theme = typeof Colors.light;
