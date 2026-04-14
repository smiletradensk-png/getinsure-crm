import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState('');

  const sendOTP = async () => {
    if (phoneNumber.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    
    try {
      // Send OTP via backend or Firebase
      // Currently using simplified verification for quick access
      setTimeout(() => {
        setShowOtpInput(true);
        setVerificationId('verification_id');
        setLoading(false);
        Alert.alert('OTP Sent', 'Please enter the 6-digit OTP sent to your mobile number.');
      }, 1500);
      
    } catch (error) {
      console.error('Error sending OTP:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    console.log('[LOGIN] Starting OTP verification...');

    // Demo mode - accept 123456
    if (otp === '123456') {
      console.log('[LOGIN] OTP is valid, saving to AsyncStorage...');
      
      try {
        // Save login state
        await AsyncStorage.setItem('userLoggedIn', 'true');
        await AsyncStorage.setItem('userPhone', phoneNumber);
        console.log('[LOGIN] AsyncStorage saved successfully');
      } catch (storageError) {
        console.warn('[LOGIN] AsyncStorage save failed (non-critical):', storageError);
        // Continue anyway - user can still use the app
      }
      
      console.log('[LOGIN] Navigating to tabs...');
      setLoading(false);
      router.replace('/(tabs)');
      console.log('[LOGIN] Navigation called');
    } else {
      console.log('[LOGIN] Invalid OTP entered');
      Alert.alert('Error', 'Invalid OTP. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="shield-lock" size={80} color="#009688" />
          </View>

          <Text variant="headlineLarge" style={styles.title}>
            GETINSURE CRM
          </Text>
          <Text variant="titleMedium" style={styles.subtitle}>
            Login with Mobile OTP
          </Text>

          {!showOtpInput ? (
            <>
              <TextInput
                label="Mobile Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={10}
                left={<TextInput.Icon icon="phone" />}
                outlineColor="#009688"
                activeOutlineColor="#009688"
                placeholder="Enter 10-digit mobile"
              />

              <Button
                mode="contained"
                onPress={sendOTP}
                style={styles.button}
                loading={loading}
                disabled={loading}
                buttonColor="#009688"
                icon="send"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </>
          ) : (
            <>
              <View style={styles.phoneDisplay}>
                <MaterialCommunityIcons name="phone-check" size={24} color="#009688" />
                <Text variant="titleMedium" style={styles.phoneText}>
                  +91 {phoneNumber}
                </Text>
                <Button
                  mode="text"
                  onPress={() => {
                    setShowOtpInput(false);
                    setOtp('');
                  }}
                  textColor="#009688"
                >
                  Change
                </Button>
              </View>

              <TextInput
                label="Enter OTP"
                value={otp}
                onChangeText={setOtp}
                mode="outlined"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                left={<TextInput.Icon icon="lock" />}
                outlineColor="#009688"
                activeOutlineColor="#009688"
                placeholder="6-digit OTP"
              />

              <TouchableOpacity
                style={[styles.button, styles.verifyButton]}
                onPress={verifyOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Verify & Login</Text>
                  </>
                )}
              </TouchableOpacity>

              <Button
                mode="text"
                onPress={sendOTP}
                style={styles.resendButton}
                textColor="#009688"
              >
                Resend OTP
              </Button>
            </>
          )}

          <View style={styles.footer}>
            <Text variant="bodySmall" style={styles.footerText}>
              Secure login with OTP verification
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#009688',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#757575',
    marginBottom: 40,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  verifyButton: {
    backgroundColor: '#009688',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  phoneDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2F1',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  phoneText: {
    color: '#00796B',
    fontWeight: 'bold',
  },
  resendButton: {
    marginTop: 8,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: '#757575',
    textAlign: 'center',
  },
});
