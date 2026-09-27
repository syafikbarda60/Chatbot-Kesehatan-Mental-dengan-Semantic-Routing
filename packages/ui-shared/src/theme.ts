// ============================================================
// constants/theme.ts — Sajiwa Design System
// Based on Material 3 color scheme: primary #496175
// ============================================================

// ── Color Palette ────────────────────────────────────────────
export const SajiwaColors = {
  // Core (Background: FFF2F2)
  background:              '#FFF2F2',
  surface:                 '#FFF2F2',
  surfaceBright:           '#FFFFFF',
  surfaceDim:              '#F5E6E6',
  surfaceVariant:          '#A9B5DF', // The light blue from palette

  // Surface containers (Neumorphism base)
  surfaceContainerLowest:  '#FFF2F2',
  surfaceContainerLow:     '#FFF2F2',
  surfaceContainer:        '#FFF2F2',
  surfaceContainerHigh:    '#F2E5E5',
  surfaceContainerHighest: '#E5D8D8',

  // Primary (Navy: 2D336B)
  primary:                 '#2D336B',
  primaryDim:              '#1E234A',
  primaryFixed:            '#7886C7',
  primaryFixedDim:         '#5A669A',
  primaryContainer:        '#A9B5DF',
  onPrimary:               '#FFF2F2',
  onPrimaryFixed:          '#FFF2F2',
  onPrimaryFixedVariant:   '#FFF2F2',
  onPrimaryContainer:      '#2D336B',

  // Secondary (Indigo: 7886C7)
  secondary:               '#7886C7',
  secondaryDim:            '#5A669A',
  secondaryFixed:          '#A9B5DF',
  secondaryFixedDim:       '#8B98C2',
  secondaryContainer:      '#E3E8FF',
  onSecondary:             '#FFF2F2',
  onSecondaryFixed:        '#2D336B',
  onSecondaryFixedVariant: '#2D336B',
  onSecondaryContainer:    '#2D336B',

  // Tertiary (Light Blue: A9B5DF)
  tertiary:                '#A9B5DF',
  tertiaryDim:             '#8B98C2',
  tertiaryFixed:           '#FFF2F2',
  tertiaryFixedDim:        '#E3E8FF',
  tertiaryContainer:       '#E3E8FF',
  onTertiary:              '#2D336B',
  onTertiaryFixed:         '#2D336B',
  onTertiaryFixedVariant:  '#2D336B',
  onTertiaryContainer:     '#2D336B',

  // On-colors (Text)
  onBackground:            '#2D336B',
  onSurface:               '#2D336B',
  onSurfaceVariant:        '#5A669A', // 5.1:1 on background (was #7886C7, 3.2:1)

  // Outline
  outline:                 '#A9B5DF',
  outlineVariant:          '#D1D8F0',

  // Error
  error:                   '#9f403d',
  errorDim:                '#4e0309',
  errorContainer:          '#fe8983',
  onError:                 '#fff7f6',
  onErrorContainer:        '#752121',

  // Inverse
  inverseSurface:          '#2D336B',
  inverseOnSurface:        '#FFF2F2',
  inversePrimary:          '#A9B5DF',

  // Surface tint
  surfaceTint:             '#7886C7',

  // Convenience aliases
  card:                    '#FFF2F2',
  cardAlt:                 '#FFF2F2',
  border:                  '#A9B5DF',
  borderLight:             '#E3E8FF',
  divider:                 'rgba(169, 181, 223, 0.3)',
  textPrimary:             '#2D336B',
  textSecondary:           '#5A669A',
  textMuted:               '#6E78A8', // 3.9:1, hints/timestamps only
  white:                   '#ffffff',
  black:                   '#000000',
  overlay:                 'rgba(45, 51, 107, 0.4)',

  // Tab bar
  tabActive:               '#2D336B',
  tabInactive:             '#5A669A',
  tabBar:                  '#FFF2F2',

  // Stress / mood indicators (keeping functional colors but adjusted slightly to blend)
  stressLow:               '#7886C7', // Repurposed for low stress to match theme
  stressMid:               '#8A6710', // darkened amber, readable as text
  stressHigh:              '#9f403d',
  stressLowBg:             'rgba(120, 134, 199, 0.12)',
  stressMidBg:             'rgba(212,168,67,0.12)',
  stressHighBg:            'rgba(159,64,61,0.12)',

  // Gradient helpers
  primaryGradientStart:    '#7886C7',
  primaryGradientEnd:      '#2D336B',

  // Neumorphism light sources (top-left light, bottom-right shade)
  neuLight:                'rgba(255, 255, 255, 0.95)',
  neuDark:                 'rgba(166, 128, 140, 0.32)',
};

// ── Neumorphic surfaces ───────────────────────────────────────
// Uses the `boxShadow` style (RN new architecture + web). Two shadows fake the light source.
export const Neu = {
  raised:  `-6px -6px 14px ${SajiwaColors.neuLight}, 6px 6px 14px ${SajiwaColors.neuDark}`,
  raisedSm:`-3px -3px 8px ${SajiwaColors.neuLight}, 3px 3px 8px ${SajiwaColors.neuDark}`,
  inset:   `inset 4px 4px 8px ${SajiwaColors.neuDark}, inset -4px -4px 8px ${SajiwaColors.neuLight}`,
};

export type SajiwaColorKey = keyof typeof SajiwaColors;

// Single theme — no more toggling
export const Colors = SajiwaColors;
export type ThemeName = 'sajiwa';
export const CurrentTheme: ThemeName = 'sajiwa';
export const Themes = { sajiwa: SajiwaColors };

// ── Typography ───────────────────────────────────────────────
export const Typography = {
  // Font family: Plus Jakarta Sans (loaded in apps/mobile/app/_layout.tsx).
  // One humanist family, open letterforms, good legibility at small sizes.
  fontBold:         'PlusJakartaSans_700Bold',
  fontSemiBold:     'PlusJakartaSans_600SemiBold',
  fontMedium:       'PlusJakartaSans_500Medium',
  fontRegular:      'PlusJakartaSans_400Regular',
  fontLight:        'PlusJakartaSans_400Regular',

  // Aliases kept for backward compat
  fontSerif:        'PlusJakartaSans_700Bold',
  fontSerifItalic:  'PlusJakartaSans_700Bold_Italic',
  fontPhilosopher_700Bold: 'PlusJakartaSans_800ExtraBold',
  fontHeading:      'PlusJakartaSans_800ExtraBold',
  fontHeadingSemi:  'PlusJakartaSans_700Bold',
  fontBody:         'PlusJakartaSans_400Regular',
  fontBodyMedium:   'PlusJakartaSans_500Medium',
  fontBodySemiBold: 'PlusJakartaSans_600SemiBold',

  // Sizes
  xs:    12, // floor for readable text
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
// Supportive labels - non-clinical, actionable language
export const StressLevel = {
  getColor:   (l: number) => (l <= 3 ? Colors.stressLow  : l <= 6 ? Colors.stressMid  : Colors.stressHigh),
  getBgColor: (l: number) => (l <= 3 ? Colors.stressLowBg : l <= 6 ? Colors.stressMidBg : Colors.stressHighBg),
  getLabel:   (l: number) => (l <= 3 ? 'Kondisi Baik' : l <= 6 ? 'Butuh Perhatian' : l <= 8 ? 'Cukup Berat' : 'Butuh Dukungan'),
  getEmoji:   (l: number) => (l <= 3 ? '🌿' : l <= 6 ? '🌤️' : l <= 8 ? '⛈️' : '🆘'),
  
  // New supportive variants for chat room
  getSupportiveLabel: (l: number) => (l <= 3 ? 'Kondisi Baik' : l <= 6 ? 'Butuh Perhatian Ekstra' : 'Butuh Dukungan Sekarang'),
  getSupportiveMessage: (l: number) => 
    l <= 3 ? 'Kamu terlihat cukup tenang hari ini. Lanjutkan cerita kalau mau.'
    : l <= 6 ? 'Sepertinya hari ini agak berat. Itu wajar kok. Mau coba latihan napas?'
    : 'Kamu tidak sendirian. Ada yang bisa bantu. Tekan tombol di bawah atau lanjut cerita.',
};
