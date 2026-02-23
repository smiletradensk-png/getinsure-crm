import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface DashboardStats {
  total_leads: number;
  today_followups: number;
  overdue_followups: number;
  interested_leads: number;
  closed_leads: number;
  monthly_business_count: number;
  monthly_closing_ratio: number;
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dashboard/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          GETINSURE CRM
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Dashboard
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009688']} />
        }
      >
        <View style={styles.content}>
          {/* First Row */}
          <View style={styles.row}>
            <Card style={[styles.card, styles.primaryCard]}>
              <Card.Content>
                <Text variant="displayMedium" style={styles.cardNumber}>
                  {stats?.total_leads || 0}
                </Text>
                <Text variant="bodyMedium" style={styles.cardLabel}>
                  Total Leads
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.card, styles.warningCard]}>
              <Card.Content>
                <Text variant="displayMedium" style={styles.cardNumber}>
                  {stats?.today_followups || 0}
                </Text>
                <Text variant="bodyMedium" style={styles.cardLabel}>
                  Today's Follow-ups
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* Second Row */}
          <View style={styles.row}>
            <Card style={[styles.card, styles.dangerCard]}>
              <Card.Content>
                <Text variant="displayMedium" style={styles.cardNumber}>
                  {stats?.overdue_followups || 0}
                </Text>
                <Text variant="bodyMedium" style={styles.cardLabel}>
                  Overdue Follow-ups
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.card, styles.infoCard]}>
              <Card.Content>
                <Text variant="displayMedium" style={styles.cardNumber}>
                  {stats?.interested_leads || 0}
                </Text>
                <Text variant="bodyMedium" style={styles.cardLabel}>
                  Interested Leads
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* Third Row */}
          <View style={styles.row}>
            <Card style={[styles.card, styles.successCard]}>
              <Card.Content>
                <Text variant="displayMedium" style={styles.cardNumber}>
                  {stats?.closed_leads || 0}
                </Text>
                <Text variant="bodyMedium" style={styles.cardLabel}>
                  Closed Leads
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.card, styles.secondaryCard]}>
              <Card.Content>
                <Text variant="displayMedium" style={styles.cardNumber}>
                  {stats?.monthly_business_count || 0}
                </Text>
                <Text variant="bodyMedium" style={styles.cardLabel}>
                  Monthly Business
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* Full Width Card */}
          <Card style={[styles.fullCard, styles.primaryCard]}>
            <Card.Content>
              <Text variant="displayMedium" style={styles.cardNumber}>
                {stats?.monthly_closing_ratio || 0}%
              </Text>
              <Text variant="bodyMedium" style={styles.cardLabel}>
                Monthly Closing Ratio
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  card: {
    flex: 1,
    elevation: 2,
  },
  fullCard: {
    marginBottom: 16,
    elevation: 2,
  },
  primaryCard: {
    backgroundColor: '#009688',
  },
  secondaryCard: {
    backgroundColor: '#00796B',
  },
  warningCard: {
    backgroundColor: '#FF9800',
  },
  dangerCard: {
    backgroundColor: '#F44336',
  },
  successCard: {
    backgroundColor: '#4CAF50',
  },
  infoCard: {
    backgroundColor: '#2196F3',
  },
  cardNumber: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardLabel: {
    color: '#FFFFFF',
  },
});
