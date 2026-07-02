import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { getAllLeadsLocal, initializeDatabase } from '../../utils/database';

interface Lead {
  id: string;
  name: string;
  mobile: string;
  status: string;
  product: string;
}

export default function PipelineScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stages = ['New', 'Interested', 'Follow-up', 'Pipeline', 'Closed'];

  const fetchLeads = async () => {
    try {
      await initializeDatabase();
      const data = getAllLeadsLocal();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchLeads();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const getStageLeads = (stage: string) => leads.filter((lead) => lead.status === stage);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'New': return '#2196F3';
      case 'Interested': return '#4CAF50';
      case 'Follow-up': return '#FF9800';
      case 'Pipeline': return '#9C27B0';
      case 'Closed': return '#00796B';
      default: return '#757575';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'New': return 'account-plus';
      case 'Interested': return 'thumb-up';
      case 'Follow-up': return 'calendar-clock';
      case 'Pipeline': return 'trending-up';
      case 'Closed': return 'check-circle';
      default: return 'account';
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
        <Text variant="headlineMedium" style={styles.headerTitle}>Pipeline</Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>Sales Pipeline Overview</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009688']} />}
      >
        <View style={styles.content}>
          {stages.map((stage) => {
            const stageLeads = getStageLeads(stage);
            const color = getStageColor(stage);

            return (
              <Card key={stage} style={[styles.stageCard, { borderLeftWidth: 6, borderLeftColor: color }]}>
                <Card.Content>
                  <View style={styles.stageHeader}>
                    <Text variant="titleLarge" style={styles.stageTitle}>{stage}</Text>
                    <View style={[styles.badge, { backgroundColor: color }]}>
                      <Text style={styles.badgeText}>{stageLeads.length}</Text>
                    </View>
                  </View>

                  {stageLeads.length === 0 ? (
                    <Text style={styles.emptyStageText}>No leads in this stage</Text>
                  ) : (
                    <View style={styles.leadsList}>
                      {stageLeads.slice(0, 5).map((lead) => (
                        // ✅ FIXED: Each lead card is now clickable
                        <TouchableOpacity
                          key={lead.id}
                          style={styles.leadItem}
                          onPress={() => router.push({ pathname: '/lead-detail', params: { id: lead.id } })}
                          activeOpacity={0.7}
                        >
                          <View style={styles.leadItemLeft}>
                            <View style={[styles.leadDot, { backgroundColor: color }]} />
                            <View>
                              <Text variant="bodyMedium" style={styles.leadName}>{lead.name}</Text>
                              <Text variant="bodySmall" style={styles.leadProduct}>{lead.product} • {lead.mobile}</Text>
                            </View>
                          </View>
                          <Text style={[styles.leadArrow, { color }]}>›</Text>
                        </TouchableOpacity>
                      ))}
                      {stageLeads.length > 5 && (
                        <TouchableOpacity
                          onPress={() => router.push('/(tabs)/leads')}
                          style={styles.moreButton}
                        >
                          <Text style={[styles.moreText, { color }]}>
                            +{stageLeads.length - 5} more → View All
                          </Text>
                        </TouchableOpacity>
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
              <Text variant="titleLarge" style={styles.summaryTitle}>Pipeline Summary</Text>
              {stages.map((stage) => (
                <View key={stage} style={styles.summaryRow}>
                  <View style={styles.summaryLeft}>
                    <View style={[styles.summaryDot, { backgroundColor: getStageColor(stage) }]} />
                    <Text variant="bodyLarge">{stage}:</Text>
                  </View>
                  <Text variant="bodyLarge" style={[styles.summaryValue, { color: getStageColor(stage) }]}>
                    {getStageLeads(stage).length}
                  </Text>
                </View>
              ))}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text variant="titleMedium" style={styles.totalLabel}>Total Leads:</Text>
                <Text variant="titleMedium" style={styles.totalValue}>{leads.length}</Text>
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
  stageCard: { marginBottom: 16, elevation: 2 },
  stageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stageTitle: { fontWeight: 'bold', color: '#000000' },
  badge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  emptyStageText: { color: '#BDBDBD', fontStyle: 'italic', marginTop: 4 },
  leadsList: { marginTop: 8 },
  leadItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 8, marginBottom: 6,
    backgroundColor: '#F9F9F9', borderRadius: 8, borderWidth: 1, borderColor: '#EEEEEE',
  },
  leadItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  leadDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  leadName: { color: '#212121', fontWeight: '600' },
  leadProduct: { color: '#757575', marginTop: 2 },
  leadArrow: { fontSize: 22, fontWeight: 'bold', marginLeft: 8 },
  moreButton: { marginTop: 6, paddingVertical: 6 },
  moreText: { fontStyle: 'italic', fontWeight: '600' },
  summaryCard: { marginTop: 8, marginBottom: 16, backgroundColor: '#E0F2F1', elevation: 2 },
  summaryTitle: { fontWeight: 'bold', color: '#00796B', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryDot: { width: 12, height: 12, borderRadius: 6 },
  summaryValue: { fontWeight: 'bold' },
  totalRow: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#B2DFDB', paddingTop: 8 },
  totalLabel: { fontWeight: 'bold', color: '#004D40' },
  totalValue: { fontWeight: 'bold', color: '#009688' },
});
