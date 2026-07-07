import { MD3LightTheme } from 'react-native-paper';

export const C = {
  navy:        '#1A237E',
  navyDark:    '#0D1554',
  navyMid:     '#283593',
  navyLight:   '#3949AB',
  gold:        '#FFD700',
  goldDark:    '#F9A825',
  goldLight:   '#FFF9C4',
  bg:          '#F0F4FF',
  white:       '#FFFFFF',
  surface:     '#FFFFFF',
  textPrimary: '#1A237E',
  textMid:     '#546E7A',
  textLight:   '#90A4AE',
  border:      '#E8EAF6',
  success:     '#00897B',
  warning:     '#F57C00',
  danger:      '#C62828',
  info:        '#1565C0',
  purple:      '#6A1B9A',
} as const;

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:          C.navy,
    primaryContainer: '#C5CAE9',
    secondary:        C.navyMid,
    background:       C.bg,
    surface:          C.white,
    error:            C.danger,
    text:             C.textPrimary,
    onPrimary:        C.white,
    onSecondary:      C.white,
    onBackground:     C.textPrimary,
    onSurface:        C.textPrimary,
  },
};
