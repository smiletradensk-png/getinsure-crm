import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text, Card, FAB, Chip, ActivityIndicator, Searchbar, IconButton } from 'react-native-paper';
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
  source: string;
  city: string;
  premium_amount: number;
  next_followup_date?: string;
  notes: string;
}

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLeads = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/leads`);
      const data = await response.json();
      setLeads(data);
      setFilteredLeads(data);
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

  const onSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query === '') {
      setFilteredLeads(leads);
    } else {
      const filtered = leads.filter(
        (lead) =>
          lead.name.toLowerCase().includes(query.toLowerCase()) ||
          lead.mobile.includes(query) ||
          lead.city.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredLeads(filtered);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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
      case 'Not Interested':
        return '#757575';
      default:
        return '#757575';
    }
  };

  const handleCall = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  const handleWhatsApp = (mobile: string) => {
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/91${cleanMobile}`);
  };

  const handleDelete = (leadId: string) => {
    Alert.alert(
      'Delete Lead',
      'Are you sure you want to delete this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/leads/${leadId}`, {
                method: 'DELETE',
              });
              fetchLeads();
            } catch (error) {
              console.error('Error deleting lead:', error);
            }
          },
        },
      ]
    );
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
          Leads
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {filteredLeads.length} leads found
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search by name, mobile, or city"
          onChangeText={onSearchChange}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009688']} />
        }
      >
        <View style={styles.content}>
          {filteredLeads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-off" size={64} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyText}>
                No leads found
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>
                Add your first lead to get started
              </Text>
            </View>
          ) : (
            filteredLeads.map((lead) => (
              <Card key={lead.id} style={styles.leadCard}>
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
                    <IconButton
                      icon="delete"
                      iconColor="#F44336"
                      size={20}
                      onPress={() => handleDelete(lead.id)}
                    />
                  </View>

                  <View style={styles.chipContainer}>
                    <Chip
                      style={[styles.chip, { backgroundColor: getStatusColor(lead.status) }]}
                      textStyle={{ color: '#FFFFFF' }}
                    >
                      {lead.status}
                    </Chip>
                    <Chip style={styles.chip}>{lead.product}</Chip>
                    <Chip style={styles.chip}>{lead.source}</Chip>
                  </View>

                  {lead.city && (
                    <Text variant="bodyMedium" style={styles.leadCity}>
                      City: {lead.city}
                    </Text>
                  )}

                  {lead.premium_amount > 0 && (
                    <Text variant="bodyMedium" style={styles.leadPremium}>
                      Premium: ₹{lead.premium_amount.toLocaleString()}
                    </Text>
                  )}

                  {lead.next_followup_date && (
                    <Text variant="bodySmall" style={styles.followupDate}>
                      Next Follow-up: {lead.next_followup_date}
                    </Text>
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

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/add-lead')}
        color="#FFFFFF"
      />
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
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
  leadCity: {
    color: '#757575',
    marginTop: 4,
  },
  leadPremium: {
    color: '#009688',
    fontWeight: 'bold',
    marginTop: 4,
  },
  followupDate: {
    color: '#FF9800',
    marginTop: 8,
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#009688',
  },
});
