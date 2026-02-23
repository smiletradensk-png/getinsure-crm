import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Lead {
  id: string;
  name: string;
  mobile: string;
  product: string;
  status: string;
  next_followup_date?: string;
  next_followup_time?: string;
}

export default function FollowupsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('today');

  const fetchFollowups = async (filterType: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/followups?filter=${filterType}`);
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching followups:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFollowups(filter);
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFollowups(filter);
  };

  const handleCall = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  const handleWhatsApp = (mobile: string) => {
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/91${cleanMobile}`);
  };

  const getFollowupColor = (date?: string) => {
    if (!date) return '#757575';
    const today = new Date().toISOString().split('T')[0];
    if (date < today) return '#F44336'; // Overdue - Red
    if (date === today) return '#FF9800'; // Today - Orange
    return '#4CAF50'; // Upcoming - Green
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
          Follow-ups
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {leads.length} follow-ups
        </Text>
      </View>

      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            { value: 'overdue', label: 'Overdue' },
            { value: 'today', label: 'Today' },
            { value: 'upcoming', label: 'Upcoming' },
          ]}
          style={styles.segmented}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009688']} />
        }
      >
        <View style={styles.content}>
          {leads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="calendar-check" size={64} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyText}>
                No follow-ups found
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>
                All caught up!
              </Text>
            </View>
          ) : (
            leads.map((lead) => (
              <Card
                key={lead.id}
                style={[
                  styles.leadCard,
                  { borderLeftWidth: 4, borderLeftColor: getFollowupColor(lead.next_followup_date) },
                ]}
              >
                <Card.Content>
                  <View style={styles.leadHeader}>
                    <View style={styles.leadInfo}>
                      <Text variant="titleLarge" style={styles.leadName}>
                        {lead.name}
                      </Text>
                      <Text variant="bodyMedium" style={styles.leadMobile}>
                        {lead.mobile}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.chipContainer}>
                    <Chip style={styles.chip}>{lead.product}</Chip>
                    <Chip style={styles.chip}>{lead.status}</Chip>
                  </View>

                  {lead.premium_amount > 0 && (
                    <Text variant="bodyMedium" style={styles.leadPremium}>
                      Premium: ₹{lead.premium_amount.toLocaleString()}
                    </Text>
                  )}

                  {lead.next_followup_date && (
                    <View style={styles.dateContainer}>
                      <MaterialCommunityIcons
                        name="calendar"
                        size={20}
                        color={getFollowupColor(lead.next_followup_date)}
                      />
                      <Text
                        variant="bodyMedium"
                        style={[styles.followupDate, { color: getFollowupColor(lead.next_followup_date) }]}
                      >
                        {lead.next_followup_date}
                      </Text>
                    </View>
                  )}

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.callButton]}
                      onPress={() => handleCall(lead.mobile)}
                    >
                      <MaterialCommunityIcons name="phone" size={20} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.whatsappButton]}
                      onPress={() => handleWhatsApp(lead.mobile)}
                    >
                      <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.viewButton]}
                      onPress={() => router.push(`/lead-detail?id=${lead.id}`)}
                    >
                      <MaterialCommunityIcons name="eye" size={20} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
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
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#E0F2F1',
    marginTop: 4,
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  segmented: {
    marginBottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#757575',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#BDBDBD',
    marginTop: 8,
  },
  leadCard: {
    marginBottom: 16,
    elevation: 2,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontWeight: 'bold',
    color: '#000000',
  },
  leadMobile: {
    color: '#757575',
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  chip: {
    height: 28,
  },
  leadPremium: {
    color: '#009688',
    fontWeight: 'bold',
    marginTop: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  followupDate: {
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  viewButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
