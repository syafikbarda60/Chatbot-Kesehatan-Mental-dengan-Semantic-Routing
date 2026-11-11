// components/ui/index.ts
// Barrel export — import any UI primitive from one place:
// import { Button, Divider, Badge, FadeIn } from '../components/ui';

export { Button }         from './Button';
export { Divider }        from './Divider';
export { Badge }          from './Badge';
export { FadeIn }         from './FadeIn';
export { default as BottomNav, BOTTOM_CLEARANCE, isSwipeTab, swipeTab, tabAnimation, useTabSwipeLock } from './BottomNav';

export * from './NeuView';
export * from './Dialog';
export * from './Card';
export * from './Button';
export * from './Input';
export * from './Tabs';export * from './IconButton';
export * from './ScreenHeader';
export * from './Toast';
export * from './usePressScale';
export * from './PressableScale';
export * from './ConsentSheet';
export * from './Calendar';
export { conversationTime, clockTime } from './calendarDates';
export * from './Fab';
export * from './haptics';
