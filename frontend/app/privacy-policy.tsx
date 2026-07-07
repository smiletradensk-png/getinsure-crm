import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from './theme';

const LAST_UPDATED = 'July 2026';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={styles.para}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[C.navyDark, C.navy]} style={styles.header}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={C.white}
          onPress={() => router.back()}
          style={styles.backIcon}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSub}>Last updated: {LAST_UPDATED}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Intro banner */}
        <View style={styles.introBanner}>
          <MaterialCommunityIcons name="shield-lock-outline" size={36} color={C.navy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Your Privacy is Our Priority</Text>
            <Text style={styles.introSub}>
              GETINSURE CRM stores all your data locally on your device. We do not collect,
              transmit, or share any personal information with any server or third party.
            </Text>
          </View>
        </View>

        <Section title="1. Who We Are">
          <Para>
            GETINSURE CRM ("the App", "we", "us") is a sales CRM application designed exclusively
            for independent insurance agents to manage leads, follow-ups, and the sales pipeline.
            The App is developed and published by GETINSURE.
          </Para>
        </Section>

        <Section title="2. Data We Collect">
          <Para>
            The App collects only the information that you manually enter:
          </Para>
          <Bullet>Lead details — name, mobile number, city, product interest, status, source, and notes</Bullet>
          <Bullet>Interaction records — call logs, meeting notes, follow-up schedules</Bullet>
          <Bullet>Your account details — full name, email address, and a 4-digit PIN (stored locally)</Bullet>
          <Bullet>App preferences — font size setting</Bullet>
          <Para>
            We do not collect device identifiers, IP addresses, analytics, crash reports, usage
            statistics, or any other data beyond what you explicitly enter into the App.
          </Para>
        </Section>

        <Section title="3. How Your Data Is Stored">
          <Para>
            All data is stored exclusively on your device using:
          </Para>
          <Bullet>
            SQLite database (via expo-sqlite) — for leads and interaction records
          </Bullet>
          <Bullet>
            AsyncStorage — for account credentials (name, email, PIN) and preferences
          </Bullet>
          <Para>
            Your data never leaves your device unless you explicitly use the "Export CSV",
            "Export JSON", or "Share Backup" features, in which case you choose where to send it
            (WhatsApp, Google Drive, email, etc.). These shares are initiated entirely by you and
            go directly to the app you choose — GETINSURE does not receive a copy.
          </Para>
        </Section>

        <Section title="4. Contacts Permission">
          <Para>
            The App requests access to your device contacts solely for the "Import from Contacts"
            feature. When you use this feature:
          </Para>
          <Bullet>
            You choose which contacts to import by selecting them in the app
          </Bullet>
          <Bullet>
            Only the selected contacts' names and phone numbers are saved locally as leads
          </Bullet>
          <Bullet>
            Contact data is never uploaded to any server or shared with any third party
          </Bullet>
          <Bullet>
            You can revoke this permission at any time in your phone's Settings → Apps →
            GETINSURE CRM → Permissions
          </Bullet>
          <Para>
            We do not scan, read, or store your full contacts list. Access is only used during
            the import action you initiate.
          </Para>
        </Section>

        <Section title="5. Notifications Permission">
          <Para>
            The App requests notification permission to send you follow-up reminders for leads you
            have scheduled. Notifications are generated entirely on-device and do not involve any
            server. You can disable notifications at any time in your phone settings.
          </Para>
        </Section>

        <Section title="6. Camera & Storage Permissions">
          <Para>
            Camera and storage permissions are requested only if you use image-sharing features.
            Photos are accessed at the time of sharing and are not uploaded or stored by the App
            beyond your own device's local storage.
          </Para>
        </Section>

        <Section title="7. Auto-Backup Feature">
          <Para>
            The optional Auto-Backup feature saves a JSON file of your leads to a folder you
            choose on your device (typically Downloads). This file:
          </Para>
          <Bullet>Stays on your device only — it is not uploaded anywhere automatically</Bullet>
          <Bullet>Can be manually shared by you to Google Drive, WhatsApp, or email</Bullet>
          <Bullet>Can be deleted at any time by removing the backup folder</Bullet>
        </Section>

        <Section title="8. No Third-Party Services">
          <Para>
            GETINSURE CRM does not integrate with any analytics platforms, advertising networks,
            crash-reporting services, or cloud databases. There are no third-party SDKs that
            collect your personal data.
          </Para>
          <Para>
            The Facebook Live Leads feature is an optional webhook configuration that you set up
            yourself. If you configure it, your webhook server (which you control) receives leads
            from Facebook. GETINSURE does not operate or have access to this server.
          </Para>
        </Section>

        <Section title="9. Data Security">
          <Para>
            Your data is protected by:
          </Para>
          <Bullet>4-digit PIN authentication to prevent unauthorised access to the App</Bullet>
          <Bullet>Android device-level encryption (if enabled on your phone)</Bullet>
          <Bullet>No network transmission means no risk of interception</Bullet>
          <Para>
            However, if your device is lost or stolen and is not PIN/biometric protected at the
            OS level, someone with physical access to the device could potentially access the App.
            We recommend always locking your device screen.
          </Para>
        </Section>

        <Section title="10. Data Deletion">
          <Para>
            You can delete all your data at any time by:
          </Para>
          <Bullet>Uninstalling the App (removes the SQLite database and AsyncStorage)</Bullet>
          <Bullet>Logging out and creating a new account (data remains per email account)</Bullet>
          <Bullet>Clearing the App's storage from Android Settings → Apps → GETINSURE CRM → Storage → Clear Data</Bullet>
          <Para>
            Since data is only on your device, deletion is immediate and irreversible. We hold no
            copy of your data anywhere.
          </Para>
        </Section>

        <Section title="11. Children's Privacy">
          <Para>
            This App is intended for use by professional insurance agents and is not directed at
            children under the age of 13. We do not knowingly collect personal information from
            children. If you believe a child has used this App, please uninstall it and clear the
            App's storage data.
          </Para>
        </Section>

        <Section title="12. Changes to This Policy">
          <Para>
            We may update this Privacy Policy from time to time. Changes will be reflected by
            updating the "Last updated" date at the top of this page. We encourage you to review
            this policy periodically. Continued use of the App after any changes constitutes
            acceptance of the updated policy.
          </Para>
        </Section>

        <Section title="13. Contact Us">
          <Para>
            If you have any questions or concerns about this Privacy Policy or how your data is
            handled, please contact us at:
          </Para>
          <View style={styles.contactBox}>
            <MaterialCommunityIcons name="email-outline" size={18} color={C.navy} />
            <Text style={styles.contactText}>smiletradensk@gmail.com</Text>
          </View>
          <View style={styles.contactBox}>
            <MaterialCommunityIcons name="shield-account-outline" size={18} color={C.navy} />
            <Text style={styles.contactText}>GETINSURE CRM — Insurance Sales Management App</Text>
          </View>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} GETINSURE CRM. All rights reserved.{'\n'}
            This policy applies to the Android app published on Google Play Store.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 12,
  },
  backIcon:   { padding: 4 },
  headerTitle:{ fontSize: 20, fontWeight: '800', color: C.white },
  headerSub:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  scroll:   { flex: 1 },
  content:  { padding: 16, paddingBottom: 40 },

  introBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#EEF2FF',
    borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  introTitle: { fontSize: 15, fontWeight: '800', color: C.navy, marginBottom: 4 },
  introSub:   { fontSize: 13, color: C.textMid, lineHeight: 20 },

  section: {
    backgroundColor: C.white, borderRadius: 14,
    padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: C.navy,
    marginBottom: 10, borderBottomWidth: 1.5,
    borderBottomColor: C.border, paddingBottom: 8,
  },
  para: { fontSize: 13, color: C.textMid, lineHeight: 21, marginBottom: 8 },

  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 4 },
  bulletDot:  { fontSize: 16, color: C.navy, lineHeight: 21, marginTop: -1 },
  bulletText: { flex: 1, fontSize: 13, color: C.textMid, lineHeight: 21 },

  contactBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 10, padding: 12,
    marginTop: 8, borderWidth: 1, borderColor: C.border,
  },
  contactText: { fontSize: 13, color: C.navy, fontWeight: '600', flex: 1 },

  footer: {
    marginTop: 8, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  footerText: {
    fontSize: 11, color: C.textLight, textAlign: 'center', lineHeight: 18,
  },
});
