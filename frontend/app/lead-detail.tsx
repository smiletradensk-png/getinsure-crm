import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import {
  Text, Card, Chip, ActivityIndicator, Button,
  TextInput, Checkbox, RadioButton, IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import * as Location from 'expo-location';
import {
  getLeadByIdLocal, saveLeadLocal, initializeDatabase,
  saveInteractionLocal, getInteractionsByLeadId, deleteInteractionLocal,
} from '../utils/database';

const INTERACTION_TYPES = ['Call', 'Meeting', 'Online', 'Email', 'Message', 'Other'];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams();
  const [lead, setLead] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [addingInteraction, setAddingInteraction] = useState(false);

  // Interaction form states
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().split('T')[0]);
  const [interactionTime, setInteractionTime] = useState('10:00');
  const [tagLocation, setTagLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('');
  const [interactionType, setInteractionType] = useState('Call');
  const [interactionNote, setInteractionNote] = useState('');

  // Next appointment states
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentTime, setNextAppointmentTime] = useState('10:00');
  const [nextAppointmentType, setNextAppointmentType] = useState('Call');
  const [nextAppointmentNote, setNextAppointmentNote] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  // Modal states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showNextDatePicker, setShowNextDatePicker] = useState(false);
  const [showNextTimePicker, setShowNextTimePicker] = useState(false);

  const loadData = async () => {
    await initializeDatabase();
    const leadData = getLeadByIdLocal(id as string);
    setLead(leadData);
    const interactionData = getInteractionsByLeadId(id as string);
    setInteractions(interactionData);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch { return dateStr; }
  };

  const handleCall = (mobile: string) => Linking.openURL(`tel:${mobile}`);

  const formatPhoneForWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  };

  const handleWhatsApp = (mobile: string, message?: string) => {
    const phone = formatPhoneForWhatsApp(mobile);
    const url = message
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${phone}`;
    Linking.openURL(url);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Location permission required'); return; }
      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      if (address[0]) {
        const addr = address[0];
        setCurrentLocation(`${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim());
      }
    } catch (error) { Alert.alert('Error', 'Failed to get location'); }
  };

  const resetForm = () => {
    setInteractionDate(new Date().toISOString().split('T')[0]);
    setInteractionTime('10:00');
    setTagLocation(false);
    setCurrentLocation('');
    setInteractionType('Call');
    setInteractionNote('');
    setNextAppointmentDate('');
    setNextAppointmentTime('10:00');
    setNextAppointmentType('Call');
    setNextAppointmentNote('');
    setSendWhatsApp(false);
  };

  const handleSaveInteraction = async () => {
    if (!interactionNote.trim()) { Alert.alert('Error', 'Please enter interaction notes'); return; }
    setAddingInteraction(true);

    try {
      // Save interaction locally
      const result = await saveInteractionLocal({
        lead_id: id,
        type: interactionType,
        description: interactionNote,
        location: tagLocation ? currentLocation : '',
        interaction_date: interactionDate,
        interaction_time: interactionTime,
        next_appointment_date: nextAppointmentDate,
        next_appointment_time: nextAppointmentTime,
        next_appointment_type: nextAppointmentType,
        next_appointment_note: nextAppointmentNote,
        created_at: new Date().toISOString(),
      });

      if (!result.success) throw new Error('Failed to save');

      // Update lead's next followup if next appointment set
      if (nextAppointmentDate && lead) {
        await saveLeadLocal({
          ...lead,
          next_followup_date: nextAppointmentDate,
          next_followup_time: nextAppointmentTime,
          next_followup_type: nextAppointmentType,
          updated_at: new Date().toISOString(),
        });
      }

      // Send WhatsApp if checked
      if (sendWhatsApp && lead) {
        const apptMsg = nextAppointmentDate
          ? `\n\nNext Appointment: ${formatDate(nextAppointmentDate)} at ${nextAppointmentTime}`
          : '';
        handleWhatsApp(lead.mobile, `Hi ${lead.name},\n\nThank you for your time today.${apptMsg}\n\nBest Regards`);
      }

      resetForm();
      setShowAddInteraction(false);
      loadData();
      Alert.alert('Success', 'Interaction saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save interaction');
    } finally {
      setAddingInteraction(false);
    }
  };

  const handleDeleteInteraction = (interactionId: string) => {
    Alert.alert('Delete Interaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { deleteInteractionLocal(interactionId); loadData(); },
      },
    ]);
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

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'Call': return 'phone';
      case 'Message': case 'WhatsApp': return 'whatsapp';
      case 'Meeting': return 'account-group';
      case 'Online': return 'video';
      case 'Email': return 'email';
      default: return 'note-text';
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#009688" /></View>;

  if (!lead) return (
    <View style={styles.loadingContainer}>
      <Text>Lead not found</Text>
      <Button onPress={() => router.back()}>Go Back</Button>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" onPress={() => router.back()} style={styles.backButton} />
        <Text variant="headlineMedium" style={styles.headerTitle}>Lead Details</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/add-lead', params: { id: lead.id, mode: 'edit' } })}>
          <MaterialCommunityIcons name="pencil" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>

            {/* Lead Info Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="headlineSmall" style={styles.leadName}>{lead.name}</Text>
                <Text variant="bodyLarge" style={styles.leadMobile}>{lead.mobile}</Text>

                <View style={styles.chipContainer}>
                  <Chip style={[styles.chip, { backgroundColor: getStatusColor(lead.status) }]} textStyle={{ color: '#FFFFFF' }}>{lead.status}</Chip>
                  <Chip style={styles.chip}>{lead.product}</Chip>
                  {lead.source ? <Chip style={styles.chip}>{lead.source}</Chip> : null}
                </View>

                {lead.city ? (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="map-marker" size={20} color="#757575" />
                    <Text variant="bodyMedium" style={styles.infoText}>{lead.city}</Text>
                  </View>
                ) : null}

                {lead.next_followup_date ? (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color="#FF9800" />
                    <Text variant="bodyMedium" style={[styles.infoText, { color: '#FF9800', fontWeight: 'bold' }]}>
                      Next: {formatDate(lead.next_followup_date)} {lead.next_followup_time || ''}
                    </Text>
                  </View>
                ) : null}

                {lead.notes ? (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="note-text" size={20} color="#757575" />
                    <Text variant="bodyMedium" style={styles.infoText}>{lead.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#4CAF50' }]} onPress={() => handleCall(lead.mobile)}>
                    <MaterialCommunityIcons name="phone" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#25D366' }]} onPress={() => handleWhatsApp(lead.mobile)}>
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>

            {/* Add Interaction Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.sectionTitle}>Add Interaction</Text>

                {!showAddInteraction ? (
                  <Button mode="contained" onPress={() => setShowAddInteraction(true)} icon="plus" buttonColor="#009688">
                    Add New Interaction
                  </Button>
                ) : (
                  <View style={styles.interactionForm}>
                    <View style={styles.formHeader}>
                      <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Interaction Entry</Text>
                      <View style={{ flexDirection: 'row' }}>
                        <IconButton icon="delete" iconColor="#F44336" size={24} onPress={resetForm} />
                        <IconButton icon="close" iconColor="#757575" size={24} onPress={() => { setShowAddInteraction(false); resetForm(); }} />
                      </View>
                    </View>

                    {/* Date Time Row */}
                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
                        <Text style={styles.dateTimeText}>{formatDate(interactionDate)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
                        <Text style={styles.dateTimeText}>{interactionTime}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.locationCheckbox} onPress={() => { setTagLocation(!tagLocation); if (!tagLocation) getCurrentLocation(); }}>
                        <Checkbox status={tagLocation ? 'checked' : 'unchecked'} color="#009688" />
                        <Text style={{ fontSize: 13 }}>Tag Location</Text>
                      </TouchableOpacity>
                    </View>

                    {tagLocation && currentLocation ? (
                      <Text style={styles.locationText}>📍 {currentLocation}</Text>
                    ) : null}

                    {/* Interaction Type */}
                    <View style={styles.typeContainer}>
                      <RadioButton.Group onValueChange={setInteractionType} value={interactionType}>
                        <View style={styles.radioRow}>
                          {INTERACTION_TYPES.map((type) => (
                            <TouchableOpacity key={type} style={styles.radioItem} onPress={() => setInteractionType(type)}>
                              <RadioButton value={type} color="#009688" />
                              <Text style={[styles.radioLabel, interactionType === type && { color: '#009688', fontWeight: 'bold' }]}>{type}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </RadioButton.Group>
                    </View>

                    <TextInput
                      placeholder="Interaction Notes"
                      value={interactionNote}
                      onChangeText={setInteractionNote}
                      mode="outlined"
                      multiline
                      numberOfLines={3}
                      style={styles.noteInput}
                      outlineColor="#E0E0E0"
                      activeOutlineColor="#009688"
                    />

                    {/* Next Appointment */}
                    <View style={styles.nextSection}>
                      <Text variant="titleMedium" style={styles.sectionTitle}>Next Appointment</Text>

                      <View style={styles.dateTimeRow}>
                        <TouchableOpacity style={[styles.dateTimeButton, !nextAppointmentDate && { borderStyle: 'dashed' }]} onPress={() => setShowNextDatePicker(true)}>
                          <Text style={styles.dateTimeText}>{nextAppointmentDate ? formatDate(nextAppointmentDate) : 'Select Date'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowNextTimePicker(true)}>
                          <Text style={styles.dateTimeText}>{nextAppointmentTime}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.typeContainer}>
                        <RadioButton.Group onValueChange={setNextAppointmentType} value={nextAppointmentType}>
                          <View style={styles.radioRow}>
                            {INTERACTION_TYPES.map((type) => (
                              <TouchableOpacity key={`next-${type}`} style={styles.radioItem} onPress={() => setNextAppointmentType(type)}>
                                <RadioButton value={type} color="#009688" />
                                <Text style={[styles.radioLabel, nextAppointmentType === type && { color: '#009688', fontWeight: 'bold' }]}>{type}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </RadioButton.Group>
                      </View>

                      <TextInput
                        placeholder="Next Appointment Note"
                        value={nextAppointmentNote}
                        onChangeText={setNextAppointmentNote}
                        mode="outlined"
                        multiline
                        numberOfLines={2}
                        style={styles.noteInput}
                        outlineColor="#E0E0E0"
                        activeOutlineColor="#009688"
                      />
                    </View>

                    <TouchableOpacity style={styles.whatsappCheckbox} onPress={() => setSendWhatsApp(!sendWhatsApp)}>
                      <Checkbox status={sendWhatsApp ? 'checked' : 'unchecked'} color="#25D366" />
                      <Text>Send WhatsApp confirmation</Text>
                    </TouchableOpacity>

                    <Button mode="contained" onPress={handleSaveInteraction} loading={addingInteraction} disabled={addingInteraction} style={{ marginTop: 12 }} buttonColor="#4CAF50" icon="check">
                      Save Interaction
                    </Button>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Interaction Timeline */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text variant="titleLarge" style={styles.sectionTitle}>Interaction Timeline</Text>
                  <Chip>{interactions.length}</Chip>
                </View>

                {interactions.length === 0 ? (
                  <View style={styles.emptyInteractions}>
                    <MaterialCommunityIcons name="timeline-text" size={48} color="#BDBDBD" />
                    <Text style={{ color: '#BDBDBD', marginTop: 8 }}>No interactions yet</Text>
                  </View>
                ) : (
                  <View style={styles.timeline}>
                    {interactions.map((interaction, index) => (
                      <View key={interaction.id} style={styles.timelineItem}>
                        <View style={styles.timelineIconContainer}>
                          <View style={styles.timelineIcon}>
                            <MaterialCommunityIcons name={getInteractionIcon(interaction.type)} size={20} color="#FFFFFF" />
                          </View>
                          {index < interactions.length - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{interaction.type}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text variant="bodySmall" style={{ color: '#757575' }}>
                                {interaction.interaction_date ? formatDate(interaction.interaction_date) : formatDisplayDate(interaction.created_at)}
                              </Text>
                              <IconButton icon="delete" iconColor="#F44336" size={18} onPress={() => handleDeleteInteraction(interaction.id)} />
                            </View>
                          </View>
                          <Text style={{ color: '#424242', lineHeight: 20 }}>{interaction.description}</Text>
                          {interaction.location ? (
                            <Text style={{ color: '#757575', fontSize: 12, marginTop: 4 }}>📍 {interaction.location}</Text>
                          ) : null}
                          {interaction.next_appointment_date ? (
                            <Text style={{ color: '#FF9800', fontSize: 12, marginTop: 4 }}>
                              📅 Next: {formatDate(interaction.next_appointment_date)} at {interaction.next_appointment_time}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card.Content>
            </Card>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modals */}
      <Modal visible={showDatePicker || showNextDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Select Date</Text>
              <IconButton icon="close" onPress={() => { setShowDatePicker(false); setShowNextDatePicker(false); }} />
            </View>
            <Calendar
              onDayPress={(day: any) => {
                if (showDatePicker) { setInteractionDate(day.dateString); setShowDatePicker(false); }
                else { setNextAppointmentDate(day.dateString); setShowNextDatePicker(false); }
              }}
              markedDates={{ [showDatePicker ? interactionDate : nextAppointmentDate]: { selected: true, selectedColor: '#009688' } }}
              theme={{ selectedDayBackgroundColor: '#009688', todayTextColor: '#009688', arrowColor: '#009688' }}
              minDate={showDatePicker ? undefined : getTodayDate()}
            />
          </View>
        </View>
      </Modal>

      {/* Time Picker Modals */}
      <Modal visible={showTimePicker || showNextTimePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Select Time</Text>
              <IconButton icon="close" onPress={() => { setShowTimePicker(false); setShowNextTimePicker(false); }} />
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {TIME_SLOTS.map((time) => {
                const current = showTimePicker ? interactionTime : nextAppointmentTime;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.timeSlot, current === time && styles.timeSlotSelected]}
                    onPress={() => {
                      if (showTimePicker) { setInteractionTime(time); setShowTimePicker(false); }
                      else { setNextAppointmentTime(time); setShowNextTimePicker(false); }
                    }}
                  >
                    <Text style={[{ fontSize: 16, textAlign: 'center' }, current === time && { color: '#009688', fontWeight: 'bold' }]}>{time}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#009688', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { marginRight: 16 },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold', flex: 1 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  card: { marginBottom: 16, elevation: 2, backgroundColor: '#FFFFFF' },
  leadName: { fontWeight: 'bold', color: '#000000', marginBottom: 4 },
  leadMobile: { color: '#757575', marginBottom: 16 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { height: 28 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { color: '#424242', flex: 1 },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 4 },
  actionButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontWeight: 'bold', color: '#000000', marginBottom: 12 },
  interactionForm: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  dateTimeButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  dateTimeText: { color: '#424242', fontSize: 14 },
  locationCheckbox: { flexDirection: 'row', alignItems: 'center' },
  locationText: { color: '#757575', fontSize: 12, marginBottom: 8 },
  typeContainer: { marginBottom: 12 },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  radioItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, paddingRight: 12, marginBottom: 4, borderWidth: 1, borderColor: '#E0E0E0' },
  radioLabel: { color: '#424242', fontSize: 13 },
  noteInput: { backgroundColor: '#FFFFFF', marginBottom: 12 },
  nextSection: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 12, marginTop: 8 },
  whatsappCheckbox: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  emptyInteractions: { alignItems: 'center', paddingVertical: 32 },
  timeline: { marginTop: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 24 },
  timelineIconContainer: { alignItems: 'center', marginRight: 16 },
  timelineIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#009688', justifyContent: 'center', alignItems: 'center' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E0E0E0', marginTop: 8 },
  timelineContent: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  timeSlot: { paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  timeSlotSelected: { backgroundColor: '#E0F2F1' },
});
