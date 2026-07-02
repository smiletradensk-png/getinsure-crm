import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { getLocalStats, initializeDatabase } from '../../utils/database';

interface DashboardStats {
  total_leads: number;
  today_followups: number;
  overdue_followups: number;
  interested_leads: number;
  closed_leads: number;
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      await initializeDatabase();
      const localStats = getLocalStats();
      setStats(localStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-refresh when screen gets focus
  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009688" />
      </View>
    );
  }

  const closingRatio = stats?.total_leads
    ? Math.round(((stats.closed_leads || 0) / stats.total_leads) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>GETINSURE CRM</Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>Dashboard</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009688']} />}
      >
        <View style={styles.content}>
          <View style={styles.row}>
            <TouchableOpacity style={styles.cardContainer} onPress={() => router.push('/(tabs)/leads')} activeOpacity={0.7}>
              <Card style={[styles.card, styles.primaryCard]}>
                <Card.Content>
                  <Text variant="displayMedium" style={styles.cardNumber}>{stats?.total_leads || 0}</Text>
                  <Text variant="bodyMedium" style={styles.cardLabel}>Total Leads</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardContainer} onPress={() => router.push('/(tabs)/followups')} activeOpacity={0.7}>
              <Card style={[styles.card, styles.warningCard]}>
                <Card.Content>
                  <Text variant="displayMedium" style={styles.cardNumber}>{stats?.today_followups || 0}</Text>
                  <Text variant="bodyMedium" style={styles.cardLabel}>Today's Follow-ups</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.cardContainer} onPress={() => router.push('/(tabs)/followups')} activeOpacity={0.7}>
              <Card style={[styles.card, styles.dangerCard]}>
                <Card.Content>
                  <Text variant="displayMedium" style={styles.cardNumber}>{stats?.overdue_followups || 0}</Text>
                  <Text variant="bodyMedium" style={styles.cardLabel}>Overdue Follow-ups</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardContainer} onPress={() => router.push('/(tabs)/leads')} activeOpacity={0.7}>
              <Card style={[styles.card, styles.infoCard]}>
                <Card.Content>
                  <Text variant="displayMedium" style={styles.cardNumber}>{stats?.interested_leads || 0}</Text>
                  <Text variant="bodyMedium" style={styles.cardLabel}>Interested Leads</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.cardContainer} onPress={() => router.push('/(tabs)/leads')} activeOpacity={0.7}>
              <Card style={[styles.card, styles.successCard]}>
                <Card.Content>
                  <Text variant="displayMedium" style={styles.cardNumber}>{stats?.closed_leads || 0}</Text>
                  <Text variant="bodyMedium" style={styles.cardLabel}>Closed Leads</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardContainer} onPress={() => router.push('/(tabs)/pipeline')} activeOpacity={0.7}>
              <Card style={[styles.card, styles.secondaryCard]}>
                <Card.Content>
                  <Text variant="displayMedium" style={styles.cardNumber}>{closingRatio}%</Text>
                  <Text variant="bodyMedium" style={styles.cardLabel}>Closing Ratio</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <Card style={styles.quickActionsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.quickActionsTitle}>Quick Actions</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.quickAction, { backgroundColor: '#009688' }]} onPress={() => router.push('/add-lead')} activeOpacity={0.7}>
                  <Text style={styles.quickActionText}>➕ Add Lead</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickAction, { backgroundColor: '#FF9800' }]} onPress={() => router.push('/(tabs)/followups')} activeOpacity={0.7}>
                  <Text style={styles.quickActionText}>📅 Follow-ups</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#009688', padding: 16, paddingBottom: 20 },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold' },
  headerSubtitle: { color: '#E0F2F1', marginTop: 4 },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
  cardContainer: { flex: 1 },
  card: { flex: 1, elevation: 2 },
  primaryCard: { backgroundColor: '#009688' },
  secondaryCard: { backgroundColor: '#00796B' },
  warningCard: { backgroundColor: '#FF9800' },
  dangerCard: { backgroundColor: '#F44336' },
  successCard: { backgroundColor: '#4CAF50' },
  infoCard: { backgroundColor: '#2196F3' },
  cardNumber: { color: '#FFFFFF', fontWeight: 'bold', marginBottom: 8 },
  cardLabel: { color: '#FFFFFF' },
  quickActionsCard: { marginBottom: 16, elevation: 2 },
  quickActionsTitle: { fontWeight: 'bold', color: '#009688', marginBottom: 12 },
  quickAction: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  quickActionText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});
