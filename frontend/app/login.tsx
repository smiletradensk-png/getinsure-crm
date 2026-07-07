import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert, Dimensions, FlatList,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from './theme';
import { migrateExistingLeadsToUser, initializeDatabase } from '../utils/database';

const { width } = Dimensions.get('window');

const ACCOUNTS_KEY = 'registered_accounts';
const CURR_EMAIL   = 'current_account_email';

type Account = { name: string; email: string; pin: string };
type Mode    =
  | 'enter_pin'
  | 'setup_name_email'
  | 'setup_pin'
  | 'confirm_pin'
  | 'forgot_email'
  | 'switch_account';

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','←','0','✓'];

export default function LoginScreen() {
  const [mode, setMode]               = useState<Mode>('enter_pin');
  const [accounts, setAccounts]       = useState<Account[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentName, setCurrentName]   = useState('');
  const [forgotAccount, setForgotAccount] = useState<Account | null>(null);

  const [pin, setPin]             = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [tempName, setTempName]   = useState('');
  const [email, setEmail]         = useState('');
  const [loading, setLoading]     = useState(true);

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

  const activateSession = async (email: string, name: string) => {
    await AsyncStorage.multiSet([
      ['userLoggedIn', 'true'],
      ['user_email', email],
      ['user_name', name],
      [CURR_EMAIL, email],
    ]);
    await initializeDatabase();
    migrateExistingLeadsToUser(email);
    router.replace('/(tabs)');
  };

  const handlePadPress = (key: string) => {
    if (key === '←') { setPin(p => p.slice(0, -1)); return; }
    if (key === '✓') { handleConfirm(); return; }
    if (pin.length < 4) setPin(p => p + key);
  };

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
        // Resetting existing account's PIN
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
        // New account
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

  const handleEmailSubmit = () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName  = tempName.trim();

    if (mode === 'forgot_email') {
      const found = accounts.find(a => a.email.toLowerCase() === trimmedEmail);
      if (found) {
        setForgotAccount(found);
        setPin('');
        setPendingPin('');
        setMode('setup_pin');
      } else {
        Alert.alert('Not Found', 'This email is not registered on this device.');
      }
      return;
    }

    // New account setup
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (accounts.some(a => a.email.toLowerCase() === trimmedEmail)) {
      Alert.alert('Already Registered', 'An account with this email already exists.');
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navyDark, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  const pinTitle =
    forgotAccount     ? `Reset PIN for ${forgotAccount.name.split(' ')[0]}` :
    mode === 'setup_pin'   ? 'Create a 4-Digit PIN' :
    mode === 'confirm_pin' ? 'Confirm Your PIN'     :
    mode === 'enter_pin'   ? 'Enter Your PIN'       : '';

  const showPad = mode === 'enter_pin' || mode === 'setup_pin' || mode === 'confirm_pin';

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

        {/* ── SWITCH ACCOUNT MODE ── */}
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

            <TouchableOpacity
              onPress={() => setMode('enter_pin')}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── EMAIL / NAME SETUP ── */}
        {(mode === 'setup_name_email' || mode === 'forgot_email') && (
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <MaterialCommunityIcons
                name={mode === 'forgot_email' ? 'lock-reset' : 'email-outline'}
                size={30}
                color={C.navy}
              />
            </View>
            <Text style={styles.cardTitle}>
              {mode === 'setup_name_email' ? 'Create Your Account' : 'Recover Access'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {mode === 'setup_name_email'
                ? 'Enter your details to get started'
                : 'Enter your registered email to reset PIN'}
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

            <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailSubmit} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continue</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={C.navy} />
            </TouchableOpacity>

            {accounts.length > 0 && (
              <TouchableOpacity
                onPress={() => setMode('enter_pin')}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>← Back to login</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── PIN PAD ── */}
        {showPad && (
          <View style={styles.card}>
            {/* Registered email (greyed) shown in enter_pin mode */}
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
            {(mode === 'setup_pin' && !forgotAccount) && (
              <Text style={styles.cardSubtitle}>Choose a 4-digit PIN to secure your account</Text>
            )}

            {/* PIN dots */}
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3].map(i => (
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
                    key === '✓' && pin.length === 4 && styles.padKeyConfirm,
                  ]}
                  onPress={() => handlePadPress(key)}
                  activeOpacity={0.65}
                >
                  {key === '←' ? (
                    <MaterialCommunityIcons name="backspace-outline" size={22} color={C.navy} />
                  ) : key === '✓' ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={22}
                      color={pin.length === 4 ? C.white : C.textLight}
                    />
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
                  style={styles.forgotBtn}
                >
                  <Text style={styles.forgotText}>Forgot PIN?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode('switch_account')}
                  style={[styles.forgotBtn, { marginTop: 4 }]}
                >
                  <Text style={[styles.forgotText, { color: C.textLight, fontSize: 12 }]}>
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
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  appName:    { fontSize: 20, fontWeight: '800', color: C.white, letterSpacing: 1.5 },
  appTagline: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 },

  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: C.white,
    borderRadius: 24, padding: CARD_PAD,
    elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },

  cardIconRow:  { alignItems: 'center', marginBottom: 8 },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: C.navy, textAlign: 'center', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: C.textMid, textAlign: 'center', marginBottom: 16 },

  // Account badge (greyed email shown in enter_pin)
  accountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  accountBadgeName:  { fontSize: 14, fontWeight: '700', color: C.navy },
  accountBadgeEmail: { fontSize: 12, color: C.textLight, marginTop: 1 },

  // Switch account list
  accountItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 10,
  },
  accountItemActive: { borderColor: C.navy, backgroundColor: '#EEF2FF' },
  accountAvatar: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.navy + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  accountAvatarText: { fontSize: 16, fontWeight: '800', color: C.navy },
  accountName:  { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  accountEmail: { fontSize: 12, color: C.textLight, marginTop: 1 },

  emailInput: { marginBottom: 14, backgroundColor: C.white },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.gold, paddingVertical: 13, borderRadius: 14, gap: 8,
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: C.navy },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 20 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: C.navy, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: C.navy },

  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: PAD_GAP },
  padKey: {
    width: KEY_W, height: 52, borderRadius: 12,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center', alignItems: 'center',
  },
  padKeyConfirm: { backgroundColor: C.navy },
  padKeyText:    { fontSize: 22, fontWeight: '600', color: C.navy },

  forgotBtn:  { alignItems: 'center', marginTop: 14 },
  forgotText: { fontSize: 13, color: C.navyMid, fontWeight: '600' },

  footer: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 20 },
});
