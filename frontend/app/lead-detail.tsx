import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Button,
  TextInput,
  Checkbox,
  RadioButton,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Calendar } from 'react-native-calendars';
import * as Location from 'expo-location';

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
  expected_closing_month: string;
  notes: string;
  next_followup_date?: string;
  next_followup_time?: string;
  created_at: string;
}

interface Interaction {
  id: string;
  type: string;
  description: string;
  location?: string;
  created_at: string;
}

const INTERACTION_TYPES = ['Call', 'Meeting', 'Online', 'Email', 'Message', 'Other'];
const TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM'
];

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [addingInteraction, setAddingInteraction] = useState(false);
  
  // Interaction Entry States
  const [interactionDate, setInteractionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [interactionTime, setInteractionTime] = useState(format(new Date(), 'hh:mm a'));
  const [tagLocation, setTagLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [interactionType, setInteractionType] = useState('Call');
  const [interactionNote, setInteractionNote] = useState('');
  
  // Next Appointment States
  const [scheduleNextAppointment, setScheduleNextAppointment] = useState(false);
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentTime, setNextAppointmentTime] = useState('11:00 AM');
  const [nextAppointmentType, setNextAppointmentType] = useState('Call');
  const [nextAppointmentNote, setNextAppointmentNote] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  
  // Modal States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showNextDatePicker, setShowNextDatePicker] = useState(false);
  const [showNextTimePicker, setShowNextTimePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'interaction' | 'next'>('interaction');

  const fetchLeadData = async () => {
    try {
      const leadResponse = await fetch(`${BACKEND_URL}/api/leads/${id}`);
      const leadData = await leadResponse.json();
      setLead(leadData);

      const interactionsResponse = await fetch(`${BACKEND_URL}/api/interactions/${id}`);
      const interactionsData = await interactionsResponse.json();
      setInteractions(interactionsData);
    } catch (error) {
      console.error('Error fetching lead data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLeadData();
    }
  }, [id]);

  // Get current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to tag location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address[0]) {
        const addr = address[0];
        const locationStr = `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
        setCurrentLocation(locationStr);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  useEffect(() => {
    if (tagLocation) {
      getCurrentLocation();
    } else {
      setCurrentLocation('');
    }
  }, [tagLocation]);

  const handleCall = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  };

  const handleWhatsApp = (mobile: string, message?: string) => {
    const formattedPhone = formatPhoneForWhatsApp(mobile);
    const url = message 
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${formattedPhone}`;
    Linking.openURL(url);
  };

  const handleSaveInteraction = async () => {
    if (!interactionNote.trim()) {
      Alert.alert('Error', 'Please enter interaction notes');
      return;
    }

    setAddingInteraction(true);

    try {
      // Save current interaction
      const interactionData = {
        lead_id: id,
        type: interactionType,
        description: interactionNote,
        location: tagLocation ? currentLocation : undefined,
        interaction_date: interactionDate,
        interaction_time: interactionTime,
      };

      const response = await fetch(`${BACKEND_URL}/api/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interactionData),
      });

      if (!response.ok) throw new Error('Failed to save interaction');

      // Update lead with next appointment if scheduled
      if (scheduleNextAppointment && nextAppointmentDate) {
        const leadUpdateResponse = await fetch(`${BACKEND_URL}/api/leads/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            next_followup_date: nextAppointmentDate,
            next_followup_time: nextAppointmentTime,
            next_followup_type: nextAppointmentType,
          }),
        });

        if (!leadUpdateResponse.ok) {
          console.error('Failed to update next appointment');
        }
      }

      // Send WhatsApp if checked
      if (sendWhatsApp && lead) {
        const appointmentMsg = scheduleNextAppointment && nextAppointmentDate
          ? `\n\nNext Appointment: ${format(new Date(nextAppointmentDate), 'dd-MMM-yyyy')} at ${nextAppointmentTime}`
          : '';
        const message = `Hi ${lead.name},\n\nThank you for your time today.${appointmentMsg}\n\nBest Regards`;
        handleWhatsApp(lead.mobile, message);
      }

      // Reset form
      resetForm();
      setShowAddInteraction(false);
      fetchLeadData();
      Alert.alert('Success', 'Interaction saved successfully');
    } catch (error) {
      console.error('Error saving interaction:', error);
      Alert.alert('Error', 'Failed to save interaction');
    } finally {
      setAddingInteraction(false);
    }
  };

  const resetForm = () => {
    setInteractionDate(format(new Date(), 'yyyy-MM-dd'));
    setInteractionTime(format(new Date(), 'hh:mm a'));
    setTagLocation(false);
    setCurrentLocation('');
    setInteractionType('Call');
    setInteractionNote('');
    setScheduleNextAppointment(false);
    setNextAppointmentDate('');
    setNextAppointmentTime('11:00 AM');
    setNextAppointmentType('Call');
    setNextAppointmentNote('');
    setSendWhatsApp(false);
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    Alert.alert(
      'Delete Interaction',
      'Are you sure you want to delete this interaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/interactions/${interactionId}`, {
                method: 'DELETE',
              });
              fetchLeadData();
            } catch (error) {
              console.error('Error deleting interaction:', error);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return '#2196F3';
      case 'Contacted': return '#FF9800';
      case 'Interested': return '#4CAF50';
      case 'Proposal': return '#9C27B0';
      case 'Closed': return '#00796B';
      case 'Not Interested': return '#757575';
      default: return '#757575';
    }
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'Call': return 'phone';
      case 'WhatsApp': case 'Message': return 'whatsapp';
      case 'Meeting': return 'account-group';
      case 'Online': return 'video';
      case 'Email': return 'email';
      case 'Note': case 'Other': return 'note-text';
      default: return 'information';
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd-MMM-yy');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009688" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Lead not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color="#FFFFFF"
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Lead Details
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Lead Info Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="headlineSmall" style={styles.leadName}>{lead.name}</Text>
                <Text variant="bodyLarge" style={styles.leadMobile}>{lead.mobile}</Text>

                <View style={styles.chipContainer}>
                  <Chip style={[styles.chip, { backgroundColor: getStatusColor(lead.status) }]} textStyle={{ color: '#FFFFFF' }}>
                    {lead.status}
                  </Chip>
                  <Chip style={styles.chip}>{lead.product}</Chip>
                  <Chip style={styles.chip}>{lead.source}</Chip>
                </View>

                {lead.city && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="map-marker" size={20} color="#757575" />
                    <Text variant="bodyMedium" style={styles.infoText}>{lead.city}</Text>
                  </View>
                )}

                {lead.next_followup_date && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color="#FF9800" />
                    <Text variant="bodyMedium" style={[styles.infoText, styles.followupText]}>
                      Next: {formatDisplayDate(lead.next_followup_date)} {lead.next_followup_time || ''}
                    </Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={() => handleCall(lead.mobile)}>
                    <MaterialCommunityIcons name="phone" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.actionButton, styles.whatsappButton]} onPress={() => handleWhatsApp(lead.mobile)}>
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>

            {/* Add Interaction Section */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Text variant="titleLarge" style={styles.sectionTitle}>Add Interaction</Text>
                </View>

                {!showAddInteraction ? (
                  <Button mode="contained" onPress={() => setShowAddInteraction(true)} icon="plus" buttonColor="#009688">
                    Add New Interaction
                  </Button>
                ) : (
                  <View style={styles.interactionForm}>
                    {/* Header with close and delete */}
                    <View style={styles.formHeader}>
                      <Text variant="titleMedium" style={styles.formTitle}>Interaction Entry</Text>
                      <View style={styles.formHeaderActions}>
                        <IconButton icon="delete" iconColor="#F44336" size={24} onPress={resetForm} />
                        <IconButton icon="close" iconColor="#757575" size={24} onPress={() => { setShowAddInteraction(false); resetForm(); }} />
                      </View>
                    </View>

                    {/* Date, Time, Location Row */}
                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
                        <Text style={styles.dateTimeText}>{formatDisplayDate(interactionDate)}</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
                        <Text style={styles.dateTimeText}>{interactionTime}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.locationCheckbox} onPress={() => setTagLocation(!tagLocation)}>
                        <Checkbox status={tagLocation ? 'checked' : 'unchecked'} color="#009688" />
                        <Text style={styles.checkboxLabel}>Tag Location</Text>
                      </TouchableOpacity>
                    </View>

                    {tagLocation && currentLocation ? (
                      <View style={styles.locationDisplay}>
                        <MaterialCommunityIcons name="map-marker" size={16} color="#009688" />
                        <Text style={styles.locationText} numberOfLines={1}>{currentLocation}</Text>
                      </View>
                    ) : null}

                    {/* Interaction Type Radio Buttons */}
                    <View style={styles.typeContainer}>
                      <RadioButton.Group onValueChange={setInteractionType} value={interactionType}>
                        <View style={styles.radioRow}>
                          {INTERACTION_TYPES.map((type) => (
                            <TouchableOpacity key={type} style={styles.radioItem} onPress={() => setInteractionType(type)}>
                              <RadioButton value={type} color="#009688" />
                              <Text style={[styles.radioLabel, interactionType === type && styles.radioLabelSelected]}>{type}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </RadioButton.Group>
                    </View>

                    {/* Note Input */}
                    <TextInput
                      placeholder="Note"
                      value={interactionNote}
                      onChangeText={setInteractionNote}
                      mode="outlined"
                      multiline
                      numberOfLines={3}
                      style={styles.noteInput}
                      outlineColor="#E0E0E0"
                      activeOutlineColor="#009688"
                    />

                    {/* Next Appointment Section */}
                    <View style={styles.nextAppointmentSection}>
                      <Text variant="titleMedium" style={styles.sectionSubtitle}>Next Appointment</Text>
                      
                      <View style={styles.dateTimeRow}>
                        <TouchableOpacity 
                          style={[styles.dateTimeButton, !nextAppointmentDate && styles.dateTimeButtonEmpty]} 
                          onPress={() => setShowNextDatePicker(true)}
                        >
                          <Text style={styles.dateTimeText}>
                            {nextAppointmentDate ? formatDisplayDate(nextAppointmentDate) : 'Select Date'}
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowNextTimePicker(true)}>
                          <Text style={styles.dateTimeText}>{nextAppointmentTime}</Text>
                        </TouchableOpacity>

                        <View style={styles.assigneeContainer}>
                          <Text style={styles.assigneeText}>{lead.name}</Text>
                          <MaterialCommunityIcons name="chevron-down" size={20} color="#757575" />
                        </View>
                      </View>

                      {/* Next Appointment Type */}
                      <View style={styles.typeContainer}>
                        <RadioButton.Group onValueChange={setNextAppointmentType} value={nextAppointmentType}>
                          <View style={styles.radioRow}>
                            {INTERACTION_TYPES.map((type) => (
                              <TouchableOpacity key={`next-${type}`} style={styles.radioItem} onPress={() => setNextAppointmentType(type)}>
                                <RadioButton value={type} color="#009688" />
                                <Text style={[styles.radioLabel, nextAppointmentType === type && styles.radioLabelSelected]}>{type}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </RadioButton.Group>
                      </View>

                      <TextInput
                        placeholder="Note"
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

                    {/* Send WhatsApp Checkbox */}
                    <TouchableOpacity style={styles.whatsappCheckbox} onPress={() => setSendWhatsApp(!sendWhatsApp)}>
                      <Checkbox status={sendWhatsApp ? 'checked' : 'unchecked'} color="#25D366" />
                      <Text style={styles.whatsappCheckboxLabel}>Send WhatsApp</Text>
                    </TouchableOpacity>

                    {/* Save Button */}
                    <Button
                      mode="contained"
                      onPress={handleSaveInteraction}
                      loading={addingInteraction}
                      disabled={addingInteraction}
                      style={styles.saveButton}
                      buttonColor="#4CAF50"
                      icon="check"
                    >
                      Save
                    </Button>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Interaction Timeline */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Text variant="titleLarge" style={styles.sectionTitle}>Interaction Timeline</Text>
                  <Chip>{interactions.length}</Chip>
                </View>

                {interactions.length === 0 ? (
                  <View style={styles.emptyInteractions}>
                    <MaterialCommunityIcons name="timeline-text" size={48} color="#BDBDBD" />
                    <Text variant="bodyMedium" style={styles.emptyText}>No interactions yet</Text>
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
                          <View style={styles.timelineHeader}>
                            <Text variant="titleMedium" style={styles.interactionTypeText}>{interaction.type}</Text>
                            <View style={styles.timelineActions}>
                              <Text variant="bodySmall" style={styles.interactionDate}>
                                {format(new Date(interaction.created_at), 'dd-MMM-yy HH:mm')}
                              </Text>
                              <IconButton icon="delete" iconColor="#F44336" size={18} onPress={() => handleDeleteInteraction(interaction.id)} />
                            </View>
                          </View>
                          <Text variant="bodyMedium" style={styles.interactionDescription}>{interaction.description}</Text>
                          {interaction.location && (
                            <View style={styles.interactionLocation}>
                              <MaterialCommunityIcons name="map-marker" size={14} color="#757575" />
                              <Text style={styles.locationText}>{interaction.location}</Text>
                            </View>
                          )}
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

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker || showNextDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>Select Date</Text>
              <IconButton icon="close" onPress={() => { setShowDatePicker(false); setShowNextDatePicker(false); }} />
            </View>
            <Calendar
              onDayPress={(day: any) => {
                if (showDatePicker) {
                  setInteractionDate(day.dateString);
                  setShowDatePicker(false);
                } else {
                  setNextAppointmentDate(day.dateString);
                  setScheduleNextAppointment(true);
                  setShowNextDatePicker(false);
                }
              }}
              markedDates={{
                [showDatePicker ? interactionDate : nextAppointmentDate]: { selected: true, selectedColor: '#009688' }
              }}
              theme={{
                selectedDayBackgroundColor: '#009688',
                todayTextColor: '#009688',
                arrowColor: '#009688',
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker || showNextTimePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>Select Time</Text>
              <IconButton icon="close" onPress={() => { setShowTimePicker(false); setShowNextTimePicker(false); }} />
            </View>
            <ScrollView style={styles.timePickerScroll}>
              {TIME_SLOTS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeSlot,
                    (showTimePicker ? interactionTime : nextAppointmentTime) === time && styles.timeSlotSelected
                  ]}
                  onPress={() => {
                    if (showTimePicker) {
                      setInteractionTime(time);
                      setShowTimePicker(false);
                    } else {
                      setNextAppointmentTime(time);
                      setShowNextTimePicker(false);
                    }
                  }}
                >
                  <Text style={[
                    styles.timeSlotText,
                    (showTimePicker ? interactionTime : nextAppointmentTime) === time && styles.timeSlotTextSelected
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#009688', padding: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 16 },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  card: { marginBottom: 16, elevation: 2 },
  leadName: { fontWeight: 'bold', color: '#000000', marginBottom: 4 },
  leadMobile: { color: '#757575', marginBottom: 16 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { height: 28 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { color: '#424242' },
  followupText: { color: '#FF9800', fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 4 },
  callButton: { backgroundColor: '#4CAF50' },
  whatsappButton: { backgroundColor: '#25D366' },
  actionButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontWeight: 'bold', color: '#000000' },
  sectionSubtitle: { fontWeight: 'bold', color: '#000000', marginBottom: 12, marginTop: 16 },
  
  // Interaction Form Styles
  interactionForm: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 16 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontWeight: 'bold', color: '#000000' },
  formHeaderActions: { flexDirection: 'row' },
  
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  dateTimeButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  dateTimeButtonEmpty: { borderStyle: 'dashed' },
  dateTimeText: { color: '#424242', fontSize: 14 },
  
  locationCheckbox: { flexDirection: 'row', alignItems: 'center' },
  checkboxLabel: { color: '#424242', fontSize: 14 },
  locationDisplay: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, paddingHorizontal: 4 },
  locationText: { color: '#757575', fontSize: 12, flex: 1 },
  
  typeContainer: { marginBottom: 12 },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  radioItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, paddingRight: 12, marginBottom: 4, borderWidth: 1, borderColor: '#E0E0E0' },
  radioLabel: { color: '#424242', fontSize: 13 },
  radioLabelSelected: { color: '#009688', fontWeight: 'bold' },
  
  noteInput: { backgroundColor: '#FFFFFF', marginBottom: 12 },
  
  nextAppointmentSection: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 12, marginTop: 8 },
  
  assigneeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, flex: 1 },
  assigneeText: { flex: 1, color: '#424242', fontSize: 14 },
  
  whatsappCheckbox: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  whatsappCheckboxLabel: { color: '#424242', fontSize: 14 },
  
  saveButton: { marginTop: 8 },
  
  // Timeline Styles
  emptyInteractions: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#BDBDBD', marginTop: 8 },
  timeline: { marginTop: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 24 },
  timelineIconContainer: { alignItems: 'center', marginRight: 16 },
  timelineIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#009688', justifyContent: 'center', alignItems: 'center' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E0E0E0', marginTop: 8 },
  timelineContent: { flex: 1 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  timelineActions: { flexDirection: 'row', alignItems: 'center' },
  interactionTypeText: { fontWeight: 'bold', color: '#000000' },
  interactionDate: { color: '#757575' },
  interactionDescription: { color: '#424242', lineHeight: 20 },
  interactionLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontWeight: 'bold', color: '#000000' },
  timePickerScroll: { maxHeight: 400 },
  timeSlot: { paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  timeSlotSelected: { backgroundColor: '#E0F2F1' },
  timeSlotText: { fontSize: 16, color: '#424242', textAlign: 'center' },
  timeSlotTextSelected: { color: '#009688', fontWeight: 'bold' },
});
