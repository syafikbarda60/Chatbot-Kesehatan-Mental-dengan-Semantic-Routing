// components/ui/Tabs.tsx
// shadcn-style Segmented Tabs for React Native

import React, { createContext, useContext } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@prototype/ui-shared';
import { Typography, Spacing, BorderRadius } from '@prototype/ui-shared';

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = createContext<TabsContextValue>({
  value: '',
  onValueChange: () => {},
});

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  children,
  style,
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <View style={[styles.tabs, style]}>{children}</View>
    </TabsContext.Provider>
  );
};

export interface TabsListProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const TabsList: React.FC<TabsListProps> = ({ children, style }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.tabsList,
        {
          backgroundColor: colors.surfaceContainerLow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();
  const context = useContext(TabsContext);
  const isActive = context.value === value;

  return (
    <Pressable
      onPress={() => context.onValueChange(value)}
      style={[
        styles.trigger,
        isActive && [
          styles.activeTrigger,
          {
            backgroundColor: colors.surfaceContainerLowest,
          },
        ],
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            styles.triggerText,
            {
              color: isActive ? colors.onSurface : colors.onSurfaceVariant,
              fontFamily: isActive
                ? 'PlusJakartaSans_700Bold'
                : 'PlusJakartaSans_500Medium',
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
};

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  style,
}) => {
  const context = useContext(TabsContext);
  if (context.value !== value) return null;

  return <View style={[styles.tabsContent, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  tabs: {
    width: '100%',
  },
  tabsList: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: BorderRadius.xl,
    gap: 4,
  },
  trigger: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTrigger: {},
  triggerText: {
    fontSize: Typography.xs + 1,
    letterSpacing: 0.1,
  },
  tabsContent: {
    marginTop: Spacing.base,
  },
});

export default Tabs;
