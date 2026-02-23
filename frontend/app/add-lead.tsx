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
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const PRODUCTS = [
  'Whole Life',
  'Child Plan',
  'Retirement Plan',
  'Kanyadaan Plan',
  'Health Insurance',
  'Motor Insurance',
  'Travel Insurance',
  'Home Insurance',
  'Corporate Insurance',
  'ULIP',
  'Endowment',
  'SIP',
  'Mutual Fund Lumpsum',
  'General Insurance',
  'Others',
];

const STATUSES = [
  'New',
  'Interested',
  'Not Interested',
  'Follow-up',
  'Pipeline',
  'Closed',
];

const SOURCES = [
  'Facebook Ads',
  'Instagram',
  'Google Ads',
  'Referral',
  'Existing Client',
  'Website Form',
  'Walk-in',
  'WhatsApp Enquiry',
  'Other',
];

const FOLLOWUP_TYPES = [
  'WhatsApp',
  'Call',
  'Meeting',
  'Video Call',
  'Message',
  'Email',
  'Visit',
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

  const [showProductModal, setShowProductModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showFollowupTypeModal, setShowFollowupTypeModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Helper functions for date formatting
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

  // Fetch lead data if in edit mode
  useEffect(() => {
    if (isEditMode) {
      fetchLeadData();
    }
  }, [isEditMode]);

  const fetchLeadData = async () => {
    setFetchingLead(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/leads/${id}`);
      const data = await response.json();
      
      // Pre-fill form with existing data
      setName(data.name || '');
      setMobile(data.mobile || '');
      setProduct(data.product || 'Whole Life');
      setStatus(data.status || 'New');
      setSource(data.source || 'Walk-in');
      setCity(data.city || '');
      setNotes(data.notes || '');
      // Convert YYYY-MM-DD to DD-MM-YYYY for display
      setNextFollowupDate(data.next_followup_date ? formatDateToDDMMYYYY(data.next_followup_date) : '');
      setNextFollowupTime(data.next_followup_time || '10:00');
      setNextFollowupType(data.next_followup_type || 'WhatsApp');
    } catch (error) {
      console.error('Error fetching lead:', error);
      Alert.alert('Error', 'Failed to load lead data');
    } finally {
      setFetchingLead(false);
    }
  };

  const handleDateSelect = (day: any) => {
    const selectedDate = day.dateString; // YYYY-MM-DD format
    setNextFollowupDate(formatDateToDDMMYYYY(selectedDate));
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
      const leadData = {
        name,
        mobile,
        product,
        status,
        source,
        city,
        notes,
        next_followup_date: nextFollowupDate ? formatDateToYYYYMMDD(nextFollowupDate) : null,
        next_followup_type: nextFollowupType,
      };

      const url = isEditMode 
        ? `${BACKEND_URL}/api/leads/${id}`
        : `${BACKEND_URL}/api/leads`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (response.ok) {
        Alert.alert(
          'Success', 
          isEditMode ? 'Lead updated successfully' : 'Lead added successfully', 
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', isEditMode ? 'Failed to update lead' : 'Failed to add lead');
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      Alert.alert('Error', isEditMode ? 'Failed to update lead' : 'Failed to add lead');
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
          <Text variant="titleLarge" style={styles.modalTitle}>
            {title}
          </Text>
          <ScrollView style={styles.optionsList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionItem}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
              >
                <Text variant="bodyLarge" style={styles.optionText}>
                  {option}
                </Text>
                <RadioButton
                  value={option}
                  status={selectedValue === option ? 'checked' : 'unchecked'}
                  onPress={() => {
                    onSelect(option);
                    onClose();
                  }}
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
          name="arrow-left"
          size={24}
          color="#FFFFFF"
          onPress={() => router.back()}
          style={styles.backButton}
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
        <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            <TextInput
              label="Name *"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />

            <TextInput
              label="Mobile (10 Digits) *"
              value={mobile}
              onChangeText={setMobile}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              maxLength={10}
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />

            <Text variant="labelLarge" style={styles.label}>
              Product *
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowProductModal(true)}
            >
              <Text style={styles.pickerButtonText}>{product}</Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
            </TouchableOpacity>

            <Text variant="labelLarge" style={styles.label}>
              Status *
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowStatusModal(true)}
            >
              <Text style={styles.pickerButtonText}>{status}</Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
            </TouchableOpacity>

            <Text variant="labelLarge" style={styles.label}>
              Source *
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowSourceModal(true)}
            >
              <Text style={styles.pickerButtonText}>{source}</Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
            </TouchableOpacity>

            <TextInput
              label="City"
              value={city}
              onChangeText={setCity}
              mode="outlined"
              style={styles.input}
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />

            <Text variant="labelLarge" style={styles.label}>
              Next Follow-up Date
            </Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowCalendar(true)}
            >
              <Text style={styles.datePickerText}>
                {nextFollowupDate || 'Select Date (DD-MM-YYYY)'}
              </Text>
              <MaterialCommunityIcons name="calendar" size={24} color="#009688" />
            </TouchableOpacity>

            <Text variant="labelLarge" style={styles.label}>
              Next Follow-up Type
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowFollowupTypeModal(true)}
            >
              <Text style={styles.pickerButtonText}>{nextFollowupType}</Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#009688" />
            </TouchableOpacity>

            <TextInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={4}
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />

            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.submitButton}
              loading={loading}
              disabled={loading}
              buttonColor="#009688"
            >
              {loading ? (isEditMode ? 'Updating...' : 'Adding Lead...') : (isEditMode ? 'Update Lead' : 'Save New Lead')}
            </Button>

            <Button
              mode="outlined"
              onPress={() => router.back()}
              style={styles.cancelButton}
              textColor="#009688"
            >
              Cancel
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}

      {/* Product Modal */}
      {renderPickerModal(
        showProductModal,
        () => setShowProductModal(false),
        PRODUCTS,
        product,
        setProduct,
        'Select Product'
      )}

      {/* Status Modal */}
      {renderPickerModal(
        showStatusModal,
        () => setShowStatusModal(false),
        STATUSES,
        status,
        setStatus,
        'Select Status'
      )}

      {/* Source Modal */}
      {renderPickerModal(
        showSourceModal,
        () => setShowSourceModal(false),
        SOURCES,
        source,
        setSource,
        'Select Source'
      )}

      {/* Follow-up Type Modal */}
      {renderPickerModal(
        showFollowupTypeModal,
        () => setShowFollowupTypeModal(false),
        FOLLOWUP_TYPES,
        nextFollowupType,
        setNextFollowupType,
        'Next Follow-up Type'
      )}

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="slide">
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarHeader}>
              <Text variant="titleLarge" style={styles.calendarTitle}>
                Select Follow-up Date
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setShowCalendar(false)}
              />
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={{
                [getTodayDate()]: { selected: true, selectedColor: '#009688' },
              }}
              theme={{
                todayTextColor: '#009688',
                arrowColor: '#009688',
                monthTextColor: '#009688',
                textMonthFontWeight: 'bold',
              }}
              minDate={getTodayDate()}
            />
            <Button
              mode="outlined"
              onPress={() => setShowCalendar(false)}
              style={styles.calendarCloseButton}
              textColor="#009688"
            >
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
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
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  header: {
    backgroundColor: '#009688',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  label: {
    marginTop: 8,
    marginBottom: 8,
    color: '#000000',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#009688',
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#009688',
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  datePickerText: {
    fontSize: 16,
    color: '#000000',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontWeight: 'bold',
    color: '#000000',
  },
  calendarCloseButton: {
    marginTop: 16,
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  cancelButton: {
    marginTop: 8,
    marginBottom: 32,
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionText: {
    flex: 1,
    color: '#000000',
  },
  closeButton: {
    margin: 16,
  },
});
