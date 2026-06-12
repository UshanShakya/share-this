export const Colors = {
  light: {
    background: '#fafaf9',      // Paper background
    surface: '#FBEAF0',         // Blush surface
    elevated: '#F5D3DE',        // Blush-darker elevated
    text: '#1a1a1a',            // Canvas text dark
    textSecondary: '#888888',
    accent: '#D4537E',          // Knot pink accent
    destructive: '#E5484D',
    border: '#EEEEEE',
    loopPurple: '#7F77DD',
    endAmber: '#EF9F27',
  },
  dark: {
    background: '#0f0f0f',      // Canvas dark background
    surface: '#1A1A1A',
    elevated: '#2A2A2A',
    text: '#FFFFFF',
    textSecondary: '#888888',
    accent: '#D4537E',          // Knot pink accent
    destructive: '#F16063',
    border: '#333333',
    loopPurple: '#7F77DD',
    endAmber: '#EF9F27',
  },
} as const;

export type Theme = typeof Colors.light;
