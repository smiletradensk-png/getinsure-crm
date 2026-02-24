import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function WelcomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isLoggedIn = await AsyncStorage.getItem('userLoggedIn');
      
      setTimeout(() => {
        if (isLoggedIn === 'true') {
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      }, 1500);
    } catch (error) {
      console.error('Error checking auth:', error);
      router.replace('/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text variant="displayMedium" style={styles.title}>
          GETINSURE CRM
        </Text>
        <Text variant="titleMedium" style={styles.subtitle}>
          Premium Insurance CRM
        </Text>
        <ActivityIndicator size="large" color="#009688" style={styles.loader} />
        <Text variant="bodyMedium" style={styles.description}>
          Offline-First • OTP Login • Facebook Ads Integration
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
    marginBottom: 40,
  },
  loader: {
    marginVertical: 24,
  },
  description: {
    color: '#B2DFDB',
    textAlign: 'center',
  },
});
