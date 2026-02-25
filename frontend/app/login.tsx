import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
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
      // For demo purposes - auto send OTP 123456
      // In production, integrate with Firebase Auth
      setTimeout(() => {
        setShowOtpInput(true);
        setVerificationId('demo_verification_id');
        setLoading(false);
        Alert.alert('OTP Sent', 'Your OTP is: 123456 (Demo Mode)\n\nIn production, you will receive SMS OTP');
      }, 1500);
      
      // Production code (uncomment when Firebase is configured):
      /*
      const { auth } = require('../config/firebase');
      const { signInWithPhoneNumber } = require('firebase/auth');
      
      const confirmation = await signInWithPhoneNumber(auth, `+91${phoneNumber}`);
      setVerificationId(confirmation.verificationId);
      setShowOtpInput(true);
      setLoading(false);
      Alert.alert('Success', 'OTP sent to your mobile number');
      */
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

    try {
      // Demo mode - accept 123456
      if (otp === '123456') {
        // Save login state
        await AsyncStorage.setItem('userLoggedIn', 'true');
        await AsyncStorage.setItem('userPhone', phoneNumber);
        
        // Navigate immediately - Alert callbacks don't work well on web
        setLoading(false);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Invalid OTP. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
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

              <Button
                mode="contained"
                onPress={verifyOTP}
                style={styles.button}
                loading={loading}
                disabled={loading}
                buttonColor="#009688"
                icon="check-circle"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </Button>

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
            <Text variant="bodySmall" style={styles.demoNote}>
              Demo Mode: Use OTP 123456
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
  demoNote: {
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: 'bold',
  },
});
