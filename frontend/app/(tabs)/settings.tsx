import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal,
  TextInput as RNTextInput, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Text, Card, Button, Divider, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../theme';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Contacts from 'expo-contacts';
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
  return content.split(/\r?\n/).filter(l => l.trim()).map(parseCSVLine);
}

function csvField(value: string | undefined | null): string {
  const v = (value ?? '').toString().replace(/"/g, '""');
  return `"${v}"`;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

// ─── Types ───────────────────────────────────────────────────────────────────

const FONT_SIZE_OPTIONS: { label: string; size: FontSize; samplePx: number }[] = [
  { label: 'Small',  size: 'small',  samplePx: 13 },
  { label: 'Normal', size: 'medium', samplePx: 16 },
  { label: 'Large',  size: 'large',  samplePx: 20 },
  { label: 'XL',     size: 'xlarge', samplePx: 25 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showFbGuide, setShowFbGuide] = useState(false);
  const { fontSize, setFontSize } = useAppSettings();

  // Facebook live-leads webhook
  const [webhookUrl, setWebhookUrl]         = useState('');
  const [webhookKey, setWebhookKey]         = useState('');
  const [fbSyncing, setFbSyncing]           = useState(false);
  const [lastFbSync, setLastFbSync]         = useState('');
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  // Auto backup
  const [backupFolderSet, setBackupFolderSet]   = useState(false);
  const [lastBackupTime, setLastBackupTime]       = useState('');
  const [backupInProgress, setBackupInProgress]   = useState(false);

  // Import from Contacts
  const [contactList, setContactList]             = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts]   = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts]   = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch]         = useState('');
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const email = await AsyncStorage.getItem('user_email') ?? '';
      const name  = await AsyncStorage.getItem('user_name')  ?? '';
      setUserEmail(email);
      setUserName(name || email.split('@')[0]);

      const { serverUrl, appKey } = await getFbWebhookConfig();
      setWebhookUrl(serverUrl || '');
      setWebhookKey(appKey || '');
      const last = await getLastSyncTime();
      if (last !== '1970-01-01T00:00:00.000Z') setLastFbSync(last);

      const dirUri = await getBackupFolderUri();
      setBackupFolderSet(!!dirUri);
      const lastBk = await getLastBackupTime();
      if (lastBk) setLastBackupTime(lastBk);
    } catch {}
  };

  // ── Contacts ─────────────────────────────────────────────────────────────

  const handleImportContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Allow contacts access in your phone settings to import contacts.');
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      sort: Contacts.SortTypes.FirstName,
    });
    const valid = (data as any[]).filter((c: any) => c.name || (c.phoneNumbers && c.phoneNumbers.length > 0));
    if (valid.length === 0) {
      Alert.alert('No Contacts', 'No contacts with names or phone numbers were found.');
      return;
    }
    setContactList(valid);
    setFilteredContacts(valid);
    setSelectedContacts(new Set());
    setContactSearch('');
    setShowContactsModal(true);
  };

  const searchContacts = (q: string) => {
    setContactSearch(q);
    if (!q.trim()) { setFilteredContacts(contactList); return; }
    const lq = q.toLowerCase();
    setFilteredContacts(contactList.filter(c =>
      c.name?.toLowerCase().includes(lq) ||
      c.phoneNumbers?.some((p: any) => p.number?.includes(q))
    ));
  };

  const toggleContact = (id: string) => {
    const n = new Set(selectedContacts);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedContacts(n);
  };

  const importSelectedContacts = async () => {
    if (selectedContacts.size === 0) return;
    setImportingContacts(true);
    let count = 0;
    await initializeDatabase();
    for (const id of selectedContacts) {
      const contact = contactList.find(c => c.id === id);
      if (!contact) continue;
      const rawPhone = contact.phoneNumbers?.[0]?.number ?? '';
      const phone = rawPhone.replace(/[^0-9]/g, '').slice(-10);
      try {
        await saveLeadLocal({
          id:         `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name:       contact.name || 'Unknown',
          mobile:     phone,
          product:    'General Insurance',
          status:     'New',
          source:     'Walk-in',
          city:       '',
          notes:      '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, userEmail);
        count++;
      } catch {}
    }
    setImportingContacts(false);
    setShowContactsModal(false);
    Alert.alert('Import Complete', `${count} contact${count !== 1 ? 's' : ''} imported as leads!`);
  };

  // ── Backup helpers ────────────────────────────────────────────────────────

  const handleSetupBackup = async () => {
    Alert.alert(
      'Choose Backup Folder',
      'Pick a folder for daily backups. We recommend Downloads.',
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
                Alert.alert('Backup Ready', `${result.leadsCount} leads backed up. Auto-backup will run daily.`);
              } else {
                Alert.alert('Folder Set', 'Auto-backup will run on next app open.');
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
      setLastBackupTime(new Date().toISOString());
      Alert.alert('Backup Complete', `${result.leadsCount} leads saved to Downloads folder.`);
    } else {
      Alert.alert('Backup Failed', result.error === 'no_folder_set'
        ? 'No backup folder selected. Tap "Setup" first.'
        : (result.error ?? 'Unknown error.'));
    }
  };

  const handleRestoreFromBackup = async () => {
    const backup = await checkForBackupFile();
    if (!backup.found || !backup.leads || backup.leads.length === 0) {
      Alert.alert('No Backup Found', 'No backup file in the selected folder.');
      return;
    }
    const dateStr = backup.backupDate
      ? new Date(backup.backupDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'unknown date';
    Alert.alert(
      'Restore Backup',
      `Found ${backup.leads.length} leads from ${dateStr}. Restore? Duplicates are skipped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setBackupInProgress(true);
            const { restored } = await restoreFromBackup(backup.leads!);
            setBackupInProgress(false);
            Alert.alert('Done', `${restored} leads restored.`);
          },
        },
      ],
    );
  };

  const handleRemoveBackupFolder = () => {
    Alert.alert(
      'Remove Backup Folder',
      'This will stop daily auto-backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
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
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['userLoggedIn', 'user_email', 'user_name', 'current_account_email']);
          router.replace('/login');
        },
      },
    ]);
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
        ? `✅ ${result.synced} new lead${result.synced !== 1 ? 's' : ''} from Facebook!`
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
      const leads = getAllLeadsLocal(userEmail);
      if (leads.length === 0) { Alert.alert('No Data', 'No leads to export.'); return; }

      const headers = 'Name,Mobile,Product,Status,Source,City,Notes,Next Followup Date,Next Followup Time';
      const rows = leads.map((lead: any) =>
        [lead.name, lead.mobile, lead.product, lead.status, lead.source, lead.city,
         lead.notes, lead.next_followup_date, lead.next_followup_time].map(csvField).join(',')
      );
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const fileUri = dir + `getinsure_leads_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, '﻿' + headers + '\n' + rows.join('\n'), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Share ${leads.length} Leads (CSV)` });
      } else {
        Alert.alert('Exported', `File saved to:\n${fileUri}`);
      }
    } catch { Alert.alert('Error', 'Failed to export. Please try again.'); }
    finally { setExporting(false); }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      await initializeDatabase();
      const leads = getAllLeadsLocal(userEmail);
      if (leads.length === 0) { Alert.alert('No Data', 'No leads to export.'); return; }
      const jsonContent = JSON.stringify({ leads, exported_at: new Date().toISOString() }, null, 2);
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const fileUri = dir + `getinsure_leads_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, jsonContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: `Share ${leads.length} Leads (JSON)` });
      }
    } catch { Alert.alert('Error', 'Failed to export JSON.'); }
    finally { setExporting(false); }
  };

  const handleDownloadSampleCSV = async () => {
    try {
      const sampleCSV =
        'Name,Mobile,Product,Status,Source,City,Notes\n' +
        '"Rahul Sharma","9876543210","Health Insurance","New","Facebook Ads","Mumbai","Interested in family floater plan"\n' +
        '"Priya Patel","8765432109","Term Insurance","Interested","Referral","Pune","Looking for 1 crore cover"\n' +
        '"Amit Kumar","7654321098","Motor Insurance","Follow-up","Walk-in","Delhi","Car insurance renewal next month"';
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const fileUri = dir + 'sample_import_format.csv';
      await FileSystem.writeAsStringAsync(fileUri, '﻿' + sampleCSV, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Save Sample CSV File' });
      }
    } catch { Alert.alert('Error', 'Failed to create sample file.'); }
  };

  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const name = file.name?.toLowerCase() ?? '';
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        Alert.alert('Wrong Format', 'Please save as CSV first, then import.');
        return;
      }
      setImporting(true);
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const cleanContent = content.replace(/^﻿/, '');
      const rows = parseCSV(cleanContent);
      if (rows.length < 2) { Alert.alert('Error', 'File appears empty or has only headers.'); setImporting(false); return; }

      const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
      const col = (keys: string[]) => {
        for (const k of keys) { const idx = header.findIndex(h => h.includes(k)); if (idx !== -1) return idx; }
        return -1;
      };
      const nameIdx    = col(['name','fullname','customerfullname']) !== -1 ? col(['name','fullname','customerfullname']) : 0;
      const mobileIdx  = col(['mobile','phone','contact','number'])  !== -1 ? col(['mobile','phone','contact','number'])  : 1;
      const productIdx = col(['product','insurance','service'])       !== -1 ? col(['product','insurance','service'])       : 2;
      const statusIdx  = col(['status'])                              !== -1 ? col(['status'])                              : 3;
      const sourceIdx  = col(['source','leadsource'])                 !== -1 ? col(['source','leadsource'])                 : 4;
      const cityIdx    = col(['city','location','area'])              !== -1 ? col(['city','location','area'])              : 5;
      const notesIdx   = col(['notes','note','remark','comment'])     !== -1 ? col(['notes','note','remark','comment'])     : 6;

      let imported = 0, skipped = 0;
      for (let i = 1; i < rows.length; i++) {
        const cols  = rows[i];
        const n     = nameIdx   >= 0 ? (cols[nameIdx]   || '') : '';
        const mob   = mobileIdx >= 0 ? (cols[mobileIdx] || '') : '';
        if (!n && !mob) { skipped++; continue; }
        try {
          await saveLeadLocal({
            id:      `import_${Date.now()}_${i}`,
            name:    n || 'Unknown',
            mobile:  mob || '',
            product: productIdx >= 0 ? (cols[productIdx] || 'General Insurance') : 'General Insurance',
            status:  statusIdx  >= 0 ? (cols[statusIdx]  || 'New')              : 'New',
            source:  sourceIdx  >= 0 ? (cols[sourceIdx]  || 'Import')           : 'Import',
            city:    cityIdx    >= 0 ? (cols[cityIdx]    || '')                 : '',
            notes:   notesIdx   >= 0 ? (cols[notesIdx]   || '')                 : '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, userEmail);
          imported++;
        } catch { skipped++; }
      }
      Alert.alert('Import Complete', `✅ Imported: ${imported} leads\n⏭ Skipped: ${skipped} rows`);
    } catch { Alert.alert('Error', 'Failed to read the file. Make sure it is a valid CSV.'); }
    finally { setImporting(false); }
  };

  const handleBackup = async () => {
    try {
      await initializeDatabase();
      const leads = getAllLeadsLocal(userEmail);
      const backup = JSON.stringify({ leads, backup_date: new Date().toISOString() }, null, 2);
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const fileUri = dir + `getinsure_backup_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, backup, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save Backup to Drive / WhatsApp' });
      }
      Alert.alert('Backup Ready', `${leads.length} leads included.`);
    } catch { Alert.alert('Error', 'Failed to create backup.'); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[C.navyDark, C.navy]} style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Preferences & Data Management</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>

          {/* ── Account ── */}
          <Card style={styles.card}>
            <Card.Content>
              {/* Brand badge */}
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <MaterialCommunityIcons name="shield-check" size={20} color={C.gold} />
                </View>
                <Text style={styles.brandName}>GET INSURE</Text>
              </View>

              {/* User info */}
              <View style={styles.userInfoBlock}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {getInitials(userName || userEmail.split('@')[0] || 'U')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userDisplayName}>{userName || 'Agent'}</Text>
                  <Text style={styles.userDisplayEmail}>{userEmail || 'Not set'}</Text>
                </View>
              </View>

              <Text style={styles.accountNote}>All data is stored locally on this device</Text>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <MaterialCommunityIcons name="logout" size={18} color={C.danger} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* ── Import from Contacts ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="contacts" size={32} color="#00897B" />
                <Text style={styles.cardTitle}>Import from Contacts</Text>
              </View>
              <Text style={styles.cardDescription}>
                Select contacts from your phone and import them as leads with name and mobile pre-filled.
              </Text>
              <Button
                mode="contained"
                onPress={handleImportContacts}
                icon="contacts"
                buttonColor="#00897B"
                style={styles.button}
              >
                Choose Contacts to Import
              </Button>
            </Card.Content>
          </Card>

          {/* ── Display / Font Size ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="format-size" size={32} color="#7B1FA2" />
                <Text style={styles.cardTitle}>Display</Text>
              </View>
              <Text style={styles.cardDescription}>Adjust text size across the entire app</Text>
              <View style={styles.fontSizeRow}>
                {FONT_SIZE_OPTIONS.map(({ label, size, samplePx }) => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setFontSize(size)}
                    style={[styles.fontSizeBtn, fontSize === size && styles.fontSizeBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.fontSizeSample, { fontSize: samplePx }]}>A</Text>
                    <Text style={[styles.fontSizeLabel, fontSize === size && styles.fontSizeLabelActive]}>{label}</Text>
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
                <Text style={styles.cardTitle}>Import / Export</Text>
              </View>
              <Text style={styles.cardDescription}>
                Import leads from CSV or share your data
              </Text>
              <Button mode="outlined" onPress={handleDownloadSampleCSV} icon="file-download" textColor="#009688" style={styles.button}>
                Download Sample CSV Format
              </Button>
              <Button mode="contained" onPress={handleImportCSV} icon="file-import" loading={importing}
                disabled={importing || exporting} buttonColor="#217346" style={styles.button}>
                {importing ? 'Importing…' : 'Import from CSV'}
              </Button>
              <View style={styles.exportButtons}>
                <Button mode="contained" onPress={handleExportCSV} icon="file-delimited" loading={exporting}
                  disabled={exporting || importing} buttonColor="#009688" style={styles.halfButton}>
                  Export CSV
                </Button>
                <Button mode="contained" onPress={handleExportJSON} icon="code-json" loading={exporting}
                  disabled={exporting || importing} buttonColor="#00796B" style={styles.halfButton}>
                  Export JSON
                </Button>
              </View>
              <Text style={styles.noteText}>CSV format: Name, Mobile, Product, Status, Source, City, Notes</Text>
            </Card.Content>
          </Card>

          {/* ── Auto Backup ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="folder-download" size={32} color="#4CAF50" />
                <Text style={styles.cardTitle}>Auto Backup</Text>
              </View>
              <Text style={styles.cardDescription}>
                Saves leads to your Downloads folder daily.
              </Text>
              <View style={styles.syncStatusRow}>
                <MaterialCommunityIcons
                  name={backupFolderSet ? 'check-circle' : 'circle-outline'}
                  size={18} color={backupFolderSet ? '#4CAF50' : '#BDBDBD'}
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
                <Button mode="contained" onPress={handleSetupBackup} icon="folder-open"
                  buttonColor="#4CAF50" loading={backupInProgress} disabled={backupInProgress} style={styles.button}>
                  Setup Auto Backup
                </Button>
              ) : (
                <>
                  <View style={styles.exportButtons}>
                    <Button mode="contained" onPress={handleBackupNow} icon="content-save"
                      buttonColor="#4CAF50" loading={backupInProgress} disabled={backupInProgress} style={styles.halfButton}>
                      Backup Now
                    </Button>
                    <Button mode="outlined" onPress={handleRestoreFromBackup} icon="restore"
                      textColor="#4CAF50" disabled={backupInProgress} style={styles.halfButton}>
                      Restore
                    </Button>
                  </View>
                  <Button mode="text" onPress={handleRemoveBackupFolder} icon="folder-remove"
                    textColor="#9E9E9E" style={{ marginTop: 4 }} compact>
                    Change / Remove Folder
                  </Button>
                </>
              )}
              <Text style={styles.noteText}>Backup file: getinsure_backup.json in your chosen folder</Text>
            </Card.Content>
          </Card>

          {/* ── Manual Backup (share) ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="backup-restore" size={32} color="#2196F3" />
                <Text style={styles.cardTitle}>Share Backup</Text>
              </View>
              <Text style={styles.cardDescription}>
                Manually share a backup file to WhatsApp, Google Drive, or email
              </Text>
              <Button mode="contained" onPress={handleBackup} icon="cloud-upload" buttonColor="#2196F3" style={styles.button}>
                Share Backup Now
              </Button>
            </Card.Content>
          </Card>

          {/* ── Facebook Ads Guide ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="facebook" size={32} color="#1877F2" />
                <Text style={styles.cardTitle}>Facebook Lead Ads</Text>
              </View>
              <Text style={styles.cardDescription}>
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
                <MaterialCommunityIcons name={showFbGuide ? 'chevron-up' : 'chevron-down'} size={20} color="#1877F2" />
              </TouchableOpacity>
              {showFbGuide && (
                <View style={styles.guideBox}>
                  <Text style={styles.guideSection}>📥 Download CSV from Ads Manager</Text>
                  {[
                    'Open ads.facebook.com or Meta Business Suite app.',
                    'Go to your Lead Ads campaign → click the ad set.',
                    'Click Download Leads or go to your Facebook Page → Publishing Tools → Forms Library → Download.',
                    'Select a date range and click Download as CSV.',
                    'Rename columns to match our format: Name | Mobile | Product | Status | Source | City | Notes',
                    'Come back here → tap Import from CSV → select your file. Done!',
                  ].map((step, i) => (
                    <View key={i} style={styles.guideStep}>
                      <Text style={styles.guideNum}>{i + 1}</Text>
                      <Text style={styles.guideText}>{step}</Text>
                    </View>
                  ))}
                  <Divider style={styles.guideDivider} />
                  <Text style={styles.guideSection}>💡 Tips</Text>
                  <Text style={styles.guideTip}>• Set Source column to "Facebook Ads" to filter later</Text>
                  <Text style={styles.guideTip}>• Status defaults to "New" if left blank</Text>
                  <Text style={styles.guideTip}>• Download Sample CSV above to see the exact column format</Text>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* ── Facebook Live Leads (webhook sync) ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="lightning-bolt" size={32} color="#1877F2" />
                <Text style={styles.cardTitle}>Facebook Live Leads</Text>
              </View>
              <Text style={styles.cardDescription}>
                Automatically receive leads the moment someone fills your Facebook Lead Ad.
              </Text>
              <View style={styles.syncStatusRow}>
                <MaterialCommunityIcons name={webhookUrl ? 'check-circle' : 'circle-outline'}
                  size={18} color={webhookUrl ? '#4CAF50' : '#BDBDBD'} />
                <Text style={[styles.syncStatusText, { color: webhookUrl ? '#4CAF50' : '#9E9E9E' }]}>
                  {webhookUrl
                    ? (lastFbSync ? `Last synced: ${new Date(lastFbSync).toLocaleString('en-IN')}` : 'Configured — not synced yet')
                    : 'Not configured yet'}
                </Text>
              </View>
              <View style={styles.exportButtons}>
                <Button mode="contained" onPress={handleFbSyncNow} icon="sync" loading={fbSyncing}
                  disabled={fbSyncing || !webhookUrl} buttonColor="#1877F2" style={styles.halfButton}>
                  {fbSyncing ? 'Syncing…' : 'Sync Now'}
                </Button>
                <Button mode="outlined" onPress={() => setShowWebhookConfig(v => !v)} icon="cog-outline"
                  textColor="#1877F2" style={styles.halfButton}>
                  Configure
                </Button>
              </View>
              {showWebhookConfig && (
                <View style={styles.webhookConfig}>
                  <Text style={styles.webhookConfigTitle}>Webhook Server Settings</Text>
                  <Text style={styles.webhookConfigHint}>Enter the Render.com URL and App Key.</Text>
                  <RNTextInput style={styles.webhookInput} placeholder="https://your-app.onrender.com"
                    placeholderTextColor="#9E9E9E" value={webhookUrl} onChangeText={setWebhookUrl}
                    autoCapitalize="none" keyboardType="url" />
                  <RNTextInput style={styles.webhookInput} placeholder="App Key (e.g. getinsure-crm-key)"
                    placeholderTextColor="#9E9E9E" value={webhookKey} onChangeText={setWebhookKey} autoCapitalize="none" />
                  <Button mode="contained" onPress={saveWebhookConfig} buttonColor="#1877F2" style={{ marginTop: 8 }} icon="content-save">
                    Save Config
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* ── Legal ── */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="shield-check-outline" size={32} color={C.navy} />
                <Text style={styles.cardTitle}>Legal</Text>
              </View>
              <TouchableOpacity
                style={styles.legalRow}
                onPress={() => router.push('/privacy-policy' as any)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="file-document-outline" size={20} color={C.navy} />
                <Text style={styles.legalRowText}>Privacy Policy</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.textLight} />
              </TouchableOpacity>
            </Card.Content>
          </Card>

          <Text style={styles.versionText}>GETINSURE CRM v1.1.0 • All data stored locally on device</Text>
        </View>
      </ScrollView>

      {/* ── Contacts Picker Modal ── */}
      <Modal visible={showContactsModal} animationType="slide" onRequestClose={() => setShowContactsModal(false)}>
        <SafeAreaView style={styles.contactsModal} edges={['top']}>
          <LinearGradient colors={[C.navyDark, C.navy]} style={styles.contactsHeader}>
            <TouchableOpacity onPress={() => setShowContactsModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.contactsHeaderTitle}>Import from Contacts</Text>
              <Text style={styles.contactsHeaderSub}>{selectedContacts.size} selected · {filteredContacts.length} shown</Text>
            </View>
            <TouchableOpacity
              onPress={importSelectedContacts}
              disabled={selectedContacts.size === 0 || importingContacts}
              style={[styles.importBtn, selectedContacts.size === 0 && { opacity: 0.4 }]}
            >
              <Text style={styles.importBtnText}>Import {selectedContacts.size > 0 ? selectedContacts.size : ''}</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.contactsSearchWrap}>
            <Searchbar
              placeholder="Search contacts…"
              value={contactSearch}
              onChangeText={searchContacts}
              style={styles.contactsSearchBar}
              inputStyle={{ fontSize: 14 }}
              iconColor={C.navy}
            />
            <TouchableOpacity
              onPress={() => {
                if (selectedContacts.size === filteredContacts.length) {
                  setSelectedContacts(new Set());
                } else {
                  setSelectedContacts(new Set(filteredContacts.map(c => c.id!).filter(Boolean)));
                }
              }}
              style={styles.selectAllBtn}
            >
              <Text style={styles.selectAllText}>
                {selectedContacts.size === filteredContacts.length && filteredContacts.length > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredContacts}
            keyExtractor={item => item.id ?? item.name ?? ''}
            renderItem={({ item }) => {
              const phone = item.phoneNumbers?.[0]?.number ?? '';
              const isSelected = !!item.id && selectedContacts.has(item.id);
              return (
                <TouchableOpacity
                  style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                  onPress={() => item.id && toggleContact(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactAvatar, isSelected && styles.contactAvatarSelected]}>
                    <Text style={[styles.contactAvatarText, isSelected && { color: C.white }]}>
                      {getInitials(item.name || '?')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
                    <Text style={styles.contactPhone}>{phone}</Text>
                  </View>
                  {isSelected
                    ? <MaterialCommunityIcons name="check-circle" size={22} color={C.navy} />
                    : <View style={styles.contactUncheck} />
                  }
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border }} />}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  header:         { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  headerTitle:    { fontSize: 24, fontWeight: '800', color: C.white },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  scrollView:     { flex: 1 },
  content:        { padding: 16 },
  card:           { marginBottom: 14, elevation: 3, backgroundColor: C.white, borderRadius: 16, shadowColor: C.navy, shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width:0, height:2 } },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  cardTitle:      { fontWeight: '700', color: C.navy, fontSize: 17 },
  cardDescription:{ color: C.textMid, marginBottom: 12, fontSize: 13 },
  button:         { marginTop: 8, paddingVertical: 2 },
  exportButtons:  { flexDirection: 'row', gap: 8, marginTop: 8 },
  halfButton:     { flex: 1 },
  noteText:       { color: C.textLight, marginTop: 8, fontStyle: 'italic', fontSize: 12 },
  versionText:    { color: C.textLight, textAlign: 'center', marginVertical: 16, fontSize: 12 },

  // Account card
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  brandIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.navy,
    justifyContent: 'center', alignItems: 'center',
  },
  brandName: { fontSize: 15, fontWeight: '800', color: C.navy, letterSpacing: 1 },

  userInfoBlock: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  userAvatar: {
    width: 54, height: 54, borderRadius: 16,
    backgroundColor: C.navy,
    justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText:    { fontSize: 20, fontWeight: '800', color: C.gold },
  userDisplayName:   { fontSize: 18, fontWeight: '800', color: C.navy },
  userDisplayEmail:  { fontSize: 13, color: C.textMid, marginTop: 2 },
  accountNote:       { fontSize: 11, color: C.textLight, marginBottom: 14 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
    alignSelf: 'flex-start',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: C.danger },

  // Legal
  legalRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  legalRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: C.navy },

  // Font size picker
  fontSizeRow:         { flexDirection: 'row', marginTop: 8, gap: 8 },
  fontSizeBtn:         { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  fontSizeBtnActive:   { borderColor: C.navy, backgroundColor: '#EEF2FF' },
  fontSizeSample:      { color: C.textPrimary, fontWeight: 'bold', lineHeight: 32 },
  fontSizeLabel:       { fontSize: 10, color: C.textLight, marginTop: 2 },
  fontSizeLabelActive: { color: C.navy, fontWeight: 'bold' },

  // Facebook guide
  guideToggle:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#E3F2FD', borderRadius: 10, marginTop: 4 },
  guideToggleText:  { color: '#1877F2', fontWeight: '600', fontSize: 14 },
  guideBox:         { marginTop: 12, backgroundColor: C.bg, borderRadius: 10, padding: 14 },
  guideSection:     { fontSize: 13, fontWeight: 'bold', color: '#1877F2', marginTop: 8, marginBottom: 8 },
  guideStep:        { flexDirection: 'row', marginBottom: 10, gap: 8, alignItems: 'flex-start' },
  guideNum:         { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1877F2', color: C.white, fontSize: 12, fontWeight: 'bold', textAlign: 'center', lineHeight: 22 },
  guideText:        { flex: 1, fontSize: 13, color: C.textMid, lineHeight: 20 },
  guideDivider:     { marginVertical: 10 },
  guideTip:         { fontSize: 12, color: C.textMid, marginBottom: 4, paddingLeft: 8 },

  // Facebook live leads
  syncStatusRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  syncStatusText:    { fontSize: 13 },
  webhookConfig:     { marginTop: 12, backgroundColor: C.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  webhookConfigTitle:{ fontSize: 14, fontWeight: '700', color: C.navy, marginBottom: 4 },
  webhookConfigHint: { fontSize: 12, color: C.textMid, marginBottom: 10 },
  webhookInput:      { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.navy, backgroundColor: C.white, marginBottom: 8 },

  // Contacts modal
  contactsModal:      { flex: 1, backgroundColor: C.bg },
  contactsHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  contactsHeaderTitle:{ fontSize: 17, fontWeight: '800', color: C.white },
  contactsHeaderSub:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  importBtn:          { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.gold, borderRadius: 10 },
  importBtnText:      { fontSize: 14, fontWeight: '700', color: C.navy },
  contactsSearchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  contactsSearchBar:  { flex: 1, elevation: 0, backgroundColor: C.bg, borderRadius: 10 },
  selectAllBtn:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EEF2FF' },
  selectAllText:      { fontSize: 12, fontWeight: '700', color: C.navy },
  contactItem:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white, gap: 12 },
  contactItemSelected:{ backgroundColor: '#EEF2FF' },
  contactAvatar:      { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  contactAvatarSelected:{ backgroundColor: C.navy, borderColor: C.navy },
  contactAvatarText:  { fontSize: 15, fontWeight: '800', color: C.navy },
  contactName:        { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  contactPhone:       { fontSize: 12, color: C.textMid, marginTop: 2 },
  contactUncheck:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border },
});
