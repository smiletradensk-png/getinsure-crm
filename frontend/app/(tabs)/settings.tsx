import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SettingsScreen() {
  const [exporting, setExporting] = useState(false);

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
          const filename = `getinsure_export_${Date.now()}.${format}`;
          const fileUri = FileSystem.documentDirectory + filename;
          
          // Remove base64 prefix
          const base64 = base64data.split(',')[1];
          
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType: format === 'csv' ? 'text/csv' : 'application/json',
              dialogTitle: `Export GETINSURE CRM Data (${format.toUpperCase()})`,
            });
          }
          
          Alert.alert('Success', `Data exported successfully as ${format.toUpperCase()}`);
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

  const handleViewReports = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reports`);
      const data = await response.json();
      
      let reportText = `GETINSURE CRM - Analytics Report\n\n`;
      reportText += `Total Business Premium: ₹${data.total_business_premium.toLocaleString()}\n`;
      reportText += `Monthly Business: ₹${data.monthly_business.toLocaleString()}\n`;
      reportText += `Closing Ratio: ${data.closing_ratio}%\n`;
      reportText += `Lead Conversion: ${data.lead_conversion}%\n\n`;
      reportText += `Source Performance:\n`;
      
      Object.entries(data.source_performance).forEach(([source, stats]: [string, any]) => {
        reportText += `  ${source}: ${stats.closed}/${stats.total} closed\n`;
      });
      
      Alert.alert('Analytics Report', reportText, [{ text: 'OK' }], { 
        userInterfaceStyle: 'light' 
      });
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to fetch reports');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Settings
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Export & Analytics
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Export Section */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="export" size={32} color="#009688" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Export Data
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Export all your leads data in different formats
              </Text>

              <Button
                mode="contained"
                onPress={() => handleExport('csv')}
                style={styles.button}
                icon="file-delimited"
                loading={exporting}
                disabled={exporting}
                buttonColor="#009688"
              >
                Export as CSV
              </Button>

              <Button
                mode="contained"
                onPress={() => handleExport('json')}
                style={styles.button}
                icon="code-json"
                loading={exporting}
                disabled={exporting}
                buttonColor="#00796B"
              >
                Export as JSON
              </Button>
            </Card.Content>
          </Card>

          {/* Analytics Section */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="chart-bar" size={32} color="#2196F3" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Analytics & Reports
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                View detailed business analytics and performance metrics
              </Text>

              <Button
                mode="contained"
                onPress={handleViewReports}
                style={styles.button}
                icon="chart-line"
                buttonColor="#2196F3"
              >
                View Analytics Report
              </Button>
            </Card.Content>
          </Card>

          {/* About Section */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="information" size={32} color="#FF9800" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  About
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.aboutText}>
                GETINSURE CRM
              </Text>
              <Text variant="bodyMedium" style={styles.aboutText}>
                Version 1.0.0
              </Text>
              <Text variant="bodySmall" style={styles.aboutDescription}>
                Professional Insurance Advisor CRM for managing leads, follow-ups, and closing deals.
              </Text>
            </Card.Content>
          </Card>

          {/* Quick Stats */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="shield-check" size={32} color="#4CAF50" />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Data Storage
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                All your data is securely stored in MongoDB database. Regular backups recommended.
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
