import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  RadioButton,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { scheduleFollowupNotification, cancelAllLeadNotifications } from '../utils/notifications';
import { saveLeadLocal, getLeadByIdLocal, initializeDatabase } from '../utils/database';

const PRODUCTS = [
  'Whole Life', 'Child Plan', 'Retirement Plan', 'Kanyadaan Plan',
  'Health Insurance', 'Motor Insurance', 'Travel Insurance', 'Home Insurance',
  'Corporate Insurance', 'ULIP', 'Endowment', 'SIP', 'Mutual Fund Lumpsum',
  'General Insurance', 'Others',
];

const STATUSES = ['New', 'Interested', 'Not Interested', 'Follow-up', 'Pipeline', 'Closed'];

const SOURCES = [
  'Facebook Ads', 'Instagram', 'Google Ads', 'Referral', 'Existing Client',
  'Website Form', 'Walk-in', 'WhatsApp Enquiry', 'Other',
];

const FOLLOWUP_TYPES = ['WhatsApp', 'Call', 'Meeting', 'Video Call', 'Message', 'Email', 'Visit'];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

export default function AddLeadScreen() {
  const { id, mode } = useLocalSearchParams();
  const isEditMode = mode === 'edit' && id;

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [product, setProduct] = useState('Whole Life');
  const [status, setStatus] = useState('New');
  const [source, setSource] = useState('Walk-in');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [nextFollowupTime, setNextFollowupTime] = useState('10:00');
  const [nextFollowupType, setNextFollowupType] = useState('WhatsApp');
  const [loading, setLoading] = useState(false);
  const [fetchingLead, setFetchingLead] = useState(false);
  const [originalCreatedAt, setOriginalCreatedAt] = useState('');

  const [showProductModal, setShowProductModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showFollowupTypeModal, setShowFollowupTypeModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const formatDateToDDMMYYYY = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const formatDateToYYYYMMDD = (dateString: string) => {
    if (!dateString) return '';
    const [day, month, year] = dateString.split('-');
    return `${year}-${month}-${day}`;
  };

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    initializeDatabase();
    if (isEditMode) {
      fetchLeadData();
    }
  }, [isEditMode]);

  const fetchLeadData = async () => {
    setFetchingLead(true);
    try {
      const data = getLeadByIdLocal(id as string);
      if (data) {
        setName(data.name || '');
        setMobile(data.mobile || '');
        setProduct(data.product || 'Whole Life');
        setStatus(data.status || 'New');
        setSource(data.source || 'Walk-in');
        setCity(data.city || '');
        setNotes(data.notes || '');
        setNextFollowupDate(data.next_followup_date ? formatDateToDDMMYYYY(data.next_followup_date) : '');
        setNextFollowupTime(data.next_followup_time || '10:00');
        setNextFollowupType(data.next_followup_type || 'WhatsApp');
        setOriginalCreatedAt(data.created_at || '');
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
      Alert.alert('Error', 'Failed to load lead data');
    } finally {
      setFetchingLead(false);
    }
  };

  const handleDateSelect = (day: any) => {
    setNextFollowupDate(formatDateToDDMMYYYY(day.dateString));
    setShowCalendar(false);
  };

  const handleSubmit = async () => {
    if (!name || !mobile) {
      Alert.alert('Error', 'Please fill in Name and Mobile fields');
      return;
    }
    if (mobile.length !== 10) {
      Alert.alert('Error', 'Mobile number must be 10 digits');
      return;
    }

    setLoading(true);

    try {
      const leadId = isEditMode ? (id as string) : Date.now().toString();
      const leadData = {
        id: leadId,
        name,
        mobile,
        product,
        status,
        source,
        city,
        notes,
        next_followup_date: nextFollowupDate ? formatDateToYYYYMMDD(nextFollowupDate) : '',
        next_followup_time: nextFollowupTime,
        next_followup_type: nextFollowupType,
        created_at: isEditMode ? (originalCreatedAt || new Date().toISOString()) : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await saveLeadLocal(leadData);

      if (result.success) {
        if (nextFollowupDate && nextFollowupTime) {
          await cancelAllLeadNotifications(leadId);
          await scheduleFollowupNotification(leadId, name, nextFollowupDate, nextFollowupTime);
        }

        Alert.alert(
          'Success',
          isEditMode ? 'Lead updated successfully' : 'Lead added successfully',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', isEditMode ? 'Failed to update lead' : 'Failed to add lead');
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      Alert.alert('Error', 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    options: string[],
    selectedValue: string,
    onSelect: (value: string) => void,
    title: string
  ) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text variant="titleLarge" style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.optionsList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionItem}
                onPress={() => { onSelect(option); onClose(); }}
              >
                <Text variant="bodyLarge" style={styles.optionText}>{option}</Text>
                <RadioButton
                  value={option}
                  status={selectedValue === option ? 'checked' : 'unchecked'}
                  onPress={() => { onSelect(option); onClose(); }}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button mode="outlined" onPress={onClose} style={styles.closeButton} textColor="#009688">
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="arrow-left" size={24} color="#FFFFFF"
          onPress={() => router.back()} style={styles.backButton}
        />
        <Text variant="headlineMedium" style={styles.headerTitle}>
          {isEditMode ? 'Edit Lead' : 'Add New Lead'}
        </Text>
      </View>

      {fetchingLead ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#009688" />
          <Text style={styles.loadingText}>Loading lead data...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <ScrollView style={styles.scrollView}>
            <View style={styles.content}>
              <TextInput label="Name *" value={name} onChangeText={setName} mode="outlined"
                style={styles.input} outlineColor="#009688" activeOutlineColor="#009688" />

              <TextInput label="Mobile (10 Digits) *" value={mobile} onChangeText={setMobile}
                mode="outlined" style={styles.input} keyboardType="phone-pad" maxLength={10}
                outlineColor="#009688" activeOutlineColor="#009688" />

              <Text variant="labelLarge" style={styles.label}>Product *</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowProductModal(true)}>
                <Text style={styles.pickerButtonText}>{product}</Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
              </TouchableOpacity>

              <Text variant="labelLarge" style={styles.label}>Status *</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowStatusModal(true)}>
                <Text style={styles.pickerButtonText}>{status}</Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
              </TouchableOpacity>

              <Text variant="labelLarge" style={styles.label}>Source *</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowSourceModal(true)}>
                <Text style={styles.pickerButtonText}>{source}</Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
              </TouchableOpacity>

              <TextInput label="City" value={city} onChangeText={setCity} mode="outlined"
                style={styles.input} outlineColor="#009688" activeOutlineColor="#009688" />

              <Text variant="labelLarge" style={styles.label}>Next Follow-up Date</Text>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowCalendar(true)}>
                <Text style={styles.datePickerText}>{nextFollowupDate || 'Select Date (DD-MM-YYYY)'}</Text>
                <MaterialCommunityIcons name="calendar" size={24} color="#009688" />
              </TouchableOpacity>

              <Text variant="labelLarge" style={styles.label}>Follow-up Time</Text>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.datePickerText}>{nextFollowupTime || 'Select Time'}</Text>
                <MaterialCommunityIcons name="clock-outline" size={24} color="#009688" />
              </TouchableOpacity>

              <Text variant="labelLarge" style={styles.label}>Next Follow-up Type</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowFollowupTypeModal(true)}>
                <Text style={styles.pickerButtonText}>{nextFollowupType}</Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
              </TouchableOpacity>

              <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined"
                style={styles.input} multiline numberOfLines={4}
                outlineColor="#009688" activeOutlineColor="#009688" />

              <Button mode="contained" onPress={handleSubmit} style={styles.submitButton}
                loading={loading} disabled={loading} buttonColor="#009688">
                {loading ? (isEditMode ? 'Updating...' : 'Adding Lead...') : (isEditMode ? 'Update Lead' : 'Save New Lead')}
              </Button>

              <Button mode="outlined" onPress={() => router.back()}
                style={styles.cancelButton} textColor="#009688">
                Cancel
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {renderPickerModal(showProductModal, () => setShowProductModal(false), PRODUCTS, product, setProduct, 'Select Product')}
      {renderPickerModal(showStatusModal, () => setShowStatusModal(false), STATUSES, status, setStatus, 'Select Status')}
      {renderPickerModal(showSourceModal, () => setShowSourceModal(false), SOURCES, source, setSource, 'Select Source')}
      {renderPickerModal(showFollowupTypeModal, () => setShowFollowupTypeModal(false), FOLLOWUP_TYPES, nextFollowupType, setNextFollowupType, 'Next Follow-up Type')}

      <Modal visible={showCalendar} transparent animationType="slide">
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarHeader}>
              <Text variant="titleLarge" style={styles.calendarTitle}>Select Follow-up Date</Text>
              <IconButton icon="close" size={24} onPress={() => setShowCalendar(false)} />
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={{ [getTodayDate()]: { selected: true, selectedColor: '#009688' } }}
              theme={{ todayTextColor: '#009688', arrowColor: '#009688', monthTextColor: '#009688', textMonthFontWeight: 'bold' }}
              minDate={getTodayDate()}
            />
            <Button mode="outlined" onPress={() => setShowCalendar(false)} style={styles.calendarCloseButton} textColor="#009688">
              Cancel
            </Button>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarHeader}>
              <Text variant="titleLarge" style={styles.calendarTitle}>Select Follow-up Time</Text>
              <IconButton icon="close" size={24} onPress={() => setShowTimePicker(false)} />
            </View>
            <ScrollView style={styles.timeSlotContainer}>
              {TIME_SLOTS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeSlot, nextFollowupTime === time && styles.timeSlotSelected]}
                  onPress={() => { setNextFollowupTime(time); setShowTimePicker(false); }}
                >
                  <MaterialCommunityIcons name="clock-outline" size={20} color={nextFollowupTime === time ? '#FFFFFF' : '#009688'} />
                  <Text style={[styles.timeSlotText, nextFollowupTime === time && styles.timeSlotTextSelected]}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button mode="outlined" onPress={() => setShowTimePicker(false)} style={styles.calendarCloseButton} textColor="#009688">
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: '#757575' },
  header: { backgroundColor: '#009688', padding: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 16 },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  input: { marginBottom: 16 },
  label: { marginTop: 8, marginBottom: 8, color: '#000000' },
  pickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#009688', borderRadius: 4, padding: 16, marginBottom: 16, backgroundColor: '#FFFFFF' },
  pickerButtonText: { fontSize: 16, color: '#000000' },
  datePickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#009688', borderRadius: 4, padding: 16, marginBottom: 16, backgroundColor: '#FFFFFF' },
  datePickerText: { fontSize: 16, color: '#000000' },
  calendarModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: 20 },
  calendarModalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calendarTitle: { fontWeight: 'bold', color: '#000000' },
  calendarCloseButton: { marginTop: 16 },
  timeSlotContainer: { maxHeight: 400 },
  timeSlot: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, marginBottom: 8, backgroundColor: '#FFFFFF' },
  timeSlotSelected: { backgroundColor: '#009688', borderColor: '#009688' },
  timeSlotText: { fontSize: 16, color: '#000000' },
  timeSlotTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
  submitButton: { marginTop: 16, paddingVertical: 8 },
  cancelButton: { marginTop: 8, marginBottom: 32, paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, maxHeight: '80%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', marginBottom: 16, paddingHorizontal: 20 },
  optionsList: { maxHeight: 400 },
  optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  optionText: { flex: 1, color: '#000000' },
  closeButton: { margin: 16 },
});
