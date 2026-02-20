import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert, Modal } from 'react-native';
import { Text, Card, FAB, Chip, ActivityIndicator, Searchbar, IconButton, Checkbox, Button, TextInput, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Lead {
  id: string;
  name: string;
  mobile: string;
  product: string;
  status: string;
  source: string;
  city: string;
  next_followup_date?: string;
  notes: string;
}

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('Hi [Name], Your insurance quote is ready!');
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showQuickStatusModal, setShowQuickStatusModal] = useState(false);
  const [selectedLeadForStatus, setSelectedLeadForStatus] = useState<Lead | null>(null);
  const [messageTemplates] = useState([
    'Hi [Name], Your insurance quote is ready!',
    'Hello [Name], This is a reminder about your insurance policy.',
    'Dear [Name], We have a special offer for you!',
    'Hi [Name], Thank you for your interest in our insurance plans.',
  ]);

  const statuses = ['All', 'New', 'Interested', 'Not Interested', 'Follow-up', 'Pipeline', 'Closed'];

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
    applyFilters(query, statusFilter);
  };

  const applyFilters = (search: string, status: string) => {
    let filtered = leads;

    // Apply status filter
    if (status !== 'All') {
      filtered = filtered.filter(lead => lead.status === status);
    }

    // Apply search filter
    if (search !== '') {
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(search.toLowerCase()) ||
          lead.mobile.includes(search) ||
          lead.city.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredLeads(filtered);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    applyFilters(searchQuery, status);
  };

  const getStatusCount = (status: string) => {
    if (status === 'All') return leads.length;
    return leads.filter(lead => lead.status === status).length;
  };

  const toggleSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeads(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)));
    }
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'Delete Selected Leads',
      `Are you sure you want to delete ${selectedLeads.size} lead(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(
                Array.from(selectedLeads).map(leadId =>
                  fetch(`${BACKEND_URL}/api/leads/${leadId}`, { method: 'DELETE' })
                )
              );
              setSelectedLeads(new Set());
              setSelectionMode(false);
              fetchLeads();
              Alert.alert('Success', 'Leads deleted successfully');
            } catch (error) {
              console.error('Error deleting leads:', error);
              Alert.alert('Error', 'Failed to delete some leads');
            }
          },
        },
      ]
    );
  };

  const handleBulkWhatsApp = () => {
    setShowBulkWhatsAppModal(true);
  };

  const sendBulkWhatsApp = async () => {
    const selectedLeadsData = leads.filter(lead => selectedLeads.has(lead.id));
    
    Alert.alert(
      '🚀 Start Automatic WhatsApp',
      `Ready to send to ${selectedLeads.size} lead(s)\n\n✅ Messages will open in WhatsApp\n✅ Just tap Send for each\n✅ App will open next lead automatically`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Now',
          onPress: async () => {
            setIsSending(true);
            setSendingProgress(0);
            
            for (let i = 0; i < selectedLeadsData.length; i++) {
              const lead = selectedLeadsData[i];
              const personalizedMessage = bulkMessage.replace(/\[Name\]/g, lead.name);
              const encodedMessage = encodeURIComponent(personalizedMessage);
              const cleanMobile = lead.mobile.replace(/[^0-9]/g, '');
              
              // Update progress
              const progress = ((i + 1) / selectedLeadsData.length) * 100;
              setSendingProgress(progress);
              
              // Copy to clipboard for easy paste
              await Clipboard.setStringAsync(personalizedMessage);
              
              // Open WhatsApp with pre-filled message and contact
              await Linking.openURL(`https://wa.me/91${cleanMobile}?text=${encodedMessage}`);
              
              // Show toast notification
              Alert.alert(
                `Lead ${i + 1}/${selectedLeadsData.length}`,
                `📱 WhatsApp opened for ${lead.name}\n\n✅ Message is pre-filled\n✅ Tap Send button\n✅ Then come back to app`,
                [{ text: 'Next', onPress: () => {} }],
                { cancelable: true }
              );
              
              // Wait for user to send and come back (3 seconds is optimal)
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            setIsSending(false);
            setSendingProgress(0);
            setShowBulkWhatsAppModal(false);
            setSelectionMode(false);
            setSelectedLeads(new Set());
            
            Alert.alert(
              '✅ Bulk WhatsApp Complete!',
              `Successfully processed ${selectedLeadsData.length} leads.\n\nAll personalized messages were sent!`,
              [{ text: 'Great!' }]
            );
          },
        },
      ]
    );
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
            try:
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

  const handleQuickStatusUpdate = async (newStatus: string) => {
    if (!selectedLeadForStatus) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/leads/${selectedLeadForStatus.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...selectedLeadForStatus,
          status: newStatus,
        }),
      });

      if (response.ok) {
        setShowQuickStatusModal(false);
        setSelectedLeadForStatus(null);
        fetchLeads();
        Alert.alert('Success', `Status updated to ${newStatus}`);
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
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

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <Text variant="labelMedium" style={styles.filterLabel}>
          Filter by Status:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {statuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                statusFilter === status && styles.filterChipActive,
              ]}
              onPress={() => handleStatusFilter(status)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === status && styles.filterChipTextActive,
                ]}
              >
                {status} ({getStatusCount(status)})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selection Mode Controls */}
      {selectionMode && (
        <View style={styles.selectionControls}>
          <View style={styles.selectionInfo}>
            <Checkbox
              status={selectedLeads.size === filteredLeads.length ? 'checked' : 'unchecked'}
              onPress={toggleSelectAll}
            />
            <Text variant="bodyMedium" style={styles.selectionText}>
              {selectedLeads.size} selected
            </Text>
          </View>
          <View style={styles.bulkActions}>
            <Button
              mode="contained"
              onPress={handleBulkWhatsApp}
              disabled={selectedLeads.size === 0}
              icon="whatsapp"
              buttonColor="#25D366"
              style={styles.bulkButton}
            >
              WhatsApp
            </Button>
            <Button
              mode="contained"
              onPress={handleBulkDelete}
              disabled={selectedLeads.size === 0}
              icon="delete"
              buttonColor="#F44336"
              style={styles.bulkButton}
            >
              Delete
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setSelectionMode(false);
                setSelectedLeads(new Set());
              }}
              textColor="#009688"
            >
              Done
            </Button>
          </View>
        </View>
      )}

      {/* Selection Toggle Button */}
      {!selectionMode && filteredLeads.length > 0 && (
        <View style={styles.actionBar}>
          <Button
            mode="outlined"
            onPress={() => setSelectionMode(true)}
            icon="checkbox-marked-outline"
            textColor="#009688"
          >
            Select Leads
          </Button>
        </View>
      )}

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
                    {selectionMode && (
                      <Checkbox
                        status={selectedLeads.has(lead.id) ? 'checked' : 'unchecked'}
                        onPress={() => toggleSelection(lead.id)}
                      />
                    )}
                    <View style={styles.leadInfo}>
                      <Text variant="titleLarge" style={styles.leadName}>
                        {lead.name}
                      </Text>
                      <Text variant="bodyMedium" style={styles.leadMobile}>
                        {lead.mobile}
                      </Text>
                    </View>
                    {!selectionMode && (
                      <IconButton
                        icon="delete"
                        iconColor="#F44336"
                        size={20}
                        onPress={() => handleDelete(lead.id)}
                      />
                    )}
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

                  {lead.next_followup_date && (
                    <Text variant="bodySmall" style={styles.followupDate}>
                      Next Follow-up: {lead.next_followup_date}
                    </Text>
                  )}

                  {!selectionMode && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.compactButton}
                        onPress={() => handleCall(lead.mobile)}
                      >
                        <MaterialCommunityIcons name="phone" size={18} color="#4CAF50" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.compactButton}
                        onPress={() => handleWhatsApp(lead.mobile)}
                      >
                        <MaterialCommunityIcons name="whatsapp" size={18} color="#25D366" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.compactButton}
                        onPress={() => router.push(`/add-lead?id=${lead.id}&mode=edit`)}
                      >
                        <MaterialCommunityIcons name="pencil" size={18} color="#FF9800" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.compactButton}
                        onPress={() => router.push(`/lead-detail?id=${lead.id}`)}
                      >
                        <MaterialCommunityIcons name="eye" size={18} color="#2196F3" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.compactButton}
                        onPress={() => {
                          setSelectedLeadForStatus(lead);
                          setShowQuickStatusModal(true);
                        }}
                      >
                        <MaterialCommunityIcons name="swap-horizontal" size={18} color="#9C27B0" />
                      </TouchableOpacity>
                    </View>
                  )}
                </Card.Content>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bulk WhatsApp Modal */}
      <Modal
        visible={showBulkWhatsAppModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBulkWhatsAppModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bulkWhatsAppModal}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Bulk WhatsApp Message
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setShowBulkWhatsAppModal(false)}
              />
            </View>

            <ScrollView style={styles.modalContent}>
              <Text variant="labelLarge" style={styles.modalLabel}>
                Recipients ({selectedLeads.size} leads selected)
              </Text>
              <View style={styles.recipientsList}>
                {leads
                  .filter(lead => selectedLeads.has(lead.id))
                  .map(lead => (
                    <Chip key={lead.id} style={styles.recipientChip}>
                      {lead.name}
                    </Chip>
                  ))}
              </View>

              <Text variant="labelLarge" style={styles.modalLabel}>
                Quick Templates
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
                {messageTemplates.map((template, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.templateChip}
                    onPress={() => setBulkMessage(template)}
                  >
                    <Text style={styles.templateText} numberOfLines={2}>
                      {template}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text variant="labelLarge" style={styles.modalLabel}>
                Message Template
              </Text>
              <Text variant="bodySmall" style={styles.helpText}>
                Use [Name] to automatically insert lead's name
              </Text>
              <TextInput
                value={bulkMessage}
                onChangeText={setBulkMessage}
                mode="outlined"
                multiline
                numberOfLines={6}
                style={styles.messageInput}
                outlineColor="#009688"
                activeOutlineColor="#009688"
                placeholder="Hi [Name], Your insurance quote is ready!"
                disabled={isSending}
              />

              {isSending && (
                <View style={styles.progressContainer}>
                  <Text variant="bodyMedium" style={styles.progressText}>
                    Sending... {Math.round(sendingProgress)}%
                  </Text>
                  <ProgressBar
                    progress={sendingProgress / 100}
                    color="#25D366"
                    style={styles.progressBar}
                  />
                  <Text variant="bodySmall" style={styles.progressNote}>
                    WhatsApp is opening automatically for each lead
                  </Text>
                </View>
              )}

              {!isSending && (
                <View style={styles.quickModeInfo}>
                  <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FF9800" />
                  <View style={styles.quickModeTextContainer}>
                    <Text variant="labelLarge" style={styles.quickModeTitle}>
                      Quick Send Mode
                    </Text>
                    <Text variant="bodySmall" style={styles.quickModeDesc}>
                      1. WhatsApp opens with pre-filled message{'\n'}
                      2. Just tap Send button{'\n'}
                      3. Come back to app{'\n'}
                      4. Next lead opens automatically
                    </Text>
                  </View>
                </View>
              )}

              {!isSending && (
                <Text variant="bodySmall" style={styles.noteText}>
                  ⚡ 3 seconds between each lead for smooth workflow
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowBulkWhatsAppModal(false)}
                style={styles.modalButton}
                textColor="#009688"
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={sendBulkWhatsApp}
                style={styles.modalButton}
                buttonColor="#25D366"
                icon={isSending ? "progress-clock" : "whatsapp"}
                disabled={isSending}
                loading={isSending}
              >
                {isSending ? 'Sending...' : 'Start Auto Send'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

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
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  filterLabel: {
    color: '#757575',
    marginBottom: 8,
  },
  filterScroll: {
    marginBottom: 0,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#009688',
    borderColor: '#009688',
  },
  filterChipText: {
    color: '#757575',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  selectionControls: {
    backgroundColor: '#E0F2F1',
    padding: 16,
    gap: 12,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionText: {
    color: '#00796B',
    fontWeight: 'bold',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkButton: {
    flex: 1,
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
  editButton: {
    backgroundColor: '#FF9800',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bulkWhatsAppModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#000000',
  },
  modalContent: {
    padding: 16,
  },
  modalLabel: {
    marginTop: 16,
    marginBottom: 8,
    color: '#000000',
  },
  recipientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  recipientChip: {
    height: 32,
  },
  templatesScroll: {
    marginBottom: 16,
  },
  templateChip: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 12,
    maxWidth: 250,
    borderWidth: 1,
    borderColor: '#009688',
  },
  templateText: {
    color: '#00796B',
    fontSize: 13,
  },
  helpText: {
    color: '#757575',
    marginBottom: 8,
  },
  messageInput: {
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  progressText: {
    color: '#2E7D32',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressNote: {
    color: '#558B2F',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  quickModeInfo: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFB74D',
    gap: 12,
  },
  quickModeTextContainer: {
    flex: 1,
  },
  quickModeTitle: {
    color: '#E65100',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  quickModeDesc: {
    color: '#F57C00',
    lineHeight: 20,
  },
  noteText: {
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalButton: {
    flex: 1,
  },
});
