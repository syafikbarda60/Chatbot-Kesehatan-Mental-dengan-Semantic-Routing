import { Slot, router, usePathname } from 'expo-router';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useRef } from 'react';

const Colors = {
  sidebarBg: '#f1f4f9', 
  sidebarActiveItem: '#dde3eb',
  sidebarHoverItem: '#e4e8ef',
  
  textMuted: '#596067', 
  textStrong: '#356385', 
  
  primary: '#356385', 
  primaryText: '#f6f9ff',
  
  bgWhite: '#FFFFFF',
};

// NavItem Reaktif
const NavItem = ({ icon, label, active = false, onPress }: { icon: any, label: string, active?: boolean, onPress?: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => { Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, speed: 20 }).start(); };
  const onPressOut = () => { Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start(); };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable 
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={(state: any) => [
          styles.navItem, 
          active && styles.navItemActive, 
          state.hovered && !active && styles.navItemHovered,
        ]}
      >
        <MaterialIcons 
          name={icon} 
          size={20} 
          color={active ? Colors.textStrong : Colors.textMuted} 
        />
        <Text style={[styles.navText, active && styles.navTextActive]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

export default function DashboardLayout() {
  const pathname = usePathname();
  return (
    <View style={styles.container}>
      {/* Sidebar - MindGuard Admin */}
      <View style={styles.sidebar}>
        
        {/* Brand */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>MindGuard Admin</Text>
          <Text style={styles.logoSubText}>Mental Health Portal</Text>
        </View>

        {/* Menu Items */}
        <ScrollView style={styles.navMenu} contentContainerStyle={{ gap: 4 }}>
          <NavItem icon="dashboard"             label="Overview"            active={pathname === '/(dashboard)'}     onPress={() => router.push('/(dashboard)')} />
          <NavItem icon="event"                 label="Daftar Konsultasi"  active={pathname.includes('schedule')}   onPress={() => router.push('/(dashboard)/schedule')} />
          <NavItem icon="event-available"       label="Atur Ketersediaan"  active={pathname.includes('availability')} onPress={() => router.push('/(dashboard)/availability')} />
          <NavItem icon="analytics"             label="Student Insights"   active={false} />
          <NavItem icon="notifications-active" label="Alerts"             active={false} />
          <NavItem icon="psychology"            label="Consultations"      active={false} />
          <NavItem icon="assessment"            label="Reports"            active={false} />
        </ScrollView>

        {/* Bottom Section */}
        <View style={styles.bottomMenu}>
          <Pressable style={(state: any) => [
            styles.generateBtn,
            state.hovered && { opacity: 0.9 }
          ]}>
            <Text style={styles.generateBtnText}>Generate Report</Text>
          </Pressable>
          
          <NavItem icon="settings" label="Settings" />
          <NavItem icon="help" label="Support" />
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8f9fd', // Sanctuary Background
  },
  sidebar: {
    width: 256, 
    height: '100%',
    backgroundColor: Colors.sidebarBg,
    paddingVertical: 32,
    paddingHorizontal: 16,
    zIndex: 50,
  },
  logoContainer: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textStrong,
    letterSpacing: -0.5,
  },
  logoSubText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 2,
  },
  navMenu: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    transition: 'all 0.2s' as any,
  },
  navItemActive: {
    backgroundColor: Colors.sidebarActiveItem,
  },
  navItemHovered: {
    backgroundColor: Colors.sidebarHoverItem,
  },
  navText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  navTextActive: {
    color: Colors.textStrong,
    fontWeight: '600',
  },
  bottomMenu: {
    marginTop: 'auto',
    gap: 4,
  },
  generateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  generateBtnText: {
    color: Colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  main: {
    flex: 1,
    position: 'relative', 
    backgroundColor: '#f8f9fd'
  }
});
