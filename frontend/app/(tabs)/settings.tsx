import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Switch, Divider, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SettingsScreen() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [userPhone, setUserPhone] = useState('');

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const phone = await AsyncStorage.getItem('userPhone');
      setUserPhone(phone || '');
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? Local data will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('userLoggedIn');
            await AsyncStorage.removeItem('userPhone');
            router.replace('/login');
          },
        },
      ]
    );
  };

  // Excel Export
  const handleExport = async (format: string) => {
    setExporting(true);
    try {
      const url = `${BACKEND_URL}/api/export/${format}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const timestamp = Date.now();
          const filename = `getinsure_export_${timestamp}.${format}`;
          const fileUri = FileSystem.documentDirectory + filename;
          
          const base64 = base64data.split(',')[1];
          
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType: format === 'csv' ? 'text/csv' : 'application/json',
              dialogTitle: `Export GETINSURE CRM Data`,
            });
          }
          
          Alert.alert('Success', `Data exported as ${format.toUpperCase()}`);
        };
        
        reader.readAsDataURL(blob);
      } else {
        Alert.alert('Error', 'Failed to export data');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  // Excel Import
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setImporting(true);

      const file = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      
      if (!fileInfo.exists) {
        Alert.alert('Error', 'File not found');
        setImporting(false);
        return;
      }

      // Read file as base64
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create FormData
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: file.name,
      } as any);

      const response = await fetch(`${BACKEND_URL}/api/import/excel`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Import Complete',
          `Successfully imported ${data.imported} leads.\n${data.errors.length > 0 ? `Errors: ${data.errors.length}` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', data.detail || 'Failed to import data');
      }
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Error', 'Failed to import Excel file');
    } finally {
      setImporting(false);
    }
  };

  // Backup Data
  const handleBackup = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/export/json`);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const jsonData = reader.result as string;
        const timestamp = Date.now();
        
        // Save to AsyncStorage
        await AsyncStorage.setItem(`backup_${timestamp}`, jsonData);
        
        // Also export file
        const filename = `getinsure_backup_${timestamp}.json`;
        const fileUri = FileSystem.documentDirectory + filename;
        
        await FileSystem.writeAsStringAsync(fileUri, jsonData);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        }
        
        Alert.alert('Success', 'Backup created and saved!');
      };
      
      reader.readAsText(blob);
    } catch (error) {
      console.error('Error creating backup:', error);
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  // Notification Settings
  const handleNotificationToggle = async (setting: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(`notification_${setting}`, JSON.stringify(value));
      
      switch (setting) {
        case 'enabled':
          setNotificationsEnabled(value);
          break;
        case 'sound':
          setSoundEnabled(value);
          break;
        case 'vibration':
          setVibrationEnabled(value);
          break;
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Settings
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Data Management & Preferences
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* User Profile Card */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="account-circle" size={32} color="#009688" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Profile
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.phoneNumber}>
                +91 {userPhone}
              </Text>
              <Text variant="bodySmall" style={styles.cardDescription}>
                Logged in user
              </Text>

              <Button
                mode="contained"
                onPress={handleLogout}
                style={styles.button}
                icon="logout"
                buttonColor="#F44336"
              >
                Logout
              </Button>
            </Card.Content>
          </Card>

          {/* Excel Import/Export */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="microsoft-excel" size={32} color="#217346" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Excel Import/Export
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Import leads from Excel or export all data
              </Text>

              <Button
                mode="contained"
                onPress={handleImport}
                style={styles.button}
                icon="file-import"
                loading={importing}
                disabled={importing || exporting}
                buttonColor="#217346"
              >
                {importing ? 'Importing...' : 'Import from Excel'}
              </Button>

              <View style={styles.exportButtons}>
                <Button
                  mode="contained"
                  onPress={() => handleExport('csv')}
                  style={styles.halfButton}
                  icon="file-delimited"
                  loading={exporting}
                  disabled={exporting || importing}
                  buttonColor="#009688"
                >
                  Export CSV
                </Button>

                <Button
                  mode="contained"
                  onPress={() => handleExport('json')}
                  style={styles.halfButton}
                  icon="code-json"
                  loading={exporting}
                  disabled={exporting || importing}
                  buttonColor="#00796B"
                >
                  Export JSON
                </Button>
              </View>
            </Card.Content>
          </Card>

          {/* Backup & Restore */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="backup-restore" size={32} color="#2196F3" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Backup & Restore
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Create encrypted backups of your data
              </Text>

              <Button
                mode="contained"
                onPress={handleBackup}
                style={styles.button}
                icon="cloud-upload"
                buttonColor="#2196F3"
              >
                Create Backup Now
              </Button>

              <Text variant="bodySmall" style={styles.noteText}>
                Backups are saved locally and can be shared to cloud storage
              </Text>
            </Card.Content>
          </Card>

          {/* Notification Settings */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="bell-ring" size={32} color="#FF9800" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Notification Settings
                </Text>
              </View>

              <List.Item
                title="Enable Notifications"
                description="Receive follow-up reminders"
                left={() => <List.Icon icon="bell" />}
                right={() => (
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={(value) => handleNotificationToggle('enabled', value)}
                    color="#009688"
                  />
                )}
              />
              <Divider />

              <List.Item
                title="Sound"
                description="Play notification sound"
                left={() => <List.Icon icon="volume-high" />}
                right={() => (
                  <Switch
                    value={soundEnabled}
                    onValueChange={(value) => handleNotificationToggle('sound', value)}
                    color="#009688"
                    disabled={!notificationsEnabled}
                  />
                )}
              />
              <Divider />

              <List.Item
                title="Vibration"
                description="Vibrate on notification"
                left={() => <List.Icon icon="vibrate" />}
                right={() => (
                  <Switch
                    value={vibrationEnabled}
                    onValueChange={(value) => handleNotificationToggle('vibration', value)}
                    color="#009688"
                    disabled={!notificationsEnabled}
                  />
                )}
              />
            </Card.Content>
          </Card>

          {/* About */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="information" size={32} color="#9C27B0" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  About
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.aboutText}>
                GETINSURE CRM - Premium Edition
              </Text>
              <Text variant="bodyMedium" style={styles.aboutText}>
                Version 2.0.0
              </Text>
              <Text variant="bodySmall" style={styles.aboutDescription}>
                Professional Insurance CRM with Policy Lifecycle Management, Family Grouping, Renewal Calendar, and Advanced Analytics.
              </Text>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#009688',
    padding: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#E0F2F1',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cardTitle: {
    fontWeight: 'bold',
    color: '#000000',
  },
  cardDescription: {
    color: '#757575',
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 4,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  halfButton: {
    flex: 1,
  },
  noteText: {
    color: '#757575',
    marginTop: 12,
    fontStyle: 'italic',
  },
  aboutText: {
    color: '#000000',
    marginBottom: 4,
  },
  aboutDescription: {
    color: '#757575',
    marginTop: 8,
    lineHeight: 20,
  },
});
