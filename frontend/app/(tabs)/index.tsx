import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalStats, initializeDatabase } from '../../utils/database';
import { C } from '../theme';

interface Stats {
  total_leads: number;
  today_followups: number;
  overdue_followups: number;
  interested_leads: number;
  closed_leads: number;
}

export default function DashboardScreen() {
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const fetchStats = async () => {
    try {
      await initializeDatabase();
      const email = await AsyncStorage.getItem('user_email') ?? '';
      const name  = await AsyncStorage.getItem('user_name')  ?? '';
      setUserEmail(email);
      setUserName(name || email.split('@')[0]);
      setStats(getLocalStats(email));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchStats(); }, []));

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.navy} />
      </View>
    );
  }

  const closingRatio = stats?.total_leads
    ? Math.round(((stats.closed_leads || 0) / stats.total_leads) * 100) : 0;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  const STAT_CARDS = [
    { label: 'Interested',  value: stats?.interested_leads  || 0, icon: 'thumb-up-outline',        colors: ['#1565C0','#1976D2'] as [string,string], route: '/(tabs)/leads'     },
    { label: 'Follow-ups',  value: stats?.today_followups   || 0, icon: 'calendar-clock',           colors: ['#E65100','#F57C00'] as [string,string], route: '/(tabs)/followups' },
    { label: 'Overdue',     value: stats?.overdue_followups || 0, icon: 'alert-circle-outline',     colors: ['#B71C1C','#C62828'] as [string,string], route: '/(tabs)/followups' },
    { label: 'Closed',      value: stats?.closed_leads      || 0, icon: 'check-decagram-outline',   colors: ['#1B5E20','#2E7D32'] as [string,string], route: '/(tabs)/leads'     },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <LinearGradient colors={[C.navyDark, C.navy]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.userName} numberOfLines={1}>{userName || 'Agent'}</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
          <TouchableOpacity style={styles.pipelineBtn} onPress={() => router.push('/(tabs)/pipeline')} activeOpacity={0.85}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={C.white} />
          </TouchableOpacity>
        </View>

        {/* Hero strip — 3 numbers */}
        <View style={styles.heroStrip}>
          {[
            { v: stats?.total_leads || 0,  l: 'Total Leads'  },
            { v: `${closingRatio}%`,        l: 'Closing Rate' },
            { v: stats?.today_followups||0, l: "Today's Tasks" },
          ].map((item, i) => (
            <React.Fragment key={item.l}>
              {i > 0 && <View style={styles.stripDivider} />}
              <View style={styles.stripItem}>
                <Text style={styles.stripValue}>{item.v}</Text>
                <Text style={styles.stripLabel}>{item.l}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      {/* ── Body — flex, no scroll ── */}
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.grid}>
          {STAT_CARDS.map(card => (
            <TouchableOpacity
              key={card.label}
              style={styles.statCard}
              onPress={() => router.push(card.route as any)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={card.colors}
                style={styles.statGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons
                  name={card.icon as any}
                  size={18}
                  color="rgba(255,255,255,0.85)"
                  style={styles.statIcon}
                />
                <Text style={styles.statValue}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  header:     { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting:   { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  userName:   { fontSize: 20, color: C.white, fontWeight: '800', marginTop: 1 },
  dateText:   { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  pipelineBtn: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  heroStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderRadius: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
  },
  stripItem:    { flex: 1, alignItems: 'center' },
  stripValue:   { fontSize: 22, fontWeight: '800', color: C.white },
  stripLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  stripDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 4 },

  body:         { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.navy, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47.5%',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: C.navy,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statGradient: { padding: 14, minHeight: 90 },
  statIcon:     { marginBottom: 6 },
  statValue:    { fontSize: 30, fontWeight: '800', color: C.white },
  statLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 3, fontWeight: '600' },
});
