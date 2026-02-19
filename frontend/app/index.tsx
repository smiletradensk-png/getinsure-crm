import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  useEffect(() => {
    // Auto navigate to main app after 2 seconds
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text variant="displayMedium" style={styles.title}>
          GETINSURE CRM
        </Text>
        <Text variant="titleMedium" style={styles.subtitle}>
          Professional Insurance Advisor CRM
        </Text>
        <Text variant="bodyMedium" style={styles.description}>
          Manage leads, follow-ups, and close more deals
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#009688',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: '#E0F2F1',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    color: '#B2DFDB',
    textAlign: 'center',
  },
});
