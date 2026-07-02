import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity,
  Modal, TextInput as RNTextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, Card, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllLeadsLocal, initializeDatabase, saveLeadLocal,
} from '../../utils/database';
import { useAppSettings, type FontSize } from '../../context/AppSettingsContext';
import {
  syncFacebookLeads, saveFbWebhookConfig, getFbWebhookConfig, getLastSyncTime,
} from '../../utils/facebookSync';
import {
  getBackupFolderUri, getLastBackupTime, requestBackupFolderAccess,
  performAutoBackup, checkForBackupFile, restoreFromBackup, clearBackupFolder,
} from '../../utils/autoBackup';

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(parseCSVLine);
}

function csvField(value: string | undefined | null): string {
  const v = (value ?? '').toString().replace(/"/g, '""');
  return `"${v}"`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const FONT_SIZE_OPTIONS: { label: string; size: FontSize; samplePx: number }[] = [
  { label: 'Small',  size: 'small',  samplePx: 13 },
  { label: 'Normal', size: 'medium', samplePx: 16 },
  { label: 'Large',  size: 'large',  samplePx: 20 },
  { label: 'XL',     size: 'xlarge', samplePx: 25 },
];

export default function SettingsScreen() {
  const [userPhone, setUserPhone] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showFbGuide, setShowFbGuide] = useState(false);
  const { fontSize, setFontSize } = useAppSettings();

  // Edit-profile modal
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editPhone, setEditPhone] = useState('');

  // Facebook live-leads webhook
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookKey, setWebhookKey] = useState('');
  const [fbSyncing, setFbSyncing] = useState(false);
  const [lastFbSync, setLastFbSync] = useState('');
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  // Auto backup
  const [backupFolderSet, setBackupFolderSet] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState('');
  const [backupInProgress, setBackupInProgress] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const phone = await AsyncStorage.getItem('userPhone');
      setUserPhone(phone || '');
      const { serverUrl, appKey } = await getFbWebhookConfig();
      setWebhookUrl(serverUrl || '');
      setWebhookKey(appKey || '');
      const last = await getLastSyncTime();
      if (last !== '1970-01-01T00:00:00.000Z') setLastFbSync(last);
      // Auto backup status
      const dirUri = await getBackupFolderUri();
      setBackupFolderSet(!!dirUri);
      const lastBk = await getLastBackupTime();
      if (lastBk) setLastBackupTime(lastBk);
    } catch {}
  };

  const handleSetupBackup = async () => {
    Alert.alert(
      'Choose Backup Folder',
      'Pick a folder where GETINSURE CRM will save daily backups. We recommend selecting the Downloads folder.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Folder',
          onPress: async () => {
            const granted = await requestBackupFolderAccess();
            if (granted) {
              setBackupFolderSet(true);
              setBackupInProgress(true);
              const result = await performAutoBackup();
              setBackupInProgress(false);
              if (result.success) {
                const t = new Date().toISOString();
                setLastBackupTime(t);
                Alert.alert('Backup Ready', `${result.leadsCount} leads backed up to your chosen folder. Auto-backup will run daily.`);
              } else {
                Alert.alert('Folder Set', 'Backup folder saved. Auto-backup will run on next app open.');
              }
            }
          },
        },
      ],
    );
  };

  const handleBackupNow = async () => {
    setBackupInProgress(true);
    const result = await performAutoBackup();
    setBackupInProgress(false);
    if (result.success) {
      const t = new Date().toISOString();
      setLastBackupTime(t);
      Alert.alert('Backup Complete', `${result.leadsCount} leads saved to Downloads folder.`);
    } else {
      Alert.alert('Backup Failed', result.error === 'no_folder_set'
        ? 'No backup folder selected. Tap "Setup" first.'
        : (result.error ?? 'Unknown error. Please try again.'));
    }
  };

  const handleRestoreFromBackup = async () => {
    const backup = await checkForBackupFile();
    if (!backup.found || !backup.leads || backup.leads.length === 0) {
      Alert.alert('No Backup Found', 'No backup file was found in the selected folder.');
      return;
    }
    const dateStr = backup.backupDate
      ? new Date(backup.backupDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'unknown date';
    Alert.alert(
      'Restore Backup',
      `Found ${backup.leads.length} leads from ${dateStr}. Restore them now? Existing leads will not be removed — duplicates are automatically skipped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setBackupInProgress(true);
            const { restored } = await restoreFromBackup(backup.leads!);
            setBackupInProgress(false);
            Alert.alert('Done', `${restored} leads restored successfully.`);
          },
        },
      ],
    );
  };

  const handleRemoveBackupFolder = () => {
    Alert.alert(
      'Remove Backup Folder',
      'This will stop daily auto-backup. Your existing backup file in Downloads will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await clearBackupFolder();
            setBackupFolderSet(false);
            setLastBackupTime('');
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['userLoggedIn', 'userPhone']);
          setUserPhone('');
          router.replace('/login');
        },
      },
    ]);
  };

  const saveProfile = async () => {
    const phone = editPhone.trim().replace(/\D/g, '').slice(0, 10);
    await AsyncStorage.setItem('userPhone', phone);
    setUserPhone(phone);
    setEditProfileVisible(false);
  };

  const handleFbSyncNow = async () => {
    if (!webhookUrl || !webhookKey) {
      Alert.alert('Not Configured', 'Please save your webhook server URL and App Key first.');
      return;
    }
    setFbSyncing(true);
    const result = await syncFacebookLeads();
    setFbSyncing(false);
    if (result.error) {
      Alert.alert('Sync Failed', result.error);
    } else {
      const last = await getLastSyncTime();
      setLastFbSync(last);
      Alert.alert('Sync Complete', result.synced > 0
        ? `✅ ${result.synced} new lead${result.synced !== 1 ? 's' : ''} imported from Facebook!`
        : 'No new leads since last sync.');
    }
  };

  const saveWebhookConfig = async () => {
    await saveFbWebhookConfig(webhookUrl.trim(), webhookKey.trim());
    Alert.alert('Saved', 'Webhook config saved. Tap "Sync Now" to test.');
    setShowWebhookConfig(false);
  };

  // ── Export CSV ──────────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await initializeDatabase();
      const leads = getAllLeadsLocal();
      if (leads.length === 0) {
        Alert.alert('No Data', 'No leads to export.');
        return;
      }

      const headers = 'Name,Mobile,Product,Status,Source,City,Notes,Next Followup Date,Next Followup Time';
      const rows = leads.map((lead: any) =>
        [
          lead.name, lead.mobile, lead.product, lead.status,
          lead.source, lead.city, lead.notes,
          lead.next_followup_date, lead.next_followup_time,
        ].map(csvField).join(',')
      );

      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const csvContent = '﻿' + headers + '\n' + rows.join('\n');
      const fileUri = dir + `getinsure_leads_${Date.now()}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Share ${leads.length} Leads (CSV)`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Exported', `File saved to:\n${fileUri}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ── Export JSON ─────────────────────────────────────────────────────────────

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      await initializeDatabase();
      const leads = getAllLeadsLocal();
      if (leads.length === 0) {
        Alert.alert('No Data', 'No leads to export.');
        return;
      }

      const jsonContent = JSON.stringify({ leads, exported_at: new Date().toISOString() }, null, 2);
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const fileUri = dir + `getinsure_leads_${Date.now()}.json`;

      await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: `Share ${leads.length} Leads (JSON)`,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export JSON.');
    } finally {
      setExporting(false);
    }
  };

  // ── Download Sample CSV ─────────────────────────────────────────────────────

  const handleDownloadSampleCSV = async () => {
    try {
      const sampleCSV =
        'Name,Mobile,Product,Status,Source,City,Notes\n' +
        '"Rahul Sharma","9876543210","Health Insurance","New","Facebook Ads","Mumbai","Interested in family floater plan"\n' +
        '"Priya Patel","8765432109","Term Insurance","Interested","Referral","Pune","Looking for 1 crore cover"\n' +
        '"Amit Kumar","7654321098","Motor Insurance","Follow-up","Walk-in","Delhi","Car insurance renewal next month"';

      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const fileUri = dir + 'sample_import_format.csv';
      await FileSystem.writeAsStringAsync(fileUri, '﻿' + sampleCSV, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Save Sample CSV File',
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to create sample file.');
    }
  };

  // ── Import CSV ──────────────────────────────────────────────────────────────

  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      // Reject obvious non-CSV files
      const name = file.name?.toLowerCase() ?? '';
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        Alert.alert(
          'Wrong Format',
          'Please open the Excel file, go to File → Save As → CSV format (.csv), then import that file.',
        );
        return;
      }

      setImporting(true);

      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Strip BOM if present
      const cleanContent = content.replace(/^﻿/, '');
      const rows = parseCSV(cleanContent);

      if (rows.length < 2) {
        Alert.alert('Error', 'File appears empty or has only headers.');
        setImporting(false);
        return;
      }

      // Detect header row → find column indices
      const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
      const col = (keys: string[]) => {
        for (const k of keys) {
          const idx = header.findIndex(h => h.includes(k));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // Support both our own export format AND common Facebook/other formats
      const nameIdx    = col(['name', 'fullname', 'customerfullname']) !== -1
        ? col(['name', 'fullname', 'customerfullname']) : 0;
      const mobileIdx  = col(['mobile', 'phone', 'contact', 'number'])  !== -1
        ? col(['mobile', 'phone', 'contact', 'number'])  : 1;
      const productIdx = col(['product', 'insurance', 'service'])        !== -1
        ? col(['product', 'insurance', 'service'])        : 2;
      const statusIdx  = col(['status'])                                  !== -1
        ? col(['status'])                                  : 3;
      const sourceIdx  = col(['source', 'leadsource'])                   !== -1
        ? col(['source', 'leadsource'])                   : 4;
      const cityIdx    = col(['city', 'location', 'area'])               !== -1
        ? col(['city', 'location', 'area'])                : 5;
      const notesIdx   = col(['notes', 'note', 'remark', 'comment'])     !== -1
        ? col(['notes', 'note', 'remark', 'comment'])      : 6;

      let imported = 0;
      let skipped = 0;

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        const name   = nameIdx   >= 0 ? (cols[nameIdx]   || '') : '';
        const mobile = mobileIdx >= 0 ? (cols[mobileIdx] || '') : '';

        if (!name && !mobile) { skipped++; continue; }

        try {
          await saveLeadLocal({
            id: `import_${Date.now()}_${i}`,
            name:   name   || 'Unknown',
            mobile: mobile || '',
            product: productIdx >= 0 ? (cols[productIdx] || 'General Insurance') : 'General Insurance',
            status:  statusIdx  >= 0 ? (cols[statusIdx]  || 'New')              : 'New',
            source:  sourceIdx  >= 0 ? (cols[sourceIdx]  || 'Import')           : 'Import',
            city:    cityIdx    >= 0 ? (cols[cityIdx]    || '')                 : '',
            notes:   notesIdx   >= 0 ? (cols[notesIdx]   || '')                 : '',
            created_at:  new Date().toISOString(),
            updated_at:  new Date().toISOString(),
          });
          imported++;
        } catch {
          skipped++;
        }
      }

      Alert.alert(
        'Import Complete',
        `✅ Imported: ${imported} lead${imported !== 1 ? 's' : ''}\n⏭ Skipped: ${skipped} row${skipped !== 1 ? 's' : ''}`,
      );
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to read the file. Make sure it is a valid CSV.');
    } finally {
      setImporting(false);
    }
  };

  // ── Backup ──────────────────────────────────────────────────────────────────

  const handleBackup = async () => {
    try {
      await initializeDatabase();
      const leads = getAllLeadsLocal();
      const backup = JSON.stringify({ leads, backup_date: new Date().toISOString() }, null, 2);
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const fileUri = dir + `getinsure_backup_${Date.now()}.json`;

      await FileSystem.writeAsStringAsync(fileUri, backup, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save Backup to Drive / WhatsApp',
        });
      }
      Alert.alert('Backup Ready', `${leads.length} leads included. Share to Google Drive or WhatsApp.`);
    } catch {
      Alert.alert('Error', 'Failed to create backup.');
    }
  };

  // (Danger Zone removed)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>Settings</Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>Preferences & Data Management</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>

          {/* ── Account ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="account-circle" size={32} color="#009688" />
                <Text variant="titleLarge" style={styles.cardTitle}>Account</Text>
              </View>

              <TouchableOpacity
                style={styles.profileRow}
                onPress={() => { setEditPhone(userPhone); setEditProfileVisible(true); }}
                activeOpacity={0.7}
              >
                <View style={styles.profileInfo}>
                  {userPhone ? (
                    <>
                      <Text variant="bodyLarge" style={styles.phoneNumber}>+91 {userPhone}</Text>
                      <Text variant="bodySmall" style={{ color: '#757575' }}>
                        All data stored locally on this device
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text variant="bodyMedium" style={{ color: '#9E9E9E' }}>
                        Tap to set your phone number
                      </Text>
                      <Text variant="bodySmall" style={{ color: '#BDBDBD' }}>
                        Not required — data is always saved locally
                      </Text>
                    </>
                  )}
                </View>
                <MaterialCommunityIcons name="pencil-outline" size={20} color="#009688" />
              </TouchableOpacity>

              {userPhone ? (
                <Button
                  mode="text"
                  onPress={handleLogout}
                  icon="logout"
                  textColor="#F44336"
                  style={{ marginTop: 4, alignSelf: 'flex-start' }}
                  compact
                >
                  Logout
                </Button>
              ) : null}
            </Card.Content>
          </Card>

          {/* ── Edit Profile Modal ── */}
          <Modal
            visible={editProfileVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setEditProfileVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalOverlay}
            >
              <View style={styles.editModal}>
                <Text style={styles.editModalTitle}>Set Your Phone Number</Text>
                <Text style={styles.editModalSubtitle}>Used to display your profile in Settings</Text>
                <RNTextInput
                  style={styles.editModalInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#9E9E9E"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  autoFocus
                />
                <View style={styles.editModalButtons}>
                  <Button mode="text" onPress={() => setEditProfileVisible(false)} textColor="#757575">
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={saveProfile}
                    buttonColor="#009688"
                    disabled={editPhone.replace(/\D/g, '').length < 10}
                  >
                    Save
                  </Button>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* ── Display / Font Size ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="format-size" size={32} color="#7B1FA2" />
                <Text variant="titleLarge" style={styles.cardTitle}>Display</Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Adjust text size across the entire app
              </Text>
              <View style={styles.fontSizeRow}>
                {FONT_SIZE_OPTIONS.map(({ label, size, samplePx }) => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setFontSize(size)}
                    style={[styles.fontSizeBtn, fontSize === size && styles.fontSizeBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.fontSizeSample, { fontSize: samplePx }]}>A</Text>
                    <Text style={[styles.fontSizeLabel, fontSize === size && styles.fontSizeLabelActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card.Content>
          </Card>

          {/* ── Import / Export ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="microsoft-excel" size={32} color="#217346" />
                <Text variant="titleLarge" style={styles.cardTitle}>Import / Export</Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Import leads from CSV or share your data via WhatsApp / Google Drive
              </Text>

              <Button
                mode="outlined"
                onPress={handleDownloadSampleCSV}
                icon="file-download"
                textColor="#009688"
                style={styles.button}
              >
                Download Sample CSV Format
              </Button>

              <Button
                mode="contained"
                onPress={handleImportCSV}
                icon="file-import"
                loading={importing}
                disabled={importing || exporting}
                buttonColor="#217346"
                style={styles.button}
              >
                {importing ? 'Importing…' : 'Import from CSV'}
              </Button>

              <View style={styles.exportButtons}>
                <Button
                  mode="contained"
                  onPress={handleExportCSV}
                  icon="file-delimited"
                  loading={exporting}
                  disabled={exporting || importing}
                  buttonColor="#009688"
                  style={styles.halfButton}
                >
                  Export CSV
                </Button>
                <Button
                  mode="contained"
                  onPress={handleExportJSON}
                  icon="code-json"
                  loading={exporting}
                  disabled={exporting || importing}
                  buttonColor="#00796B"
                  style={styles.halfButton}
                >
                  Export JSON
                </Button>
              </View>

              <Text variant="bodySmall" style={styles.noteText}>
                CSV format: Name, Mobile, Product, Status, Source, City, Notes
              </Text>
            </Card.Content>
          </Card>

          {/* ── Auto Backup (Downloads folder) ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="folder-download" size={32} color="#4CAF50" />
                <Text variant="titleLarge" style={styles.cardTitle}>Auto Backup</Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Automatically saves leads to your Downloads folder daily. Restores data after reinstall.
              </Text>

              <View style={styles.syncStatusRow}>
                <MaterialCommunityIcons
                  name={backupFolderSet ? 'check-circle' : 'circle-outline'}
                  size={18}
                  color={backupFolderSet ? '#4CAF50' : '#BDBDBD'}
                />
                <Text style={[styles.syncStatusText, { color: backupFolderSet ? '#4CAF50' : '#9E9E9E' }]}>
                  {backupFolderSet
                    ? (lastBackupTime
                        ? `Last backup: ${new Date(lastBackupTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : 'Folder set — not backed up yet')
                    : 'Not configured — tap Setup to enable'}
                </Text>
              </View>

              {!backupFolderSet ? (
                <Button
                  mode="contained"
                  onPress={handleSetupBackup}
                  icon="folder-open"
                  buttonColor="#4CAF50"
                  loading={backupInProgress}
                  disabled={backupInProgress}
                  style={styles.button}
                >
                  Setup Auto Backup
                </Button>
              ) : (
                <>
                  <View style={styles.exportButtons}>
                    <Button
                      mode="contained"
                      onPress={handleBackupNow}
                      icon="content-save"
                      buttonColor="#4CAF50"
                      loading={backupInProgress}
                      disabled={backupInProgress}
                      style={styles.halfButton}
                    >
                      Backup Now
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={handleRestoreFromBackup}
                      icon="restore"
                      textColor="#4CAF50"
                      disabled={backupInProgress}
                      style={styles.halfButton}
                    >
                      Restore
                    </Button>
                  </View>
                  <Button
                    mode="text"
                    onPress={handleRemoveBackupFolder}
                    icon="folder-remove"
                    textColor="#9E9E9E"
                    style={{ marginTop: 4 }}
                    compact
                  >
                    Change / Remove Folder
                  </Button>
                </>
              )}

              <Text variant="bodySmall" style={styles.noteText}>
                Backup file: getinsure_backup.json in your chosen folder
              </Text>
            </Card.Content>
          </Card>

          {/* ── Manual Backup (share) ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="backup-restore" size={32} color="#2196F3" />
                <Text variant="titleLarge" style={styles.cardTitle}>Share Backup</Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Manually share a backup file to WhatsApp, Google Drive, or email
              </Text>
              <Button
                mode="contained"
                onPress={handleBackup}
                icon="cloud-upload"
                buttonColor="#2196F3"
                style={styles.button}
              >
                Share Backup Now
              </Button>
            </Card.Content>
          </Card>

          {/* ── Facebook Ads Guide ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="facebook" size={32} color="#1877F2" />
                <Text variant="titleLarge" style={styles.cardTitle}>Facebook Lead Ads</Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Export leads from Facebook Ads Manager and import them here as CSV.
              </Text>

              <TouchableOpacity
                style={styles.guideToggle}
                onPress={() => setShowFbGuide(v => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.guideToggleText}>
                  {showFbGuide ? 'Hide step-by-step guide' : 'Show step-by-step guide'}
                </Text>
                <MaterialCommunityIcons
                  name={showFbGuide ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#1877F2"
                />
              </TouchableOpacity>

              {showFbGuide && (
                <View style={styles.guideBox}>

                  <Text style={styles.guideSection}>📥 Method 1 — Download CSV from Ads Manager</Text>

                  <View style={styles.guideStep}>
                    <Text style={styles.guideNum}>1</Text>
                    <Text style={styles.guideText}>
                      Open <Text style={styles.guideBold}>ads.facebook.com</Text> or the
                      {' '}<Text style={styles.guideBold}>Meta Business Suite</Text> app on your phone.
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <Text style={styles.guideNum}>2</Text>
                    <Text style={styles.guideText}>
                      Go to your <Text style={styles.guideBold}>Lead Ads campaign</Text> → click the
                      ad set or ad that collects leads.
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <Text style={styles.guideNum}>3</Text>
                    <Text style={styles.guideText}>
                      Click <Text style={styles.guideBold}>Download Leads</Text> (or go to your
                      Facebook Page → Publishing Tools → Forms Library → Download).
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <Text style={styles.guideNum}>4</Text>
                    <Text style={styles.guideText}>
                      Select a <Text style={styles.guideBold}>date range</Text> and click
                      {' '}<Text style={styles.guideBold}>Download as CSV</Text>.
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <Text style={styles.guideNum}>5</Text>
                    <Text style={styles.guideText}>
                      Open the CSV in Excel or Google Sheets. Rename the columns to match our format:
                      {'\n'}
                      <Text style={styles.guideMono}>
                        Name | Mobile | Product | Status | Source | City | Notes
                      </Text>
                      {'\n'}
                      Then save/export as CSV again.
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <Text style={styles.guideNum}>6</Text>
                    <Text style={styles.guideText}>
                      Come back here → tap <Text style={styles.guideBold}>Import from CSV</Text> →
                      select your file. Done!
                    </Text>
                  </View>

                  <Divider style={styles.guideDivider} />

                  <Text style={styles.guideSection}>⚡ Method 2 — Zapier / Make.com (Automatic)</Text>

                  <Text style={styles.guideText}>
                    Connect Facebook Lead Ads to a Google Sheet automatically using
                    {' '}<Text style={styles.guideBold}>Zapier</Text> or
                    {' '}<Text style={styles.guideBold}>Make.com</Text> (free plans available).
                    New leads go straight into a spreadsheet — download as CSV and import here anytime.
                  </Text>

                  <Divider style={styles.guideDivider} />

                  <Text style={styles.guideSection}>💡 Tips</Text>
                  <Text style={styles.guideTip}>• Set Source column to "Facebook Ads" so you can filter them later</Text>
                  <Text style={styles.guideTip}>• Status defaults to "New" if left blank</Text>
                  <Text style={styles.guideTip}>• Download the Sample CSV above to see the exact column format</Text>
                  <Text style={styles.guideTip}>• Import works with Facebook, IndiaMart, WhatsApp exports too</Text>

                </View>
              )}
            </Card.Content>
          </Card>

          {/* ── Facebook Live Leads (webhook sync) ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="lightning-bolt" size={32} color="#1877F2" />
                <Text variant="titleLarge" style={styles.cardTitle}>Facebook Live Leads</Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Automatically receive leads the moment someone fills your Facebook Lead Ad — no manual download needed.
              </Text>

              {/* Sync status */}
              <View style={styles.syncStatusRow}>
                <MaterialCommunityIcons
                  name={webhookUrl ? 'check-circle' : 'circle-outline'}
                  size={18}
                  color={webhookUrl ? '#4CAF50' : '#BDBDBD'}
                />
                <Text style={[styles.syncStatusText, { color: webhookUrl ? '#4CAF50' : '#9E9E9E' }]}>
                  {webhookUrl
                    ? (lastFbSync
                        ? `Last synced: ${new Date(lastFbSync).toLocaleString('en-IN')}`
                        : 'Configured — not synced yet')
                    : 'Not configured yet'}
                </Text>
              </View>

              <View style={styles.exportButtons}>
                <Button
                  mode="contained"
                  onPress={handleFbSyncNow}
                  icon="sync"
                  loading={fbSyncing}
                  disabled={fbSyncing || !webhookUrl}
                  buttonColor="#1877F2"
                  style={styles.halfButton}
                >
                  {fbSyncing ? 'Syncing…' : 'Sync Now'}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setShowWebhookConfig(v => !v)}
                  icon="cog-outline"
                  textColor="#1877F2"
                  style={styles.halfButton}
                >
                  Configure
                </Button>
              </View>

              {showWebhookConfig && (
                <View style={styles.webhookConfig}>
                  <Text style={styles.webhookConfigTitle}>Webhook Server Settings</Text>
                  <Text style={styles.webhookConfigHint}>
                    Enter the Render.com URL of your webhook server and the App Key.
                  </Text>
                  <RNTextInput
                    style={styles.webhookInput}
                    placeholder="https://your-app.onrender.com"
                    placeholderTextColor="#9E9E9E"
                    value={webhookUrl}
                    onChangeText={setWebhookUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <RNTextInput
                    style={styles.webhookInput}
                    placeholder="App Key (e.g. getinsure-crm-key)"
                    placeholderTextColor="#9E9E9E"
                    value={webhookKey}
                    onChangeText={setWebhookKey}
                    autoCapitalize="none"
                  />
                  <Button
                    mode="contained"
                    onPress={saveWebhookConfig}
                    buttonColor="#1877F2"
                    style={{ marginTop: 8 }}
                    icon="content-save"
                  >
                    Save Config
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>

          <Text variant="bodySmall" style={styles.versionText}>
            GETINSURE CRM v1.0.0 • All data stored locally on device
          </Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F5F5F5' },
  header:         { backgroundColor: '#009688', padding: 16, paddingBottom: 20 },
  headerTitle:    { color: '#FFFFFF', fontWeight: 'bold' },
  headerSubtitle: { color: '#E0F2F1', marginTop: 4 },
  scrollView:     { flex: 1 },
  content:        { padding: 16 },
  card:           { marginBottom: 16, elevation: 2, backgroundColor: '#FFFFFF' },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  cardTitle:      { fontWeight: 'bold', color: '#000000' },
  phoneNumber:    { color: '#009688', fontWeight: 'bold', marginBottom: 2 },
  cardDescription:{ color: '#757575', marginBottom: 12 },
  button:         { marginTop: 8, paddingVertical: 2 },
  exportButtons:  { flexDirection: 'row', gap: 8, marginTop: 8 },
  halfButton:     { flex: 1 },
  noteText:       { color: '#9E9E9E', marginTop: 8, fontStyle: 'italic', fontSize: 12 },
  versionText:    { color: '#BDBDBD', textAlign: 'center', marginVertical: 16, fontSize: 12 },

  // Account / profile
  profileRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#F5F5F5', borderRadius: 10, marginBottom: 4,
  },
  profileInfo: { flex: 1, marginRight: 8 },

  // Edit-profile modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  editModal:        { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%' },
  editModalTitle:   { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  editModalSubtitle:{ fontSize: 13, color: '#757575', marginBottom: 16 },
  editModalInput:   {
    borderWidth: 1.5, borderColor: '#009688', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
    color: '#000', marginBottom: 16,
  },
  editModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },

  // Font size picker
  fontSizeRow:        { flexDirection: 'row', marginTop: 8, gap: 8 },
  fontSizeBtn:        {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA',
  },
  fontSizeBtnActive:  { borderColor: '#7B1FA2', backgroundColor: '#F3E5F5' },
  fontSizeSample:     { color: '#424242', fontWeight: 'bold', lineHeight: 32 },
  fontSizeLabel:      { fontSize: 10, color: '#9E9E9E', marginTop: 2 },
  fontSizeLabelActive:{ color: '#7B1FA2', fontWeight: 'bold' },

  // Facebook guide
  guideToggle:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#E3F2FD', borderRadius: 8, marginTop: 4,
  },
  guideToggleText: { color: '#1877F2', fontWeight: '600', fontSize: 14 },
  guideBox:        { marginTop: 12, backgroundColor: '#F8F9FF', borderRadius: 8, padding: 12 },
  guideSection:    { fontSize: 13, fontWeight: 'bold', color: '#1877F2', marginTop: 8, marginBottom: 8 },
  guideStep:       { flexDirection: 'row', marginBottom: 10, gap: 8, alignItems: 'flex-start' },
  guideNum:        {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#1877F2',
    color: '#FFFFFF', fontSize: 12, fontWeight: 'bold',
    textAlign: 'center', lineHeight: 22,
  },
  guideText:       { flex: 1, fontSize: 13, color: '#424242', lineHeight: 20 },
  guideBold:       { fontWeight: 'bold', color: '#1565C0' },
  guideMono:       { fontFamily: 'monospace', fontSize: 12, color: '#4A148C', backgroundColor: '#F3E5F5' },
  guideDivider:    { marginVertical: 10 },
  guideTip:        { fontSize: 12, color: '#546E7A', marginBottom: 4, paddingLeft: 8 },

  // Facebook live leads sync
  syncStatusRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  syncStatusText:   { fontSize: 13 },
  webhookConfig:    { marginTop: 12, backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12 },
  webhookConfigTitle:{ fontSize: 14, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  webhookConfigHint: { fontSize: 12, color: '#757575', marginBottom: 10 },
  webhookInput:     {
    borderWidth: 1, borderColor: '#BDBDBD', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: '#000', backgroundColor: '#FFFFFF', marginBottom: 8,
  },
});
