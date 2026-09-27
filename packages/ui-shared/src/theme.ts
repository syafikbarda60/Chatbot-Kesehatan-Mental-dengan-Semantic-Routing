// ============================================================
// constants/theme.ts — Sajiwa Design System
// Based on Material 3 color scheme: primary #496175
// ============================================================

// ── Color Palette ────────────────────────────────────────────
export const SajiwaColors = {
  // Role-based palette (2026-09-27). One neumorphic surface; each accent means a feature:
  // navy = Sajiwa/chat/primary, sage = journal, amber = counseling, coral = crisis only.
  // Text contrast on background: ink 12.3:1, sub 5.7:1, navy 9.4:1, sage 5.0:1,
  // amber 4.0:1 (bold/large + icons), coral 4.4:1 (bold/large + icons). *Fill tokens are decorative only.
  background:              '#E4E8EE',
  surface:                 '#E4E8EE',
  surfaceBright:           '#EEF1F7',
  surfaceDim:              '#D8DDE6',
  surfaceVariant:          '#C9D0DE',

  // Surface containers (Neumorphism base)
  surfaceContainerLowest:  '#E4E8EE',
  surfaceContainerLow:     '#E4E8EE',
  surfaceContainer:        '#E4E8EE',
  surfaceContainerHigh:    '#DADFE8',
  surfaceContainerHighest: '#CFD5E0',

  // Primary: navy (Sajiwa, chat)
  primary:                 '#26356E',
  primaryDim:              '#1B2757',
  primaryFixed:            '#5B6AA8',
  primaryFixedDim:         '#3F4E8A',
  primaryContainer:        '#C9D0E6',
  onPrimary:               '#FFFFFF',
  onPrimaryFixed:          '#FFFFFF',
  onPrimaryFixedVariant:   '#FFFFFF',
  onPrimaryContainer:      '#1B2757',

  // Feature accents
  sage:                    '#2F6B5F', // journal
  sageFill:                '#DCE7E2',
  amber:                   '#9A6420', // counseling (text/icons/buttons)
  amberFill:               '#D4964A', // decorative fill only
  coral:                   '#B24A33', // crisis only (text/icons/buttons)
  coralFill:               '#D9674E', // decorative fill only

  // Secondary / tertiary kept for components that still reference them
  secondary:               '#5B6AA8',
  secondaryDim:            '#3F4E8A',
  secondaryFixed:          '#C9D0E6',
  secondaryFixedDim:       '#A9B3D3',
  secondaryContainer:      '#D8DDEE',
  onSecondary:             '#FFFFFF',
  onSecondaryFixed:        '#1B2757',
  onSecondaryFixedVariant: '#1B2757',
  onSecondaryContainer:    '#1B2757',
  tertiary:                '#2F6B5F',
  tertiaryDim:             '#245449',
  tertiaryFixed:           '#DCE7E2',
  tertiaryFixedDim:        '#C4D6CE',
  tertiaryContainer:       '#DCE7E2',
  onTertiary:              '#FFFFFF',
  onTertiaryFixed:         '#17302C',
  onTertiaryFixedVariant:  '#17302C',
  onTertiaryContainer:     '#17302C',

  // On-colors (Text)
  onBackground:            '#1C2447',
  onSurface:               '#1C2447',
  onSurfaceVariant:        '#4E5876',

  // Outline
  outline:                 '#9AA3BA',
  outlineVariant:          '#C3C9D6',

  // Error
  error:                   '#B24A33',
  errorDim:                '#7A2E1F',
  errorContainer:          '#F2D3CB',
  onError:                 '#FFFFFF',
  onErrorContainer:        '#7A2E1F',

  // Inverse
  inverseSurface:          '#1C2447',
  inverseOnSurface:        '#E4E8EE',
  inversePrimary:          '#C9D0E6',

  // Surface tint
  surfaceTint:             '#26356E',

  // Convenience aliases
  card:                    '#E4E8EE',
  cardAlt:                 '#E4E8EE',
  border:                  '#C3C9D6',
  borderLight:             '#D8DDE6',
  divider:                 'rgba(122, 134, 168, 0.3)',
  textPrimary:             '#1C2447',
  textSecondary:           '#4E5876',
  textMuted:               '#6B7390', // hints/timestamps only
  white:                   '#ffffff',
  black:                   '#000000',
  overlay:                 'rgba(20, 26, 50, 0.45)',

  // Tab bar
  tabActive:               '#26356E',
  tabInactive:             '#4E5876',
  tabBar:                  '#E4E8EE',

  // Stress / mood indicators
  stressLow:               '#2F6B5F',
  stressMid:               '#9A6420',
  stressHigh:              '#B24A33',
  stressLowBg:             'rgba(47, 107, 95, 0.12)',
  stressMidBg:             'rgba(154, 100, 32, 0.12)',
  stressHighBg:            'rgba(178, 74, 51, 0.12)',

  // Gradient helpers
  primaryGradientStart:    '#3F4E8A',
  primaryGradientEnd:      '#26356E',

  // Neumorphism light sources (top-left light, bottom-right shade)
  neuLight:                'rgba(255, 255, 255, 0.95)',
  neuDark:                 'rgba(122, 134, 168, 0.5)',
};

// ── Neumorphic surfaces ───────────────────────────────────────
// Uses the `boxShadow` style (RN new architecture + web). Two shadows fake the light source.
export const Neu = {
  // Bolder depth than the first pass: the mid-tone surface lets both shadows read clearly
  raised:  `-9px -9px 20px ${SajiwaColors.neuLight}, 9px 9px 20px ${SajiwaColors.neuDark}`,
  raisedSm:`-5px -5px 11px ${SajiwaColors.neuLight}, 5px 5px 11px ${SajiwaColors.neuDark}`,
  inset:   `inset 6px 6px 12px ${SajiwaColors.neuDark}, inset -6px -6px 12px ${SajiwaColors.neuLight}`,
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
