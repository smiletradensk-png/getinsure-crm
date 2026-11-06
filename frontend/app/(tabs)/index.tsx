import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, InteractionManager } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalStats, initializeDatabase } from '../../utils/database';
import { setPendingStatus, setPendingFollowup } from '../../utils/navFilter';
import { C } from '../theme';

interface Stats {
  total_leads:       number;
  today_followups:   number;
  overdue_followups: number;
  interested_leads:  number;
  closed_leads:      number;
  new_leads:         number;
  followup_leads:    number;
  pipeline_leads:    number;
  not_interested?:   number;
}

const STATUS_CARDS: {
  key: string;
  status: string;
  label: string;
  icon: string;
  bg: string;
  accent: string;
}[] = [
  { key: 'new_leads',        status: 'New',            label: 'New',            icon: 'account-plus-outline',   bg: '#DBEAFE', accent: '#1D4ED8' },
  { key: 'interested_leads', status: 'Interested',     label: 'Interested',     icon: 'thumb-up-outline',       bg: '#DCFCE7', accent: '#15803D' },
  { key: 'followup_leads',   status: 'Follow-up',      label: 'Follow-up',      icon: 'calendar-clock',         bg: '#FEF3C7', accent: '#B45309' },
  { key: 'pipeline_leads',   status: 'Pipeline',       label: 'Pipeline',       icon: 'chart-timeline-variant', bg: '#EDE9FE', accent: '#6D28D9' },
  { key: 'closed_leads',     status: 'Closed',         label: 'Closed',         icon: 'check-decagram-outline', bg: '#CCFBF1', accent: '#0F766E' },
  { key: 'not_interested',   status: 'Not Interested', label: 'Not Interested', icon: 'thumb-down-outline',     bg: '#E5E7EB', accent: '#4B5563' },
];

export default function DashboardScreen() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  const fetchStats = async () => {
    try {
      await initializeDatabase();
      const email = await AsyncStorage.getItem('user_email') ?? '';
      const name  = await AsyncStorage.getItem('user_name')  ?? '';
      setUserName(name || email.split('@')[0]);
      const st: any = getLocalStats(email);
      const counted = (st.new_leads || 0) + (st.interested_leads || 0) + (st.followup_leads || 0) + (st.pipeline_leads || 0) + (st.closed_leads || 0);
      st.not_interested = Math.max(0, (st.total_leads || 0) - counted);
      setStats(st as Stats);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => { fetchStats(); });
    return () => task.cancel();
  }, []));

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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

        {/* Hero strip */}
        <View style={styles.heroStrip}>
          {[
            { v: stats?.total_leads || 0,   l: 'Total Leads'  },
            { v: `${closingRatio}%`,          l: 'Closing Rate' },
            { v: stats?.today_followups || 0, l: "Today's Tasks" },
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

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Lead Pipeline</Text>

        <View style={styles.cardsGrid}>
          {STATUS_CARDS.map(card => {
            const count = ((stats as any)?.[card.key] as number) || 0;
            const pct = stats?.total_leads ? Math.round((count / stats.total_leads) * 100) : 0;
            return (
              <TouchableOpacity
                key={card.key}
                style={[styles.statusCard, { backgroundColor: card.bg }]}
                onPress={() => { setPendingStatus(card.status); router.push('/(tabs)/leads' as any); }}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, { backgroundColor: card.accent + '22' }]}>
                  <MaterialCommunityIcons name={card.icon as any} size={20} color={card.accent} />
                </View>
                <Text style={[styles.cardCount, { color: card.accent }]}>{count}</Text>
                <Text style={[styles.cardLabel, { color: card.accent }]} numberOfLines={1}>{card.label}</Text>
                <View style={styles.pctTrack}>
                  <View style={[styles.pctFill, { width: `${Math.max(pct, count > 0 ? 4 : 0)}%`, backgroundColor: card.accent }]} />
                </View>
                <Text style={[styles.pctText, { color: card.accent }]}>{pct}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Follow-up quick stats */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Follow-ups</Text>
        <View style={styles.followupRow}>
          <TouchableOpacity
            style={styles.followupCard}
            onPress={() => { setPendingFollowup('today'); router.push('/(tabs)/followups' as any); }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="calendar-today" size={20} color="#E65100" />
            <Text style={styles.followupCount}>{stats?.today_followups || 0}</Text>
            <Text style={styles.followupLabel}>Due Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.followupCard, { borderColor: '#FECACA' }]}
            onPress={() => { setPendingFollowup('overdue'); router.push('/(tabs)/followups' as any); }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#C62828" />
            <Text style={[styles.followupCount, { color: '#C62828' }]}>{stats?.overdue_followups || 0}</Text>
            <Text style={[styles.followupLabel, { color: '#C62828' }]}>Overdue</Text>
          </TouchableOpacity>
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

  body:         { flex: 1, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.navy, marginBottom: 12, paddingHorizontal: 16, textTransform: 'uppercase', letterSpacing: 0.5 },

  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  statusCard: {
    width: '31.2%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  iconWrap:  { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  cardCount: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  cardLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  pctTrack:  { height: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 8, overflow: 'hidden' },
  pctFill:   { height: 4, borderRadius: 2 },
  pctText:   { fontSize: 10, fontWeight: '600', marginTop: 3, opacity: 0.8 },

  followupRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
  followupCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FED7AA',
    elevation: 1, shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    gap: 4,
  },
  followupCount: { fontSize: 24, fontWeight: '800', color: '#E65100' },
  followupLabel: { fontSize: 12, fontWeight: '600', color: '#E65100' },
});
