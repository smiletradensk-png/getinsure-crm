import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert, Modal, Platform } from 'react-native';
import { Text, Card, FAB, Chip, ActivityIndicator, Searchbar, IconButton, Checkbox, Button, TextInput, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { getAllLeadsLocal, deleteLeadLocal, initializeDatabase } from '../../utils/database';

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
  const [selectedMedia, setSelectedMedia] = useState<{uri: string, type: 'image' | 'video'} | null>(null);

  const statuses = ['All', 'New', 'Interested', 'Not Interested', 'Follow-up', 'Pipeline', 'Closed'];

  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  };

  const fetchLeads = async () => {
    try {
      await initializeDatabase();
      const data = getAllLeadsLocal();
      setLeads(data);
      applyFilters(searchQuery, statusFilter, data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-refresh when screen gets focus
  useFocusEffect(
    useCallback(() => {
      fetchLeads();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const onSearchChange = (query: string) => {
    setSearchQuery(query);
    applyFilters(query, statusFilter, leads);
  };

  const applyFilters = (search: string, status: string, data: Lead[] = leads) => {
    let filtered = data;
    if (status !== 'All') filtered = filtered.filter(lead => lead.status === status);
    if (search !== '') {
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(search.toLowerCase()) ||
          lead.mobile.includes(search) ||
          (lead.city || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    setFilteredLeads(filtered);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    applyFilters(searchQuery, status, leads);
  };

  const getStatusCount = (status: string) => {
    if (status === 'All') return leads.length;
    return leads.filter(lead => lead.status === status).length;
  };

  const toggleSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) newSelection.delete(leadId);
    else newSelection.add(leadId);
    setSelectedLeads(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) setSelectedLeads(new Set());
    else setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)));
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'Delete Selected Leads',
      `Are you sure you want to delete ${selectedLeads.size} lead(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            Array.from(selectedLeads).forEach(leadId => deleteLeadLocal(leadId));
            setSelectedLeads(new Set());
            setSelectionMode(false);
            fetchLeads();
            Alert.alert('Success', 'Leads deleted successfully');
          },
        },
      ]
    );
  };

  const handleDelete = (leadId: string) => {
    Alert.alert('Delete Lead', 'Are you sure you want to delete this lead?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteLeadLocal(leadId);
          fetchLeads();
        },
      },
    ]);
  };

  const handleBulkWhatsApp = () => {
    setShowBulkWhatsAppModal(true);
    setSelectedMedia(null);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) { Alert.alert('Permission Required', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setSelectedMedia({ uri: result.assets[0].uri, type: 'image' });
  };

  const sendBulkWhatsApp = async () => {
    const selectedLeadsData = leads.filter(lead => selectedLeads.has(lead.id));
    Alert.alert(
      '🚀 Start Bulk WhatsApp',
      `Ready to send to ${selectedLeads.size} lead(s)\n✅ Messages will open in WhatsApp\n✅ Tap Send for each`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Now',
          onPress: async () => {
            setIsSending(true);
            for (let i = 0; i < selectedLeadsData.length; i++) {
              const lead = selectedLeadsData[i];
              const personalizedMessage = bulkMessage.replace(/\[Name\]/g, lead.name);
              const encodedMessage = encodeURIComponent(personalizedMessage);
              setSendingProgress(((i + 1) / selectedLeadsData.length) * 100);
              await Clipboard.setStringAsync(personalizedMessage);
              const formattedPhone = formatPhoneForWhatsApp(lead.mobile);
              await Linking.openURL(`https://wa.me/${formattedPhone}?text=${encodedMessage}`);
              Alert.alert(`Lead ${i + 1}/${selectedLeadsData.length}`, `📱 WhatsApp opened for ${lead.name}\n✅ Tap Send, then come back`, [{ text: 'Next' }], { cancelable: true });
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            setIsSending(false);
            setSendingProgress(0);
            setShowBulkWhatsAppModal(false);
            setSelectionMode(false);
            setSelectedLeads(new Set());
            Alert.alert('✅ Done!', `Sent to ${selectedLeadsData.length} leads!`);
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return '#2196F3';
      case 'Interested': return '#4CAF50';
      case 'Follow-up': return '#FF9800';
      case 'Pipeline': return '#9C27B0';
      case 'Closed': return '#00796B';
      case 'Not Interested': return '#757575';
      default: return '#757575';
    }
  };

  const handleCall = (mobile: string) => Linking.openURL(`tel:${mobile}`);
  const handleWhatsApp = (mobile: string) => Linking.openURL(`https://wa.me/${formatPhoneForWhatsApp(mobile)}`);

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
        <Text variant="headlineMedium" style={styles.headerTitle}>Leads</Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>{filteredLeads.length} leads found</Text>
      </View>

      <View style={styles.searchContainer}>
        <Searchbar placeholder="Search by name, mobile, or city" onChangeText={onSearchChange} value={searchQuery} style={styles.searchBar} />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {statuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
              onPress={() => handleStatusFilter(status)}
            >
              <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                {status} ({getStatusCount(status)})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectionMode && (
        <View style={styles.selectionControls}>
          <View style={styles.selectionInfo}>
            <Checkbox status={selectedLeads.size === filteredLeads.length ? 'checked' : 'unchecked'} onPress={toggleSelectAll} />
            <Text variant="bodyMedium" style={styles.selectionText}>{selectedLeads.size} selected</Text>
          </View>
          <View style={styles.bulkActions}>
            <Button mode="contained" onPress={handleBulkWhatsApp} disabled={selectedLeads.size === 0} icon="whatsapp" buttonColor="#25D366" style={styles.bulkButton}>WhatsApp</Button>
            <Button mode="contained" onPress={handleBulkDelete} disabled={selectedLeads.size === 0} icon="delete" buttonColor="#F44336" style={styles.bulkButton}>Delete</Button>
            <Button mode="outlined" onPress={() => { setSelectionMode(false); setSelectedLeads(new Set()); }} textColor="#009688">Done</Button>
          </View>
        </View>
      )}

      {!selectionMode && filteredLeads.length > 0 && (
        <View style={styles.actionBar}>
          <Button mode="outlined" onPress={() => setSelectionMode(true)} icon="checkbox-marked-outline" textColor="#009688">Select Leads</Button>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009688']} />}
      >
        <View style={styles.content}>
          {filteredLeads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-off" size={64} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyText}>No leads found</Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>Add your first lead to get started</Text>
            </View>
          ) : (
            filteredLeads.map((lead) => (
              <TouchableOpacity
                key={lead.id}
                onPress={() => selectionMode ? toggleSelection(lead.id) : router.push({ pathname: '/lead-detail', params: { id: lead.id } })}
                activeOpacity={0.7}
              >
                <Card style={styles.leadCard}>
                  <Card.Content>
                    <View style={styles.leadHeader}>
                      {selectionMode && (
                        <Checkbox status={selectedLeads.has(lead.id) ? 'checked' : 'unchecked'} onPress={() => toggleSelection(lead.id)} />
                      )}
                      <View style={styles.leadInfo}>
                        <Text variant="titleLarge" style={styles.leadName}>{lead.name}</Text>
                        <Text variant="bodyMedium" style={styles.leadMobile}>{lead.mobile}</Text>
                        {lead.city ? <Text variant="bodySmall" style={styles.leadCity}>📍 {lead.city}</Text> : null}
                      </View>
                      {!selectionMode && (
                        <IconButton icon="delete" iconColor="#F44336" size={20} onPress={() => handleDelete(lead.id)} />
                      )}
                    </View>

                    <View style={styles.chipContainer}>
                      <Chip style={[styles.statusChip, { backgroundColor: getStatusColor(lead.status) }]} textStyle={{ color: '#FFFFFF' }}>
                        {lead.status}
                      </Chip>
                      <Chip style={styles.chip}>{lead.product}</Chip>
                    </View>

                    {lead.next_followup_date ? (
                      <Text variant="bodySmall" style={styles.followupText}>
                        📅 Follow-up: {lead.next_followup_date}
                      </Text>
                    ) : null}

                    {!selectionMode && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.callButton} onPress={() => handleCall(lead.mobile)}>
                          <MaterialCommunityIcons name="phone" size={20} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.whatsappButton} onPress={() => handleWhatsApp(lead.mobile)}>
                          <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editButton} onPress={() => router.push({ pathname: '/add-lead', params: { id: lead.id, mode: 'edit' } })}>
                          <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <FAB style={styles.fab} icon="plus" onPress={() => router.push('/add-lead')} color="#FFFFFF" />

      {/* Bulk WhatsApp Modal */}
      <Modal visible={showBulkWhatsAppModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="titleLarge" style={styles.modalTitle}>Bulk WhatsApp</Text>
            <Text variant="bodyMedium" style={styles.modalSubtitle}>
              {selectedLeads.size} leads selected
            </Text>
            <Text variant="labelMedium" style={styles.templateLabel}>Message Template:</Text>
            <TextInput
              value={bulkMessage}
              onChangeText={setBulkMessage}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.messageInput}
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />
            <Text variant="bodySmall" style={styles.hintText}>Use [Name] to personalize the message</Text>
            {isSending && (
              <View style={styles.progressContainer}>
                <ProgressBar progress={sendingProgress / 100} color="#009688" style={styles.progressBar} />
                <Text variant="bodySmall" style={styles.progressText}>{Math.round(sendingProgress)}% complete</Text>
              </View>
            )}
            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={() => setShowBulkWhatsAppModal(false)} textColor="#009688" style={styles.modalButton}>Cancel</Button>
              <Button mode="contained" onPress={sendBulkWhatsApp} buttonColor="#25D366" style={styles.modalButton} disabled={isSending}>
                {isSending ? 'Sending...' : 'Send All'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#009688', padding: 16, paddingBottom: 20 },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold' },
  headerSubtitle: { color: '#E0F2F1', marginTop: 4 },
  searchContainer: { padding: 16, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  searchBar: { elevation: 0, backgroundColor: '#F5F5F5' },
  filterContainer: { backgroundColor: '#FFFFFF', paddingBottom: 12 },
  filterScroll: { paddingHorizontal: 16 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8 },
  filterChipActive: { backgroundColor: '#009688' },
  filterChipText: { color: '#757575', fontSize: 12 },
  filterChipTextActive: { color: '#FFFFFF' },
  selectionControls: { backgroundColor: '#E8F5E9', padding: 12 },
  selectionInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  selectionText: { marginLeft: 8 },
  bulkActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  bulkButton: { flex: 1 },
  actionBar: { padding: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  scrollView: { flex: 1 },
  content: { padding: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#BDBDBD', marginTop: 16 },
  emptySubtext: { color: '#BDBDBD', marginTop: 8 },
  leadCard: { marginBottom: 12, elevation: 2, backgroundColor: '#FFFFFF' },
  leadHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  leadInfo: { flex: 1 },
  leadName: { fontWeight: 'bold', color: '#212121' },
  leadMobile: { color: '#757575', marginTop: 2 },
  leadCity: { color: '#9E9E9E', marginTop: 2 },
  chipContainer: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  statusChip: { height: 28 },
  chip: { height: 28, backgroundColor: '#F0F0F0' },
  followupText: { color: '#FF9800', marginBottom: 8 },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  callButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#2196F3', paddingVertical: 8, borderRadius: 8 },
  whatsappButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#25D366', paddingVertical: 8, borderRadius: 8 },
  editButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#009688', paddingVertical: 8, borderRadius: 8 },
  actionButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  fab: { position: 'absolute', right: 16, bottom: 80, backgroundColor: '#009688' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontWeight: 'bold', color: '#000000', marginBottom: 4 },
  modalSubtitle: { color: '#757575', marginBottom: 16 },
  templateLabel: { color: '#009688', marginBottom: 8 },
  messageInput: { marginBottom: 8 },
  hintText: { color: '#9E9E9E', marginBottom: 16 },
  progressContainer: { marginBottom: 16 },
  progressBar: { height: 8, borderRadius: 4 },
  progressText: { color: '#757575', marginTop: 4, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1 },
});
