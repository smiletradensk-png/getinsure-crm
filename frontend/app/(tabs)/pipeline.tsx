import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Lead {
  id: string;
  name: string;
  status: string;
}

export default function PipelineScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stages = ['New', 'Contacted', 'Interested', 'Proposal', 'Closed'];

  const fetchLeads = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/leads`);
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const getStageLeads = (stage: string) => {
    return leads.filter((lead) => lead.status === stage);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'New':
        return '#2196F3';
      case 'Contacted':
        return '#FF9800';
      case 'Interested':
        return '#4CAF50';
      case 'Proposal':
        return '#9C27B0';
      case 'Closed':
        return '#00796B';
      default:
        return '#757575';
    }
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
          Pipeline
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          Sales Pipeline Overview
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009688']} />
        }
      >
        <View style={styles.content}>
          {stages.map((stage) => {
            const stageLeads = getStageLeads(stage);
            const stageValue = getStageValue(stage);

            return (
              <Card
                key={stage}
                style={[styles.stageCard, { borderLeftWidth: 6, borderLeftColor: getStageColor(stage) }]}
              >
                <Card.Content>
                  <View style={styles.stageHeader}>
                    <Text variant="titleLarge" style={styles.stageTitle}>
                      {stage}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: getStageColor(stage) }]}>
                      <Text style={styles.badgeText}>{stageLeads.length}</Text>
                    </View>
                  </View>

                  <Text variant="headlineSmall" style={styles.stageValue}>
                    ₹{stageValue.toLocaleString()}
                  </Text>

                  {stageLeads.length > 0 && (
                    <View style={styles.leadsList}>
                      {stageLeads.slice(0, 3).map((lead) => (
                        <View key={lead.id} style={styles.leadItem}>
                          <Text variant="bodyMedium" style={styles.leadName}>
                            • {lead.name}
                          </Text>
                          {lead.premium_amount > 0 && (
                            <Text variant="bodySmall" style={styles.leadPremium}>
                              ₹{lead.premium_amount.toLocaleString()}
                            </Text>
                          )}
                        </View>
                      ))}
                      {stageLeads.length > 3 && (
                        <Text variant="bodySmall" style={styles.moreText}>
                          +{stageLeads.length - 3} more
                        </Text>
                      )}
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          })}

          {/* Summary Card */}
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.summaryTitle}>
                Pipeline Summary
              </Text>
              <View style={styles.summaryRow}>
                <Text variant="bodyLarge">Total Leads:</Text>
                <Text variant="bodyLarge" style={styles.summaryValue}>
                  {leads.length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodyLarge">Total Value:</Text>
                <Text variant="bodyLarge" style={styles.summaryValue}>
                  ₹{leads.reduce((sum, lead) => sum + (lead.premium_amount || 0), 0).toLocaleString()}
                </Text>
              </View>
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
  stageCard: {
    marginBottom: 16,
    elevation: 2,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stageTitle: {
    fontWeight: 'bold',
    color: '#000000',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stageValue: {
    color: '#009688',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  leadsList: {
    marginTop: 8,
  },
  leadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leadName: {
    flex: 1,
    color: '#424242',
  },
  leadPremium: {
    color: '#757575',
  },
  moreText: {
    color: '#757575',
    fontStyle: 'italic',
    marginTop: 4,
  },
  summaryCard: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#E0F2F1',
    elevation: 2,
  },
  summaryTitle: {
    fontWeight: 'bold',
    color: '#00796B',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryValue: {
    fontWeight: 'bold',
    color: '#009688',
  },
});
