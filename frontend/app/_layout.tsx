import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './theme';
import { useEffect } from 'react';
import { requestNotificationPermissions } from '../utils/notifications';
import { initializeDatabase } from '../utils/database';
import { initializeNetworkMonitoring } from '../utils/syncManager';

export default function RootLayout() {
  useEffect(() => {
    // Initialize app services
    const initializeApp = async () => {
      try {
        // Initialize SQLite database
        initializeDatabase();
        console.log('✅ Database initialized');
        
        // Request notification permissions
        await requestNotificationPermissions();
        console.log('✅ Notification permissions requested');
        
        // Start network monitoring and auto-sync
        initializeNetworkMonitoring();
        console.log('✅ Network monitoring started');
        
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    
    initializeApp();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lead-detail" />
          <Stack.Screen name="add-lead" />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
