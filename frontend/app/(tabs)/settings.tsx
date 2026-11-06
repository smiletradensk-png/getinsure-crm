import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useAppSettings, useFs, type FontSize } from '../../context/AppSettingsContext';
import {
  syncFacebookLeads, saveFbWebhookConfig, getFbWebhookConfig, getLastSyncTime,
} from '../../utils/facebookSync';
import {
  getBackupFolderUri, getLastBackupTime, requestBackupFolderAccess,
  performAutoBackup, checkForBackupFile, restoreFromBackup, clearBackupFolder,
} from '../../utils/autoBackup';
import {
  loadDropdowns, saveDropdowns, DEFAULT_PRODUCTS, DEFAULT_STATUSES,
  DEFAULT_SOURCES, DEFAULT_FOLLOWUP_TYPES, type CustomDropdowns,
} from '../../utils/dropdowns';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_SIZE_OPTIONS: { label: string; size: FontSize; samplePx: number }[] = [
  { label: 'Small',  size: 'small',  samplePx: 13 },
  { label: 'Normal', size: 'medium', samplePx: 16 },
  { label: 'Large',  size: 'large',  samplePx: 20 },
  { label: 'XL',     size: 'xlarge', samplePx: 25 },
];

const DD_LABELS: Record<keyof CustomDropdowns, string> = {
  products:     'Products / Services',
  statuses:     'Lead Status',
  sources:      'Lead Source',
  followupTypes: 'Follow-up Types',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showFbGuide, setShowFbGuide] = useState(false);
  const { fontSize, setFontSize } = useAppSettings();
  const fs = useFs();

  // Edit profile
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName]               = useState('');
  const [brandName, setBrandName]             = useState('');
  const [editBrandName, setEditBrandName]     = useState('');

  // Manage dropdowns
  const [dropdowns, setDropdowns]               = useState<CustomDropdowns>({
    products: DEFAULT_PRODUCTS, statuses: DEFAULT_STATUSES,
    sources: DEFAULT_SOURCES, followupTypes: DEFAULT_FOLLOWUP_TYPES,
  });
  const [showDropdownMgr, setShowDropdownMgr]   = useState(false);
  const [activeDdCat, setActiveDdCat]           = useState<keyof CustomDropdowns | null>(null);
  const [newDdOption, setNewDdOption]           = useState('');

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
      const brand = await AsyncStorage.getItem('user_brand_name') ?? '';
      setUserEmail(email);
      setUserName(name || email.split('@')[0]);
      setBrandName(brand);

      const { serverUrl, appKey } = await getFbWebhookConfig();
      setWebhookUrl(serverUrl || '');
      setWebhookKey(appKey || '');
      const last = await getLastSyncTime();
      if (last !== '1970-01-01T00:00:00.000Z') setLastFbSync(last);

      const dirUri = await getBackupFolderUri();
      setBackupFolderSet(!!dirUri);
      const lastBk = await getLastBackupTime();
      if (lastBk) setLastBackupTime(lastBk);

      const dd = await loadDropdowns();
      setDropdowns(dd);
    } catch {}
  };

  // ── Edit profile ──────────────────────────────────────────────────────────

  const handleOpenEditProfile = () => {
    setEditName(userName);
    setEditBrandName(brandName);
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    const newName = editName.trim();
    if (!newName) { Alert.alert('Name Required', 'Please enter your name.'); return; }
    try {
      await AsyncStorage.setItem('user_name', newName);
      await AsyncStorage.setItem('user_brand_name', editBrandName.trim());
      const accountsJson = await AsyncStorage.getItem('registered_accounts');
      if (accountsJson) {
        const accounts = JSON.parse(accountsJson);
        const updated = accounts.map((a: any) =>
          a.email === userEmail ? { ...a, name: newName } : a,
        );
        await AsyncStorage.setItem('registered_accounts', JSON.stringify(updated));
      }
      setUserName(newName);
      setBrandName(editBrandName.trim());
      setShowEditProfile(false);
    } catch { Alert.alert('Error', 'Failed to update profile.'); }
  };

  // ── Manage dropdowns ──────────────────────────────────────────────────────

  const handleDdDelete = async (cat: keyof CustomDropdowns, index: number) => {
    const updated = { ...dropdowns, [cat]: dropdowns[cat].filter((_, i) => i !== index) };
    setDropdowns(updated);
    await saveDropdowns(updated);
  };

  const handleDdAdd = async () => {
    if (!activeDdCat || !newDdOption.trim()) return;
    const opt = newDdOption.trim();
    if (dropdowns[activeDdCat].includes(opt)) {
      Alert.alert('Duplicate', 'This option already exists.');
      return;
    }
    const updated = { ...dropdowns, [activeDdCat]: [...dropdowns[activeDdCat], opt] };
    setDropdowns(updated);
    setNewDdOption('');
    await saveDropdowns(updated);
  };

  const handleDdReset = (cat: keyof CustomDropdowns) => {
    Alert.alert('Reset to Defaults', `Reset ${DD_LABELS[cat]} to default options?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive',
        onPress: async () => {
          const defaults: CustomDropdowns = {
            products: DEFAULT_PRODUCTS, statuses: DEFAULT_STATUSES,
            sources: DEFAULT_SOURCES, followupTypes: DEFAULT_FOLLOWUP_TYPES,
          };
          const updated = { ...dropdowns, [cat]: defaults[cat] };
          setDropdowns(updated);
          await saveDropdowns(updated);
        },
      },
    ]);
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
          id:               `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name:             contact.name || 'Unknown',
          mobile:           phone,
          product:          dropdowns.products[0] || 'General',
          status:           'New',
          source:           'Walk-in',
          city:             '',
          notes:            '',
          next_followup_date: '',
          created_at:       new Date().toISOString(),
          updated_at:       new Date().toISOString(),
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
    Alert.alert('Choose Backup Folder', 'Pick a folder for daily backups. We recommend Downloads.', [
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
              setLastBackupTime(new Date().toISOString());
              Alert.alert('Backup Ready', `${result.leadsCount} leads backed up. Auto-backup will run daily.`);
            } else {
              Alert.alert('Folder Set', 'Auto-backup will run on next app open.');
            }
          }
        },
      },
    ]);
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
    Alert.alert('Restore Backup', `Found ${backup.leads.length} leads from ${dateStr}. Restore? Duplicates are skipped.`, [
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
    ]);
  };

  const handleRemoveBackupFolder = () => {
    Alert.alert('Remove Backup Folder', 'This will stop daily auto-backup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => { await clearBackupFolder(); setBackupFolderSet(false); setLastBackupTime(''); },
      },
    ]);
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
    if (!webhookUrl || !webhookKey) { Alert.alert('Not Configured', 'Please save your webhook server URL and App Key first.'); return; }
    setFbSyncing(true);
    const result = await syncFacebookLeads();
    setFbSyncing(false);
    if (result.error) { Alert.alert('Sync Failed', result.error); }
    else {
      const last = await getLastSyncTime();
      setLastFbSync(last);
      Alert.alert('Sync Complete', result.synced > 0 ? `✅ ${result.synced} new lead${result.synced !== 1 ? 's' : ''} from Facebook!` : 'No new leads since last sync.');
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
      await FileSystem.writeAsStringAsync(fileUri, '﻿' + headers + '\n' + rows.join('\n'), { encoding: FileSystem.EncodingType.UTF8 });
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
        '"Rahul Sharma","9876543210","Health Plan","New","Facebook Ads","Mumbai","Interested in family plan"\n' +
        '"Priya Patel","8765432109","General","Interested","Referral","Pune","Looking for long term cover"\n' +
        '"Amit Kumar","7654321098","Motor Protection","New","Walk-in","Delhi","Renewal next month"';
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
      const nameIdx    = col(['name', 'fullname', 'customerfullname']);
      const mobileIdx  = col(['mobile', 'phone', 'contact', 'number']);
      const productIdx = col(['product', 'service', 'insurance']);
      const sourceIdx  = col(['source', 'leadsource']);
      const cityIdx    = col(['city', 'location', 'area']);
      const notesIdx   = col(['notes', 'note', 'remark', 'comment']);

      let imported = 0, skipped = 0;
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        const n   = nameIdx   >= 0 ? (cols[nameIdx]   || '') : '';
        const mob = mobileIdx >= 0 ? (cols[mobileIdx] || '') : '';
        if (!n && !mob) { skipped++; continue; }
        try {
          await saveLeadLocal({
            id:               `import_${Date.now()}_${i}`,
            name:             n || 'Unknown',
            mobile:           mob || '',
            product:          productIdx >= 0 ? (cols[productIdx] || 'General') : 'General',
            status:           'New',          // always import as New
            source:           sourceIdx  >= 0 ? (cols[sourceIdx]  || 'Import')  : 'Import',
            city:             cityIdx    >= 0 ? (cols[cityIdx]    || '')        : '',
            notes:            notesIdx   >= 0 ? (cols[notesIdx]   || '')        : '',
            next_followup_date: '',           // never inherit a past/future date from CSV
            next_followup_time: '',
            created_at:       new Date().toISOString(),
            updated_at:       new Date().toISOString(),
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

  // ── Dynamic styles (font-scaled) ──────────────────────────────────────────

  const s = useMemo(() => createStyles(fs), [fs]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={[C.navyDark, C.navy]} style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
        <Text style={s.headerSubtitle}>Preferences & Data Management</Text>
      </LinearGradient>

      <ScrollView style={s.scrollView}>
        <View style={s.content}>

          {/* ── Account ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.brandRow}>
                <View style={s.brandIcon}>
                  <MaterialCommunityIcons name="shield-check" size={20} color={C.gold} />
                </View>
                <Text style={s.brandName}>GET INSURE</Text>
              </View>

              <TouchableOpacity onPress={handleOpenEditProfile} activeOpacity={0.75}>
                <View style={s.userInfoBlock}>
                  <View style={s.userAvatar}>
                    <Text style={s.userAvatarText}>
                      {getInitials(userName || userEmail.split('@')[0] || 'U')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.userDisplayName}>{userName || 'Agent'}</Text>
                    <Text style={s.userDisplayEmail}>{userEmail || 'Not set'}</Text>
                    {!!brandName && <Text style={s.userDisplayBrand}>{brandName}</Text>}
                  </View>
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={C.textLight} />
                </View>
              </TouchableOpacity>

              <Text style={s.accountNote}>Tap to edit profile · Data stored locally on this device</Text>

              <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <MaterialCommunityIcons name="logout" size={18} color={C.danger} />
                <Text style={s.logoutText}>Logout</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* ── Import from Contacts ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="contacts" size={32} color="#00897B" />
                <Text style={s.cardTitle}>Import from Contacts</Text>
              </View>
              <Text style={s.cardDescription}>
                Select contacts from your phone and import them as leads with name and mobile pre-filled.
              </Text>
              <Button mode="contained" onPress={handleImportContacts} icon="contacts" buttonColor="#00897B" style={s.button}>
                Choose Contacts to Import
              </Button>
            </Card.Content>
          </Card>

          {/* ── Display / Font Size ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="format-size" size={32} color="#7B1FA2" />
                <Text style={s.cardTitle}>Display</Text>
              </View>
              <Text style={s.cardDescription}>Adjust text size across the entire app</Text>
              <View style={s.fontSizeRow}>
                {FONT_SIZE_OPTIONS.map(({ label, size, samplePx }) => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setFontSize(size)}
                    style={[s.fontSizeBtn, fontSize === size && s.fontSizeBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.fontSizeSample, { fontSize: samplePx }]}>A</Text>
                    <Text style={[s.fontSizeLabel, fontSize === size && s.fontSizeLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card.Content>
          </Card>

          {/* ── Manage Dropdowns ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="format-list-bulleted-type" size={32} color="#E65100" />
                <Text style={s.cardTitle}>Manage Dropdowns</Text>
              </View>
              <Text style={s.cardDescription}>
                Customise the options shown in the Add Lead form. Add or remove items from any list.
              </Text>
              {(Object.keys(DD_LABELS) as (keyof CustomDropdowns)[]).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={s.ddRow}
                  onPress={() => { setActiveDdCat(cat); setNewDdOption(''); setShowDropdownMgr(true); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.ddRowLabel}>{DD_LABELS[cat]}</Text>
                    <Text style={s.ddRowCount}>{dropdowns[cat].length} options</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={C.textLight} />
                </TouchableOpacity>
              ))}
            </Card.Content>
          </Card>

          {/* ── Import / Export ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="microsoft-excel" size={32} color="#217346" />
                <Text style={s.cardTitle}>Import / Export</Text>
              </View>
              <Text style={s.cardDescription}>Import leads from CSV or share your data</Text>
              <Button mode="outlined" onPress={handleDownloadSampleCSV} icon="file-download" textColor="#009688" style={s.button}>
                Download Sample CSV Format
              </Button>
              <Button mode="contained" onPress={handleImportCSV} icon="file-import" loading={importing}
                disabled={importing || exporting} buttonColor="#217346" style={s.button}>
                {importing ? 'Importing…' : 'Import from CSV'}
              </Button>
              <View style={s.exportButtons}>
                <Button mode="contained" onPress={handleExportCSV} icon="file-delimited" loading={exporting}
                  disabled={exporting || importing} buttonColor="#009688" style={s.halfButton}>
                  Export CSV
                </Button>
                <Button mode="contained" onPress={handleExportJSON} icon="code-json" loading={exporting}
                  disabled={exporting || importing} buttonColor="#00796B" style={s.halfButton}>
                  Export JSON
                </Button>
              </View>
              <Text style={s.noteText}>Imported leads are always set to "New" status</Text>
            </Card.Content>
          </Card>

          {/* ── Auto Backup ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="folder-download" size={32} color="#4CAF50" />
                <Text style={s.cardTitle}>Auto Backup</Text>
              </View>
              <Text style={s.cardDescription}>Saves your leads to Downloads folder daily.</Text>
              <View style={s.syncStatusRow}>
                <MaterialCommunityIcons name={backupFolderSet ? 'check-circle' : 'circle-outline'}
                  size={18} color={backupFolderSet ? '#4CAF50' : '#BDBDBD'} />
                <Text style={[s.syncStatusText, { color: backupFolderSet ? '#4CAF50' : '#9E9E9E' }]}>
                  {backupFolderSet
                    ? (lastBackupTime
                        ? `Last backup: ${new Date(lastBackupTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : 'Folder set — not backed up yet')
                    : 'Not configured — tap Setup to enable'}
                </Text>
              </View>
              {!backupFolderSet ? (
                <Button mode="contained" onPress={handleSetupBackup} icon="folder-open"
                  buttonColor="#4CAF50" loading={backupInProgress} disabled={backupInProgress} style={s.button}>
                  Setup Auto Backup
                </Button>
              ) : (
                <>
                  <View style={s.exportButtons}>
                    <Button mode="contained" onPress={handleBackupNow} icon="content-save"
                      buttonColor="#4CAF50" loading={backupInProgress} disabled={backupInProgress} style={s.halfButton}>
                      Backup Now
                    </Button>
                    <Button mode="outlined" onPress={handleRestoreFromBackup} icon="restore"
                      textColor="#4CAF50" disabled={backupInProgress} style={s.halfButton}>
                      Restore
                    </Button>
                  </View>
                  <Button mode="text" onPress={handleRemoveBackupFolder} icon="folder-remove"
                    textColor="#9E9E9E" style={{ marginTop: 4 }} compact>
                    Change / Remove Folder
                  </Button>
                </>
              )}
              <Text style={s.noteText}>Only your leads are backed up (not other accounts)</Text>
            </Card.Content>
          </Card>

          {/* ── Manual Backup (share) ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="backup-restore" size={32} color="#2196F3" />
                <Text style={s.cardTitle}>Share Backup</Text>
              </View>
              <Text style={s.cardDescription}>Manually share a backup file to WhatsApp, Google Drive, or email</Text>
              <Button mode="contained" onPress={handleBackup} icon="cloud-upload" buttonColor="#2196F3" style={s.button}>
                Share Backup Now
              </Button>
            </Card.Content>
          </Card>

          {/* ── Facebook Ads Guide ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="facebook" size={32} color="#1877F2" />
                <Text style={s.cardTitle}>Facebook Lead Ads</Text>
              </View>
              <Text style={s.cardDescription}>
                Export leads from Facebook Ads Manager and import them here as CSV.
              </Text>
              <TouchableOpacity style={s.guideToggle} onPress={() => setShowFbGuide(v => !v)} activeOpacity={0.7}>
                <Text style={s.guideToggleText}>{showFbGuide ? 'Hide guide' : 'Show step-by-step guide'}</Text>
                <MaterialCommunityIcons name={showFbGuide ? 'chevron-up' : 'chevron-down'} size={20} color="#1877F2" />
              </TouchableOpacity>
              {showFbGuide && (
                <View style={s.guideBox}>
                  <Text style={s.guideSection}>📥 Download CSV from Ads Manager</Text>
                  {[
                    'Open ads.facebook.com or Meta Business Suite app.',
                    'Go to your Lead Ads campaign → click the ad set.',
                    'Click Download Leads or go to your Facebook Page → Publishing Tools → Forms Library → Download.',
                    'Select a date range and click Download as CSV.',
                    'Rename columns to match our format: Name | Mobile | Product | Source | City | Notes',
                    'Come back here → tap Import from CSV → select your file. Done!',
                  ].map((step, i) => (
                    <View key={i} style={s.guideStep}>
                      <Text style={s.guideNum}>{i + 1}</Text>
                      <Text style={s.guideText}>{step}</Text>
                    </View>
                  ))}
                  <Divider style={s.guideDivider} />
                  <Text style={s.guideSection}>💡 Tips</Text>
                  <Text style={s.guideTip}>• Set Source column to "Facebook Ads" to filter later</Text>
                  <Text style={s.guideTip}>• All imported leads are set to "New" status automatically</Text>
                  <Text style={s.guideTip}>• Download Sample CSV above to see the exact column format</Text>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* ── Facebook Live Leads ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="lightning-bolt" size={32} color="#1877F2" />
                <Text style={s.cardTitle}>Facebook Live Leads</Text>
              </View>
              <Text style={s.cardDescription}>
                Automatically receive leads the moment someone fills your Facebook Lead Ad.
              </Text>
              <View style={s.syncStatusRow}>
                <MaterialCommunityIcons name={webhookUrl ? 'check-circle' : 'circle-outline'}
                  size={18} color={webhookUrl ? '#4CAF50' : '#BDBDBD'} />
                <Text style={[s.syncStatusText, { color: webhookUrl ? '#4CAF50' : '#9E9E9E' }]}>
                  {webhookUrl
                    ? (lastFbSync ? `Last synced: ${new Date(lastFbSync).toLocaleString('en-IN')}` : 'Configured — not synced yet')
                    : 'Not configured yet'}
                </Text>
              </View>
              <View style={s.exportButtons}>
                <Button mode="contained" onPress={handleFbSyncNow} icon="sync" loading={fbSyncing}
                  disabled={fbSyncing || !webhookUrl} buttonColor="#1877F2" style={s.halfButton}>
                  {fbSyncing ? 'Syncing…' : 'Sync Now'}
                </Button>
                <Button mode="outlined" onPress={() => setShowWebhookConfig(v => !v)} icon="cog-outline"
                  textColor="#1877F2" style={s.halfButton}>
                  Configure
                </Button>
              </View>
              {showWebhookConfig && (
                <View style={s.webhookConfig}>
                  <Text style={s.webhookConfigTitle}>Webhook Server Settings</Text>
                  <Text style={s.webhookConfigHint}>Enter the Render.com URL and App Key.</Text>
                  <RNTextInput style={s.webhookInput} placeholder="https://your-app.onrender.com"
                    placeholderTextColor="#9E9E9E" value={webhookUrl} onChangeText={setWebhookUrl}
                    autoCapitalize="none" keyboardType="url" />
                  <RNTextInput style={s.webhookInput} placeholder="App Key"
                    placeholderTextColor="#9E9E9E" value={webhookKey} onChangeText={setWebhookKey} autoCapitalize="none" />
                  <Button mode="contained" onPress={saveWebhookConfig} buttonColor="#1877F2" style={{ marginTop: 8 }} icon="content-save">
                    Save Config
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* ── Legal ── */}
          <Card style={s.card}>
            <Card.Content>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="shield-check-outline" size={32} color={C.navy} />
                <Text style={s.cardTitle}>Legal</Text>
              </View>
              <TouchableOpacity style={s.legalRow} onPress={() => router.push('/privacy-policy' as any)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="file-document-outline" size={20} color={C.navy} />
                <Text style={s.legalRowText}>Privacy Policy</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.textLight} />
              </TouchableOpacity>
            </Card.Content>
          </Card>

          <Text style={s.versionText}>GETINSURE CRM v1.2.0 • All data stored locally on device</Text>
        </View>
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={showEditProfile} transparent animationType="fade" onRequestClose={() => setShowEditProfile(false)}>
        <View style={s.modalOverlay}>
          <View style={s.editProfileModal}>
            <Text style={s.modalTitle}>Edit Profile</Text>
            <Text style={s.modalSubtitle}>Update your name and brand</Text>
            <Text style={s.profileFieldLabel}>Full Name *</Text>
            <RNTextInput
              style={s.profileInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full Name"
              placeholderTextColor={C.textLight}
              autoCapitalize="words"
              autoFocus
            />
            <Text style={s.profileFieldLabel}>Email</Text>
            <View style={s.profileEmailBox}>
              <Text style={s.profileEmailNote}>{userEmail}</Text>
            </View>
            <Text style={s.profileFieldLabel}>Brand / Business Name</Text>
            <RNTextInput
              style={s.profileInput}
              value={editBrandName}
              onChangeText={setEditBrandName}
              placeholder="e.g. Sharma Associates"
              placeholderTextColor={C.textLight}
              autoCapitalize="words"
            />
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnCancel]} onPress={() => setShowEditProfile(false)}>
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnSave]} onPress={handleSaveProfile}>
                <Text style={s.modalBtnSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Dropdown Manager Modal ── */}
      <Modal visible={showDropdownMgr && activeDdCat !== null} animationType="slide" onRequestClose={() => setShowDropdownMgr(false)}>
        <SafeAreaView style={s.ddModal} edges={['top']}>
          <LinearGradient colors={[C.navyDark, C.navy]} style={s.ddModalHeader}>
            <TouchableOpacity onPress={() => setShowDropdownMgr(false)}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={C.white} />
            </TouchableOpacity>
            <Text style={s.ddModalTitle}>{activeDdCat ? DD_LABELS[activeDdCat] : ''}</Text>
            <TouchableOpacity onPress={() => activeDdCat && handleDdReset(activeDdCat)}>
              <Text style={s.ddResetBtn}>Reset</Text>
            </TouchableOpacity>
          </LinearGradient>

          <FlatList
            data={activeDdCat ? dropdowns[activeDdCat] : []}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item, index }) => (
              <View style={s.ddItem}>
                <Text style={s.ddItemText}>{item}</Text>
                <TouchableOpacity
                  onPress={() => activeDdCat && handleDdDelete(activeDdCat, index)}
                  style={s.ddDeleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color={C.danger} />
                </TouchableOpacity>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border, marginLeft: 16 }} />}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <MaterialCommunityIcons name="format-list-bulleted" size={48} color={C.border} />
                <Text style={{ color: C.textLight, marginTop: 8 }}>No options. Add one below.</Text>
              </View>
            }
          />

          {/* Add new option */}
          <View style={s.ddAddRow}>
            <RNTextInput
              style={s.ddAddInput}
              value={newDdOption}
              onChangeText={setNewDdOption}
              placeholder="Add new option…"
              placeholderTextColor={C.textLight}
              onSubmitEditing={handleDdAdd}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.ddAddBtn} onPress={handleDdAdd} activeOpacity={0.8}>
              <MaterialCommunityIcons name="plus" size={22} color={C.white} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Contacts Picker Modal ── */}
      <Modal visible={showContactsModal} animationType="slide" onRequestClose={() => setShowContactsModal(false)}>
        <SafeAreaView style={s.contactsModal} edges={['top']}>
          <LinearGradient colors={[C.navyDark, C.navy]} style={s.contactsHeader}>
            <TouchableOpacity onPress={() => setShowContactsModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.contactsHeaderTitle}>Import from Contacts</Text>
              <Text style={s.contactsHeaderSub}>{selectedContacts.size} selected · {filteredContacts.length} shown</Text>
            </View>
            <TouchableOpacity
              onPress={importSelectedContacts}
              disabled={selectedContacts.size === 0 || importingContacts}
              style={[s.importBtn, selectedContacts.size === 0 && { opacity: 0.4 }]}
            >
              <Text style={s.importBtnText}>Import {selectedContacts.size > 0 ? selectedContacts.size : ''}</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={s.contactsSearchWrap}>
            <Searchbar
              placeholder="Search contacts…"
              value={contactSearch}
              onChangeText={searchContacts}
              style={s.contactsSearchBar}
              inputStyle={{ fontSize: 14, color: '#111111' }}
              placeholderTextColor="#757575"
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
              style={s.selectAllBtn}
            >
              <Text style={s.selectAllText}>
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
                  style={[s.contactItem, isSelected && s.contactItemSelected]}
                  onPress={() => item.id && toggleContact(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.contactAvatar, isSelected && s.contactAvatarSelected]}>
                    <Text style={[s.contactAvatarText, isSelected && { color: C.white }]}>
                      {getInitials(item.name || '?')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.contactName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
                    <Text style={s.contactPhone}>{phone}</Text>
                  </View>
                  {isSelected
                    ? <MaterialCommunityIcons name="check-circle" size={22} color={C.navy} />
                    : <View style={s.contactUncheck} />
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

// ─── Styles (font-scaled) ─────────────────────────────────────────────────────

function createStyles(fs: (n: number) => number) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: C.bg },
    header:         { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
    headerTitle:    { fontSize: fs(24), fontWeight: '800', color: C.white },
    headerSubtitle: { fontSize: fs(13), color: 'rgba(255,255,255,0.65)', marginTop: 3 },
    scrollView:     { flex: 1 },
    content:        { padding: 16 },
    card:           { marginBottom: 14, elevation: 3, backgroundColor: C.white, borderRadius: 16, shadowColor: C.navy, shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
    cardTitle:      { fontWeight: '700', color: C.navy, fontSize: fs(17) },
    cardDescription:{ color: C.textMid, marginBottom: 12, fontSize: fs(13) },
    button:         { marginTop: 8, paddingVertical: 2 },
    exportButtons:  { flexDirection: 'row', gap: 8, marginTop: 8 },
    halfButton:     { flex: 1 },
    noteText:       { color: C.textLight, marginTop: 8, fontStyle: 'italic', fontSize: fs(12) },
    versionText:    { color: C.textLight, textAlign: 'center', marginVertical: 16, fontSize: fs(12) },

    // Account card
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    brandIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
    brandName: { fontSize: fs(15), fontWeight: '800', color: C.navy, letterSpacing: 1 },
    userInfoBlock:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10, paddingVertical: 6 },
    userAvatar:      { width: 54, height: 54, borderRadius: 16, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
    userAvatarText:  { fontSize: fs(20), fontWeight: '800', color: C.gold },
    userDisplayName:  { fontSize: fs(18), fontWeight: '800', color: C.navy },
    userDisplayEmail: { fontSize: fs(13), color: C.textMid, marginTop: 2 },
    userDisplayBrand: { fontSize: fs(12), color: C.gold, fontWeight: '700', marginTop: 2 },
    accountNote:      { fontSize: fs(11), color: C.textLight, marginBottom: 14 },
    logoutBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignSelf: 'flex-start' },
    logoutText:      { fontSize: fs(14), fontWeight: '700', color: C.danger },

    // Edit profile modal
    modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    editProfileModal:    { width: '100%', backgroundColor: C.white, borderRadius: 20, padding: 24 },
    modalTitle:          { fontSize: fs(18), fontWeight: '800', color: C.navy, marginBottom: 4 },
    modalSubtitle:       { fontSize: fs(13), color: C.textMid, marginBottom: 20 },
    profileFieldLabel:   { fontSize: fs(11), fontWeight: '700', color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    profileInput:        { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: fs(16), color: C.navy, backgroundColor: C.bg, marginBottom: 12 },
    profileEmailBox:     { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.bg, marginBottom: 12 },
    profileEmailNote:    { fontSize: fs(14), color: C.textMid },
    modalBtnRow:         { flexDirection: 'row', gap: 10 },
    modalBtn:            { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    modalBtnCancel:      { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
    modalBtnSave:        { backgroundColor: C.navy },
    modalBtnCancelText:  { fontSize: fs(14), fontWeight: '600', color: C.textMid },
    modalBtnSaveText:    { fontSize: fs(14), fontWeight: '700', color: C.white },

    // Dropdown manager
    ddRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border },
    ddRowLabel:   { fontSize: fs(14), fontWeight: '600', color: C.navy },
    ddRowCount:   { fontSize: fs(12), color: C.textLight, marginTop: 2 },
    ddModal:      { flex: 1, backgroundColor: C.bg },
    ddModalHeader:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    ddModalTitle: { flex: 1, fontSize: fs(17), fontWeight: '800', color: C.white },
    ddResetBtn:   { fontSize: fs(13), color: C.gold, fontWeight: '700' },
    ddItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white },
    ddItemText:   { flex: 1, fontSize: fs(15), color: C.textPrimary },
    ddDeleteBtn:  { padding: 4 },
    ddAddRow:     { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
    ddAddInput:   { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: fs(14), color: C.navy, backgroundColor: C.bg },
    ddAddBtn:     { width: 44, height: 44, borderRadius: 12, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },

    // Legal
    legalRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border },
    legalRowText: { flex: 1, fontSize: fs(15), fontWeight: '600', color: C.navy },

    // Font size picker
    fontSizeRow:         { flexDirection: 'row', marginTop: 8, gap: 8 },
    fontSizeBtn:         { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
    fontSizeBtnActive:   { borderColor: C.navy, backgroundColor: '#EEF2FF' },
    fontSizeSample:      { color: C.textPrimary, fontWeight: 'bold', lineHeight: 32 },
    fontSizeLabel:       { fontSize: 10, color: C.textLight, marginTop: 2 },
    fontSizeLabelActive: { color: C.navy, fontWeight: 'bold' },

    // Facebook guide
    guideToggle:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#E3F2FD', borderRadius: 10, marginTop: 4 },
    guideToggleText:  { color: '#1877F2', fontWeight: '600', fontSize: fs(14) },
    guideBox:         { marginTop: 12, backgroundColor: C.bg, borderRadius: 10, padding: 14 },
    guideSection:     { fontSize: fs(13), fontWeight: 'bold', color: '#1877F2', marginTop: 8, marginBottom: 8 },
    guideStep:        { flexDirection: 'row', marginBottom: 10, gap: 8, alignItems: 'flex-start' },
    guideNum:         { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1877F2', color: C.white, fontSize: 12, fontWeight: 'bold', textAlign: 'center', lineHeight: 22 },
    guideText:        { flex: 1, fontSize: fs(13), color: C.textMid, lineHeight: 20 },
    guideDivider:     { marginVertical: 10 },
    guideTip:         { fontSize: fs(12), color: C.textMid, marginBottom: 4, paddingLeft: 8 },

    // Facebook live leads
    syncStatusRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    syncStatusText:     { fontSize: fs(13) },
    webhookConfig:      { marginTop: 12, backgroundColor: C.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
    webhookConfigTitle: { fontSize: fs(14), fontWeight: '700', color: C.navy, marginBottom: 4 },
    webhookConfigHint:  { fontSize: fs(12), color: C.textMid, marginBottom: 10 },
    webhookInput:       { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: fs(14), color: C.navy, backgroundColor: C.white, marginBottom: 8 },

    // Contacts modal
    contactsModal:       { flex: 1, backgroundColor: C.bg },
    contactsHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    contactsHeaderTitle: { fontSize: fs(17), fontWeight: '800', color: C.white },
    contactsHeaderSub:   { fontSize: fs(11), color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    importBtn:           { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.gold, borderRadius: 10 },
    importBtnText:       { fontSize: fs(14), fontWeight: '700', color: C.navy },
    contactsSearchWrap:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
    contactsSearchBar:   { flex: 1, elevation: 0, backgroundColor: C.bg, borderRadius: 10 },
    selectAllBtn:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EEF2FF' },
    selectAllText:       { fontSize: fs(12), fontWeight: '700', color: C.navy },
    contactItem:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white, gap: 12 },
    contactItemSelected: { backgroundColor: '#EEF2FF' },
    contactAvatar:       { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
    contactAvatarSelected: { backgroundColor: C.navy, borderColor: C.navy },
    contactAvatarText:   { fontSize: fs(15), fontWeight: '800', color: C.navy },
    contactName:         { fontSize: fs(15), fontWeight: '600', color: C.textPrimary },
    contactPhone:        { fontSize: fs(12), color: C.textMid, marginTop: 2 },
    contactUncheck:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border },
  });
}
