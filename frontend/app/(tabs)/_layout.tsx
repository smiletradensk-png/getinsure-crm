import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../theme';

function AddLeadFAB() {
  return (
    <TouchableOpacity
      onPress={() => router.push('/add-lead')}
      style={styles.fabWrap}
      activeOpacity={0.85}
    >
      <View style={styles.fabCircle}>
        <MaterialCommunityIcons name="plus" size={28} color={C.navy} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.navy,
        tabBarInactiveTintColor: C.textLight,
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: C.white,
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 12,
          shadowColor: C.navy,
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          overflow: 'visible',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Center FAB — navigates to /add-lead */}
      <Tabs.Screen
        name="fab"
        options={{
          title: '',
          tabBarButton: () => <AddLeadFAB />,
        }}
      />

      <Tabs.Screen
        name="followups"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-check-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="dots-grid" size={size} color={color} />
          ),
        }}
      />

      {/* Hidden tabs — still accessible via router.push */}
      <Tabs.Screen name="pipeline" options={{ href: null }} />
      <Tabs.Screen name="ai"       options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    elevation: 10,
    shadowColor: C.gold,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
