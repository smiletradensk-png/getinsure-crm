import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  SegmentedButtons,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddLeadScreen() {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [product, setProduct] = useState('Life');
  const [status, setStatus] = useState('New');
  const [source, setSource] = useState('Walk-in');
  const [city, setCity] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [expectedClosingMonth, setExpectedClosingMonth] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !mobile) {
      Alert.alert('Error', 'Please fill in Name and Mobile fields');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          mobile,
          product,
          status,
          source,
          city,
          premium_amount: parseFloat(premiumAmount) || 0,
          expected_closing_month: expectedClosingMonth,
          notes,
          next_followup_date: nextFollowupDate || null,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Lead added successfully', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to add lead');
      }
    } catch (error) {
      console.error('Error adding lead:', error);
      Alert.alert('Error', 'Failed to add lead');
    } finally {
      setLoading(false);
    }
  };

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
          Add New Lead
        </Text>
      </View>

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
              label="Mobile *"
              value={mobile}
              onChangeText={setMobile}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />

            <Text variant="labelLarge" style={styles.label}>
              Product
            </Text>
            <SegmentedButtons
              value={product}
              onValueChange={setProduct}
              buttons={[
                { value: 'Life', label: 'Life' },
                { value: 'Health', label: 'Health' },
                { value: 'Motor', label: 'Motor' },
                { value: 'Investment', label: 'Investment' },
              ]}
              style={styles.segmented}
            />

            <Text variant="labelLarge" style={styles.label}>
              Status
            </Text>
            <SegmentedButtons
              value={status}
              onValueChange={setStatus}
              buttons={[
                { value: 'New', label: 'New' },
                { value: 'Contacted', label: 'Contacted' },
                { value: 'Interested', label: 'Interested' },
              ]}
              style={styles.segmented}
            />

            <Text variant="labelLarge" style={styles.label}>
              Source
            </Text>
            <SegmentedButtons
              value={source}
              onValueChange={setSource}
              buttons={[
                { value: 'Walk-in', label: 'Walk-in' },
                { value: 'Reference', label: 'Reference' },
                { value: 'Online', label: 'Online' },
                { value: 'Other', label: 'Other' },
              ]}
              style={styles.segmented}
            />

            <TextInput
              label="City"
              value={city}
              onChangeText={setCity}
              mode="outlined"
              style={styles.input}
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />

            <TextInput
              label="Next Follow-up Date (YYYY-MM-DD)"
              value={nextFollowupDate}
              onChangeText={setNextFollowupDate}
              mode="outlined"
              style={styles.input}
              placeholder="2025-07-20"
              outlineColor="#009688"
              activeOutlineColor="#009688"
            />

            <Text variant="labelLarge" style={styles.label}>
              Next Follow-up Type
            </Text>
            <SegmentedButtons
              value={nextFollowupType}
              onValueChange={setNextFollowupType}
              buttons={[
                { value: 'Call', label: 'Call' },
                { value: 'WhatsApp', label: 'WhatsApp' },
                { value: 'Meeting', label: 'Meeting' },
                { value: 'Email', label: 'Email' },
              ]}
              style={styles.segmented}
            />

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
              {loading ? 'Adding Lead...' : 'Add Lead'}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    marginBottom: 12,
    color: '#000000',
  },
  segmented: {
    marginBottom: 16,
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
});
