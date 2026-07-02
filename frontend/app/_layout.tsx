import React, { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './theme';
import { requestNotificationPermissions } from '../utils/notifications';
import { initializeDatabase } from '../utils/database';
import { AppSettingsProvider, useAppSettings } from '../context/AppSettingsContext';

const scaleFonts = (fonts: Record<string, any>, scale: number): Record<string, any> => {
  if (scale === 1) return fonts;
  const result: Record<string, any> = {};
  for (const key of Object.keys(fonts)) {
    const f = fonts[key];
    if (f && typeof f === 'object' && 'fontSize' in f) {
      result[key] = {
        ...f,
        fontSize: Math.round(f.fontSize * scale),
        ...(f.lineHeight ? { lineHeight: Math.round(f.lineHeight * scale) } : {}),
      };
    } else {
      result[key] = f;
    }
  }
  return result;
};

function AppContent() {
  const { fontScale } = useAppSettings();
  const scaledTheme = useMemo(
    () => ({ ...theme, fonts: scaleFonts(theme.fonts as Record<string, any>, fontScale) }),
    [fontScale],
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={scaledTheme}>
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

export default function RootLayout() {
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        await requestNotificationPermissions();
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    init();
  }, []);

  return (
    <AppSettingsProvider>
      <AppContent />
    </AppSettingsProvider>
  );
}
