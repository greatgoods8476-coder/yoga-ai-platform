// "calm_blue" theme — matches the backend's default color_theme option.
// Other theme keys from onboarding (earth_tone, sunrise, monochrome,
// high_contrast) can be added here later as sibling palettes.
export const theme = {
  colors: {
    background: '#F3F7F9',
    surface: '#FFFFFF',
    primary: '#4C7A8C',
    primaryDark: '#2F5561',
    accent: '#B9D6C9',
    text: '#233238',
    textMuted: '#647177',
    border: '#DCE6E9',
    danger: '#C4675A',
  },
  spacing: (n: number) => n * 8,
  radius: 16,
};

export type Theme = typeof theme;
