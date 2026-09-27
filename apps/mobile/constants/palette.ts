// Role-based palette helpers. Colors live in the theme (packages/ui-shared/src/theme.ts);
// this file only adds depth-scaled neumorphic shadows for places that need stronger/lighter depth.
import { SajiwaColors as C } from '@prototype/ui-shared';

export const TRI = {
  bg: C.background,
  ink: C.onSurface,
  sub: C.onSurfaceVariant,
  muted: C.textMuted,
  navy: C.primary, navyDeep: C.primaryDim,
  sage: C.sage, sageFill: C.sageFill,
  amber: C.amber, amberFill: C.amberFill,
  coral: C.coral, coralFill: C.coralFill,
  light: C.neuLight,
  dark: C.neuDark,
};

export const triRaised = (k = 1) =>
  `${-9 * k}px ${-9 * k}px ${20 * k}px ${TRI.light}, ${9 * k}px ${9 * k}px ${20 * k}px ${TRI.dark}`;
export const triInset = (k = 1) =>
  `inset ${6 * k}px ${6 * k}px ${12 * k}px ${TRI.dark}, inset ${-6 * k}px ${-6 * k}px ${12 * k}px ${TRI.light}`;
