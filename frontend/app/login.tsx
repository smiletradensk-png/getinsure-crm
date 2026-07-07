import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert, Dimensions, ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from './theme';
import { migrateExistingLeadsToUser, initializeDatabase } from '../utils/database';

const { width } = Dimensions.get('window');

const OTP_SERVER_URL = 'https://getinsure-otp.onrender.com';

const ACCOUNTS_KEY = 'registered_accounts';
const CURR_EMAIL   = 'current_account_email';

type Account = { name: string; email: string; pin: string };
type Mode    =
  | 'enter_pin'
  | 'setup_name_email'
  | 'setup_pin'
  | 'confirm_pin'
  | 'forgot_email'
  | 'forgot_otp'
  | 'switch_account';

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','←','0','✓'];

export default function LoginScreen() {
  // ── Account state ──────────────────────────────────────────────────────────
  const [mode, setMode]                   = useState<Mode>('enter_pin');
  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [currentEmail, setCurrentEmail]   = useState('');
  const [currentName, setCurrentName]     = useState('');
  const [forgotAccount, setForgotAccount] = useState<Account | null>(null);

  // ── Input state ────────────────────────────────────────────────────────────
  const [pin, setPin]               = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [tempName, setTempName]     = useState('');
  const [email, setEmail]           = useState('');

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [otpCode, setOtpCode]               = useState('');
  const [otpSending, setOtpSending]         = useState(false);
  const [otpVerifying, setOtpVerifying]     = useState(false);
  const [otpError, setOtpError]             = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ── Cleanup timer on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Load accounts on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
        const currEmail    = await AsyncStorage.getItem(CURR_EMAIL);

        if (accountsJson) {
          const accts: Account[] = JSON.parse(accountsJson);
          setAccounts(accts);
          if (accts.length > 0) {
            const target = accts.find(a => a.email === currEmail) ?? accts[0];
            setCurrentEmail(target.email);
            setCurrentName(target.name);
            setMode('enter_pin');
          } else {
            setMode('setup_name_email');
          }
        } else {
          // Migrate from old single-account format
          const oldPin   = await AsyncStorage.getItem('user_pin');
          const oldEmail = await AsyncStorage.getItem('user_email');
          const oldName  = await AsyncStorage.getItem('user_name');
          if (oldPin && oldEmail) {
            const migrated: Account[] = [{
              name:  oldName || oldEmail.split('@')[0],
              email: oldEmail,
              pin:   oldPin,
            }];
            await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(migrated));
            await AsyncStorage.setItem(CURR_EMAIL, oldEmail);
            setAccounts(migrated);
            setCurrentEmail(oldEmail);
            setCurrentName(migrated[0].name);
            setMode('enter_pin');
          } else {
            setMode('setup_name_email');
          }
        }
      } catch {
        setMode('setup_name_email');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const activateSession = async (acctEmail: string, acctName: string) => {
    await AsyncStorage.multiSet([
      ['userLoggedIn', 'true'],
      ['user_email', acctEmail],
      ['user_name', acctName],
      [CURR_EMAIL, acctEmail],
    ]);
    await initializeDatabase();
    migrateExistingLeadsToUser(acctEmail);
    router.replace('/(tabs)');
  };

  const startResendTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendCountdown(60);
    timerRef.current = setInterval(() => {
      setResendCountdown(c => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  // ── Send OTP to email via server ───────────────────────────────────────────

  const sendOtp = async (targetEmail: string) => {
    setOtpSending(true);
    setOtpError('');
    try {
      const res  = await fetch(`${OTP_SERVER_URL}/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Could Not Send OTP', data.error || 'Server error. Please try again.');
        return false;
      }
      return true;
    } catch {
      Alert.alert(
        'Network Error',
        'Could not reach the OTP server.\n\nMake sure you have internet access and the OTP server is deployed on Render.',
      );
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  // ── Verify OTP with server ─────────────────────────────────────────────────

  const handleOtpVerify = async () => {
    if (otpCode.length !== 6 || otpVerifying) return;
    setOtpVerifying(true);
    setOtpError('');
    try {
      const res  = await fetch(`${OTP_SERVER_URL}/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Incorrect OTP. Please try again.');
        setOtpCode('');
        return;
      }
      // ✅ OTP verified — find account and allow PIN reset
      const found = accounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase());
      if (!found) {
        setOtpError('Account not found. Please try again.');
        return;
      }
      setForgotAccount(found);
      setOtpCode('');
      setOtpError('');
      if (timerRef.current) clearInterval(timerRef.current);
      setPin('');
      setPendingPin('');
      setMode('setup_pin');
    } catch {
      setOtpError('Network error. Please check your connection.');
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Numpad press handler ───────────────────────────────────────────────────

  const handlePadPress = (key: string) => {
    if (mode === 'forgot_otp') {
      if (key === '←') { setOtpCode(c => c.slice(0, -1)); setOtpError(''); return; }
      if (key === '✓') { handleOtpVerify(); return; }
      if (otpCode.length < 6) setOtpCode(c => c + key);
      return;
    }
    if (key === '←') { setPin(p => p.slice(0, -1)); return; }
    if (key === '✓') { handleConfirm(); return; }
    if (pin.length < 4) setPin(p => p + key);
  };

  // ── PIN confirm handler ────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (pin.length < 4) return;

    if (mode === 'enter_pin') {
      const acct = accounts.find(a => a.email === currentEmail);
      if (acct && pin === acct.pin) {
        await activateSession(acct.email, acct.name);
      } else {
        Alert.alert('Wrong PIN', 'Incorrect PIN. Please try again.');
        setPin('');
      }
    } else if (mode === 'setup_pin') {
      setPendingPin(pin);
      setPin('');
      setMode('confirm_pin');
    } else if (mode === 'confirm_pin') {
      if (pin !== pendingPin) {
        Alert.alert('Mismatch', 'PINs do not match. Please try again.');
        setPendingPin('');
        setPin('');
        setMode('setup_pin');
        return;
      }
      if (forgotAccount) {
        // Resetting existing account's PIN after OTP verification
        const updated = accounts.map(a =>
          a.email === forgotAccount.email ? { ...a, pin } : a,
        );
        await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
        setAccounts(updated);
        setCurrentEmail(forgotAccount.email);
        setCurrentName(forgotAccount.name);
        setForgotAccount(null);
        await activateSession(forgotAccount.email, forgotAccount.name);
      } else {
        // New account setup
        const newAcct: Account = {
          name:  tempName.trim(),
          email: email.toLowerCase().trim(),
          pin,
        };
        const updated = [...accounts, newAcct];
        await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
        setAccounts(updated);
        await activateSession(newAcct.email, newAcct.name);
      }
    }
  };

  // ── Email submit (setup or forgot) ─────────────────────────────────────────

  const handleEmailSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName  = tempName.trim();

    if (mode === 'forgot_email') {
      // 1. Check email is registered locally first (don't burn Gmail quota for strangers)
      const found = accounts.find(a => a.email.toLowerCase() === trimmedEmail);
      if (!found) {
        Alert.alert('Not Found', 'This email is not registered on this device.');
        return;
      }
      // 2. Send OTP via server
      const sent = await sendOtp(trimmedEmail);
      if (!sent) return;
      // 3. Move to OTP entry screen
      setOtpCode('');
      setOtpError('');
      startResendTimer();
      setMode('forgot_otp');
      return;
    }

    // New account setup validation
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (accounts.some(a => a.email.toLowerCase() === trimmedEmail)) {
      Alert.alert('Already Registered', 'An account with this email already exists. Use "Switch Account" to log in.');
      return;
    }
    setMode('setup_pin');
  };

  const handleSwitchToAccount = (acct: Account) => {
    setCurrentEmail(acct.email);
    setCurrentName(acct.name);
    setPin('');
    setMode('enter_pin');
  };

  // ── Loading splash ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navyDark, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const pinTitle =
    forgotAccount          ? `Reset PIN for ${forgotAccount.name.split(' ')[0]}` :
    mode === 'setup_pin'   ? 'Create a 4-Digit PIN'   :
    mode === 'confirm_pin' ? 'Confirm Your PIN'        :
    mode === 'enter_pin'   ? 'Enter Your PIN'          : '';

  const showPad = mode === 'enter_pin' || mode === 'setup_pin' || mode === 'confirm_pin';
  const padReady = mode === 'forgot_otp' ? otpCode.length === 6 : pin.length === 4;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={[C.navyDark, C.navy, C.navyMid]} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="shield-account" size={40} color={C.gold} />
          </View>
          <Text style={styles.appName}>GETINSURE CRM</Text>
          <Text style={styles.appTagline}>Your Premium Sales Partner</Text>
        </View>

        {/* ── SWITCH ACCOUNT ── */}
        {mode === 'switch_account' && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <MaterialCommunityIcons name="account-switch-outline" size={30} color={C.navy} />
            </View>
            <Text style={styles.cardTitle}>Switch Account</Text>
            <Text style={styles.cardSubtitle}>Select an account or add a new one</Text>

            {accounts.map(acct => (
              <TouchableOpacity
                key={acct.email}
                style={[styles.accountItem, acct.email === currentEmail && styles.accountItemActive]}
                onPress={() => handleSwitchToAccount(acct)}
                activeOpacity={0.75}
              >
                <View style={styles.accountAvatar}>
                  <Text style={styles.accountAvatarText}>
                    {acct.name.trim()[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{acct.name}</Text>
                  <Text style={styles.accountEmail}>{acct.email}</Text>
                </View>
                {acct.email === currentEmail && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={C.navy} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { setTempName(''); setEmail(''); setMode('setup_name_email'); }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="account-plus" size={20} color={C.navy} />
              <Text style={styles.primaryBtnText}>New Account</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode('enter_pin')} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── EMAIL / NAME SETUP (new account or forgot email entry) ── */}
        {(mode === 'setup_name_email' || mode === 'forgot_email') && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <MaterialCommunityIcons
                name={mode === 'forgot_email' ? 'lock-reset' : 'account-plus-outline'}
                size={30}
                color={C.navy}
              />
            </View>
            <Text style={styles.cardTitle}>
              {mode === 'setup_name_email' ? 'Create Your Account' : 'Reset Your PIN'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {mode === 'setup_name_email'
                ? 'Enter your details to get started'
                : "We’ll send a one-time code to your registered email"}
            </Text>

            {mode === 'setup_name_email' && (
              <TextInput
                label="Full Name"
                value={tempName}
                onChangeText={setTempName}
                mode="outlined"
                autoCapitalize="words"
                outlineColor={C.border}
                activeOutlineColor={C.navy}
                style={styles.emailInput}
                left={<TextInput.Icon icon="account" color={C.navy} />}
              />
            )}

            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              outlineColor={C.border}
              activeOutlineColor={C.navy}
              style={styles.emailInput}
              left={<TextInput.Icon icon="email" color={C.navy} />}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, otpSending && { opacity: 0.7 }]}
              onPress={handleEmailSubmit}
              activeOpacity={0.85}
              disabled={otpSending}
            >
              {otpSending ? (
                <ActivityIndicator color={C.navy} size="small" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {mode === 'forgot_email' ? 'Send OTP' : 'Continue'}
                  </Text>
                  <MaterialCommunityIcons
                    name={mode === 'forgot_email' ? 'email-arrow-right' : 'arrow-right'}
                    size={20}
                    color={C.navy}
                  />
                </>
              )}
            </TouchableOpacity>

            {accounts.length > 0 && (
              <TouchableOpacity onPress={() => setMode('enter_pin')} style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>← Back to login</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── OTP ENTRY (forgot PIN flow) ── */}
        {mode === 'forgot_otp' && (
          <View style={styles.card}>
            {/* Email badge */}
            <View style={styles.accountBadge}>
              <MaterialCommunityIcons name="email-check-outline" size={22} color={C.navy} />
              <View style={{ flex: 1 }}>
                <Text style={styles.accountBadgeName}>OTP sent to</Text>
                <Text style={styles.accountBadgeEmail}>{email.trim().toLowerCase()}</Text>
              </View>
            </View>

            <View style={styles.cardIconRow}>
              <MaterialCommunityIcons name="shield-key-outline" size={30} color={C.navy} />
            </View>
            <Text style={styles.cardTitle}>Enter Verification Code</Text>
            <Text style={styles.cardSubtitle}>
              Check your email for a 6-digit code. It expires in 10 minutes.
            </Text>

            {/* 6-dot OTP indicator */}
            <View style={styles.dotsRow}>
              {[0,1,2,3,4,5].map(i => (
                <View key={i} style={[styles.dot, styles.dotSmall, otpCode.length > i && styles.dotFilled]} />
              ))}
            </View>

            {/* Error message */}
            {otpError ? (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.danger} />
                <Text style={styles.errorText}>{otpError}</Text>
              </View>
            ) : null}

            {/* Numpad */}
            <View style={styles.pad}>
              {PAD_KEYS.map(key => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.padKey,
                    key === '✓' && padReady && styles.padKeyConfirm,
                    key === '✓' && otpVerifying && { opacity: 0.5 },
                  ]}
                  onPress={() => handlePadPress(key)}
                  activeOpacity={0.65}
                  disabled={key === '✓' && otpVerifying}
                >
                  {key === '←' ? (
                    <MaterialCommunityIcons name="backspace-outline" size={22} color={C.navy} />
                  ) : key === '✓' ? (
                    otpVerifying
                      ? <ActivityIndicator size="small" color={padReady ? C.white : C.textLight} />
                      : <MaterialCommunityIcons name="check" size={22} color={padReady ? C.white : C.textLight} />
                  ) : (
                    <Text style={styles.padKeyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Resend OTP */}
            <View style={styles.resendRow}>
              {resendCountdown > 0 ? (
                <Text style={styles.resendCountdown}>Resend OTP in {resendCountdown}s</Text>
              ) : (
                <TouchableOpacity
                  onPress={async () => {
                    const sent = await sendOtp(email.trim().toLowerCase());
                    if (sent) {
                      setOtpCode('');
                      setOtpError('');
                      startResendTimer();
                    }
                  }}
                  disabled={otpSending}
                >
                  <Text style={[styles.linkBtnText, { color: C.navy }]}>
                    {otpSending ? 'Sending…' : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => { setMode('forgot_email'); setOtpCode(''); setOtpError(''); }}
              style={styles.linkBtn}
            >
              <Text style={[styles.linkBtnText, { color: C.textLight, fontSize: 12 }]}>← Change email</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PIN PAD (enter, setup, confirm) ── */}
        {showPad && (
          <View style={styles.card}>
            {mode === 'enter_pin' && (
              <View style={styles.accountBadge}>
                <MaterialCommunityIcons name="account-circle" size={24} color={C.navy} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountBadgeName}>{currentName}</Text>
                  <Text style={styles.accountBadgeEmail}>{currentEmail}</Text>
                </View>
              </View>
            )}

            <View style={styles.cardIconRow}>
              <MaterialCommunityIcons name="lock-outline" size={30} color={C.navy} />
            </View>
            <Text style={styles.cardTitle}>{pinTitle}</Text>
            {mode === 'confirm_pin' && (
              <Text style={styles.cardSubtitle}>Re-enter the PIN you just created</Text>
            )}
            {mode === 'setup_pin' && !forgotAccount && (
              <Text style={styles.cardSubtitle}>Choose a 4-digit PIN to secure your account</Text>
            )}
            {mode === 'setup_pin' && forgotAccount && (
              <Text style={styles.cardSubtitle}>OTP verified ✓ — set your new 4-digit PIN</Text>
            )}

            {/* 4 dots */}
            <View style={styles.dotsRow}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
              ))}
            </View>

            {/* Numpad */}
            <View style={styles.pad}>
              {PAD_KEYS.map(key => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.padKey,
                    key === '✓' && padReady && styles.padKeyConfirm,
                  ]}
                  onPress={() => handlePadPress(key)}
                  activeOpacity={0.65}
                >
                  {key === '←' ? (
                    <MaterialCommunityIcons name="backspace-outline" size={22} color={C.navy} />
                  ) : key === '✓' ? (
                    <MaterialCommunityIcons name="check" size={22} color={padReady ? C.white : C.textLight} />
                  ) : (
                    <Text style={styles.padKeyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'enter_pin' && (
              <>
                <TouchableOpacity
                  onPress={() => { setEmail(''); setPin(''); setMode('forgot_email'); }}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkBtnText}>Forgot PIN?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode('switch_account')}
                  style={[styles.linkBtn, { marginTop: 4 }]}
                >
                  <Text style={[styles.linkBtnText, { color: C.textLight, fontSize: 12 }]}>
                    Switch Account
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <Text style={styles.footer}>Secured · Data stored only on this device</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_PAD = 24;
const PAD_GAP  = 10;
const KEY_W    = (width - CARD_PAD * 2 - 48 - PAD_GAP * 2) / 3;

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  logoArea: { alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: C.gold,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  appName:    { fontSize: 20, fontWeight: '800', color: C.white, letterSpacing: 1.5 },
  appTagline: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 },

  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: C.white, borderRadius: 24, padding: CARD_PAD,
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.25,
    shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },

  cardIconRow:  { alignItems: 'center', marginBottom: 8 },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: C.navy, textAlign: 'center', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: C.textMid, textAlign: 'center', marginBottom: 16 },

  accountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  accountBadgeName:  { fontSize: 13, fontWeight: '700', color: C.navy },
  accountBadgeEmail: { fontSize: 12, color: C.textLight, marginTop: 1 },

  accountItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  accountItemActive: { borderColor: C.navy, backgroundColor: '#EEF2FF' },
  accountAvatar: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.navy + '20', justifyContent: 'center', alignItems: 'center',
  },
  accountAvatarText: { fontSize: 16, fontWeight: '800', color: C.navy },
  accountName:  { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  accountEmail: { fontSize: 12, color: C.textLight, marginTop: 1 },

  emailInput:     { marginBottom: 14, backgroundColor: C.white },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.gold, paddingVertical: 13, borderRadius: 14, gap: 8, marginTop: 4,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: C.navy },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: C.danger, fontWeight: '600' },

  dotsRow:  { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 18 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: C.navy, backgroundColor: 'transparent',
  },
  dotSmall: { width: 13, height: 13, borderRadius: 7 },
  dotFilled: { backgroundColor: C.navy },

  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: PAD_GAP },
  padKey: {
    width: KEY_W, height: 52, borderRadius: 12,
    backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center',
  },
  padKeyConfirm: { backgroundColor: C.navy },
  padKeyText:    { fontSize: 22, fontWeight: '600', color: C.navy },

  resendRow:       { alignItems: 'center', marginTop: 14 },
  resendCountdown: { fontSize: 12, color: C.textLight, fontWeight: '500' },

  linkBtn:     { alignItems: 'center', marginTop: 12 },
  linkBtnText: { fontSize: 13, color: C.navyMid, fontWeight: '600' },

  footer: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 20 },
});
