// ============================================================
// constants/theme.ts — Sanctuary Design System
// Based on Material 3 color scheme: primary #496175
// ============================================================

// ── Color Palette ────────────────────────────────────────────
export const SanctuaryColors = {
  // Core
  background:              '#f8f9fa',
  surface:                 '#f8f9fa',
  surfaceBright:           '#f8f9fa',
  surfaceDim:              '#d1dce0',
  surfaceVariant:          '#dbe4e7',

  // Surface containers
  surfaceContainerLowest:  '#ffffff',
  surfaceContainerLow:     '#f1f4f6',
  surfaceContainer:        '#eaeff1',
  surfaceContainerHigh:    '#e3e9ec',
  surfaceContainerHighest: '#dbe4e7',

  // Primary
  primary:                 '#496175',
  primaryDim:              '#3d5569',
  primaryFixed:            '#cce5fd',
  primaryFixedDim:         '#bed7ef',
  primaryContainer:        '#cce5fd',
  onPrimary:               '#f3f8ff',
  onPrimaryFixed:          '#2a4255',
  onPrimaryFixedVariant:   '#465e72',
  onPrimaryContainer:      '#3c5468',

  // Secondary
  secondary:               '#506268',
  secondaryDim:            '#44565c',
  secondaryFixed:          '#d2e6ed',
  secondaryFixedDim:       '#c4d8df',
  secondaryContainer:      '#d2e6ed',
  onSecondary:             '#f0fbff',
  onSecondaryFixed:        '#304248',
  onSecondaryFixedVariant: '#4c5e65',
  onSecondaryContainer:    '#43555b',

  // Tertiary
  tertiary:                '#555f78',
  tertiaryDim:             '#49536b',
  tertiaryFixed:           '#d5dffd',
  tertiaryFixedDim:        '#c7d1ef',
  tertiaryContainer:       '#d5dffd',
  onTertiary:              '#f9f8ff',
  onTertiaryFixed:         '#333d55',
  onTertiaryFixedVariant:  '#505972',
  onTertiaryContainer:     '#465068',

  // On-colors
  onBackground:            '#2b3437',
  onSurface:               '#2b3437',
  onSurfaceVariant:        '#586064',

  // Outline
  outline:                 '#737c7f',
  outlineVariant:          '#abb3b7',

  // Error
  error:                   '#9f403d',
  errorDim:                '#4e0309',
  errorContainer:          '#fe8983',
  onError:                 '#fff7f6',
  onErrorContainer:        '#752121',

  // Inverse
  inverseSurface:          '#0c0f10',
  inverseOnSurface:        '#9b9d9e',
  inversePrimary:          '#cae3fb',

  // Surface tint
  surfaceTint:             '#496175',

  // Convenience aliases (for backward compat)
  card:                    '#ffffff',
  cardAlt:                 '#f1f4f6',
  border:                  '#abb3b7',
  borderLight:             '#dbe4e7',
  divider:                 'rgba(73,97,117,0.12)',
  textPrimary:             '#2b3437',
  textSecondary:           '#586064',
  textMuted:               '#737c7f',
  white:                   '#ffffff',
  black:                   '#000000',
  overlay:                 'rgba(43,52,55,0.6)',

  // Tab bar
  tabActive:               '#496175',
  tabInactive:             '#abb3b7',
  tabBar:                  '#ffffff',

  // Stress / mood indicators
  stressLow:               '#4D9B6F',
  stressMid:               '#D4A843',
  stressHigh:              '#9f403d',
  stressLowBg:             'rgba(77,155,111,0.12)',
  stressMidBg:             'rgba(212,168,67,0.12)',
  stressHighBg:            'rgba(159,64,61,0.12)',

  // Gradient helpers (used as string arrays)
  primaryGradientStart:    '#496175',
  primaryGradientEnd:      '#3d5569',
};

export type SanctuaryColorKey = keyof typeof SanctuaryColors;

// Single theme — no more toggling
export const Colors = SanctuaryColors;
export type ThemeName = 'sanctuary';
export const CurrentTheme: ThemeName = 'sanctuary';
export const Themes = { sanctuary: SanctuaryColors };

// ── Typography ───────────────────────────────────────────────
export const Typography = {
  // Font families (loaded via _layout.tsx)
  fontBold:         'PlusJakartaSans_800ExtraBold',
  fontSemiBold:     'PlusJakartaSans_700Bold',
  fontMedium:       'PlusJakartaSans_600SemiBold',
  fontRegular:      'PlusJakartaSans_500Medium',
  fontLight:        'PlusJakartaSans_400Regular',

  // Aliases kept for backward compat
  fontHeading:      'PlusJakartaSans_800ExtraBold',
  fontHeadingSemi:  'PlusJakartaSans_700Bold',
  fontBody:         'PlusJakartaSans_400Regular',
  fontBodyMedium:   'PlusJakartaSans_500Medium',
  fontBodySemiBold: 'PlusJakartaSans_600SemiBold',

  // Sizes
  xs:    11,
  sm:    13,
  base:  15,
  md:    16,
  lg:    20,
  xl:    24,
  xxl:   32,
  xxxl:  42,

  lineHeightNormal: 1.6,
};

// ── Spacing ──────────────────────────────────────────────────
export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
};

// ── Border Radius ─────────────────────────────────────────────
export const BorderRadius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  xxl:  24,
  full: 9999,
};

// ── Stress Level Helpers ──────────────────────────────────────
export const StressLevel = {
  getColor:   (l: number) => (l <= 3 ? Colors.stressLow  : l <= 6 ? Colors.stressMid  : Colors.stressHigh),
  getBgColor: (l: number) => (l <= 3 ? Colors.stressLowBg : l <= 6 ? Colors.stressMidBg : Colors.stressHighBg),
  getLabel:   (l: number) => (l <= 3 ? 'Baik' : l <= 6 ? 'Perlu Perhatian' : l <= 8 ? 'Cukup Berat' : 'Butuh Bantuan'),
  getEmoji:   (l: number) => (l <= 3 ? '🌿' : l <= 6 ? '🌤️' : l <= 8 ? '⛈️' : '🆘'),
};
