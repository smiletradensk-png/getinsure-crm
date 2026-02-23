import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './theme';
import { useEffect } from 'react';
import { requestNotificationPermissions } from '../utils/notifications';

export default function RootLayout() {
  useEffect(() => {
    // Request notification permissions on app start
    requestNotificationPermissions();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lead-detail" />
          <Stack.Screen name="add-lead" />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
