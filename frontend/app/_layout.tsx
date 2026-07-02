import React, { useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './theme';
import { requestNotificationPermissions } from '../utils/notifications';
import { initializeDatabase, getAllLeadsLocal } from '../utils/database';
import { AppSettingsProvider, useAppSettings } from '../context/AppSettingsContext';
import {
  checkForBackupFile, restoreFromBackup, performAutoBackup,
  shouldAutoBackup, getBackupFolderUri, requestBackupFolderAccess,
  wasSetupPrompted, markSetupPrompted,
} from '../utils/autoBackup';

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

async function runStartupChecks() {
  // 1. If local DB is empty and a backup folder is configured, offer restore
  const leads = getAllLeadsLocal();
  if (leads.length === 0) {
    const dirUri = await getBackupFolderUri();
    if (dirUri) {
      const backup = await checkForBackupFile();
      if (backup.found && backup.leads && backup.leads.length > 0) {
        const dateStr = backup.backupDate
          ? new Date(backup.backupDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'unknown date';
        Alert.alert(
          'Backup Found',
          `Found a backup with ${backup.leads.length} leads saved on ${dateStr}.\n\nRestore your data now?`,
          [
            { text: 'Skip', style: 'cancel' },
            {
              text: 'Restore',
              onPress: async () => {
                const { restored } = await restoreFromBackup(backup.leads!);
                Alert.alert('Restored', `${restored} leads restored successfully.`);
              },
            },
          ],
          { cancelable: false },
        );
        return; // Don't show backup-setup prompt on same launch
      }
    }
  }

  // 2. First-time prompt: ask user to set up auto-backup folder (once only)
  const prompted = await wasSetupPrompted();
  const dirUri = await getBackupFolderUri();
  if (!prompted && !dirUri) {
    await markSetupPrompted();
    Alert.alert(
      'Auto Backup',
      'GETINSURE CRM can automatically save your leads to your Downloads folder every day.\n\nThis protects your data if you reinstall the app.\n\nSet it up now? (Takes 5 seconds)',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Set Up Now',
          onPress: async () => {
            const granted = await requestBackupFolderAccess();
            if (granted) {
              const result = await performAutoBackup();
              Alert.alert(
                'Auto Backup Ready',
                result.success
                  ? `Backup set up! ${result.leadsCount} leads saved to Downloads folder. It will update automatically every day.`
                  : 'Folder selected. Backup will run automatically.',
              );
            }
          },
        },
      ],
    );
    return;
  }

  // 3. Silent daily auto-backup (runs if folder is configured and 23h have passed)
  if (dirUri && (await shouldAutoBackup())) {
    performAutoBackup(); // fire-and-forget, no UI
  }
}

export default function RootLayout() {
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        await requestNotificationPermissions();
        // Small delay so navigation container is ready before any Alerts
        setTimeout(runStartupChecks, 1500);
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
