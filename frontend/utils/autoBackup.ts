import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllLeadsLocal, saveLeadLocal, initializeDatabase } from './database';

const SAF = FileSystem.StorageAccessFramework;

const BACKUP_DIR_URI_KEY  = 'auto_backup_dir_uri';
const LAST_BACKUP_KEY     = 'auto_backup_last_time';
const SETUP_PROMPTED_KEY  = 'auto_backup_setup_prompted';
const BACKUP_NAME         = 'getinsure_backup'; // SAF createFileAsync takes name without extension

// ── Folder access ────────────────────────────────────────────────────────────

export const getBackupFolderUri = (): Promise<string | null> =>
  AsyncStorage.getItem(BACKUP_DIR_URI_KEY);

export const getLastBackupTime = (): Promise<string | null> =>
  AsyncStorage.getItem(LAST_BACKUP_KEY);

export const wasSetupPrompted = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(SETUP_PROMPTED_KEY)) === 'true';

export const markSetupPrompted = (): Promise<void> =>
  AsyncStorage.setItem(SETUP_PROMPTED_KEY, 'true');

export const clearBackupFolder = (): Promise<void> =>
  AsyncStorage.removeItem(BACKUP_DIR_URI_KEY);

// Opens the Android folder picker pre-navigated to Downloads.
// Returns true if the user granted access.
export const requestBackupFolderAccess = async (): Promise<boolean> => {
  try {
    const downloadsHint = SAF.getUriForDirectoryInRoot('Download');
    const result = await SAF.requestDirectoryPermissionsAsync(downloadsHint);
    if (result.granted) {
      await AsyncStorage.setItem(BACKUP_DIR_URI_KEY, result.directoryUri);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export const shouldAutoBackup = async (): Promise<boolean> => {
  const last = await AsyncStorage.getItem(LAST_BACKUP_KEY);
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > 23 * 60 * 60 * 1000;
};

// Find the backup file URI inside a SAF directory
const findBackupUri = async (dirUri: string): Promise<string | null> => {
  try {
    const files = await SAF.readDirectoryAsync(dirUri);
    return files.find(u => decodeURIComponent(u).includes(BACKUP_NAME)) ?? null;
  } catch {
    return null;
  }
};

// ── Backup ────────────────────────────────────────────────────────────────────

export const performAutoBackup = async (): Promise<{
  success: boolean;
  leadsCount?: number;
  error?: string;
}> => {
  try {
    const dirUri = await getBackupFolderUri();
    if (!dirUri) return { success: false, error: 'no_folder_set' };

    await initializeDatabase();
    const leads = getAllLeadsLocal();
    const content = JSON.stringify(
      { leads, backup_date: new Date().toISOString(), version: 1 },
      null,
      2,
    );

    // Delete old backup so we always have exactly one clean file
    const existing = await findBackupUri(dirUri);
    if (existing) {
      try { await SAF.deleteAsync(existing, { idempotent: true }); } catch {}
    }

    const fileUri = await SAF.createFileAsync(dirUri, BACKUP_NAME, 'application/json');
    await SAF.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    return { success: true, leadsCount: leads.length };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
};

// ── Restore ───────────────────────────────────────────────────────────────────

export const checkForBackupFile = async (): Promise<{
  found: boolean;
  leads?: any[];
  backupDate?: string;
}> => {
  try {
    const dirUri = await getBackupFolderUri();
    if (!dirUri) return { found: false };

    const backupUri = await findBackupUri(dirUri);
    if (!backupUri) return { found: false };

    const content = await SAF.readAsStringAsync(backupUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(content);
    const leads = Array.isArray(parsed.leads) ? parsed.leads : [];
    return { found: true, leads, backupDate: parsed.backup_date };
  } catch {
    return { found: false };
  }
};

export const restoreFromBackup = async (leads: any[]): Promise<{ restored: number }> => {
  await initializeDatabase();
  let restored = 0;
  for (const lead of leads) {
    try {
      const result = await saveLeadLocal(lead);
      if (result.success) restored++;
    } catch {}
  }
  return { restored };
};
